import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateElo } from "@/lib/elo-service";
import { ingestMatchZyEventBody } from "@/lib/matchzy-ingest";
import { matchzyWebhookAuthOk } from "@/lib/matchzy-webhook-auth";

// Formato event + OpenAPI: https://shobhit-pathak.github.io/MatchZy/events.html
// match_end_url no JSON da partida pode ainda apontar aqui (legado) ou para /api/webhooks/matchzy-events
export async function POST(request: Request) {
  if (!matchzyWebhookAuthOk(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (body && typeof body === "object" && body.event) {
    try {
      await ingestMatchZyEventBody(body);
    } catch (e) {
      console.error("[webhooks/matchzy]", e);
      return NextResponse.json({ error: "processing failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // Legado: player_stats a nível de raiz (não usado por MatchZy OpenAPI)
  const matchId: string = String(body.matchid || "");
  if (!matchId) {
    return NextResponse.json({ error: "missing matchid" }, { status: 400 });
  }

  const match = await prisma.match.findUnique({
    where: { matchzyId: matchId },
    include: { players: true },
  });

  if (!match) {
    console.warn(`[Webhook] Match não encontrado: ${matchId}`);
    return NextResponse.json({ ok: false, reason: "match not found" });
  }

  const score1: number = body.team1?.score ?? 0;
  const score2: number = body.team2?.score ?? 0;
  const winner = score1 > score2 ? 1 : score2 > score1 ? 2 : null;

  const playerStats: Record<string, { kills: number; deaths: number; assists: number; adr: number }> = {};
  for (const [steamid, stats] of Object.entries(body.player_stats ?? {})) {
    const s = stats as any;
    playerStats[steamid] = {
      kills: s.kills ?? 0,
      deaths: s.deaths ?? 0,
      assists: s.assists ?? 0,
      adr: s.damage ?? 0,
    };
  }

  await prisma.match.update({
    where: { id: match.id },
    data: {
      status: "finished",
      score1,
      score2,
      winner,
      endedAt: new Date(),
      webhookData: JSON.stringify(body),
    },
  });

  for (const player of match.players) {
    const stats = playerStats[player.steamid64];
    if (stats) {
      await prisma.matchPlayer.update({
        where: { matchId_steamid64: { matchId: match.id, steamid64: player.steamid64 } },
        data: stats,
      });
    }
  }

  await prisma.lobby.update({
    where: { id: match.lobbyId },
    data: { status: "open" },
  });

  if (winner !== null) {
    const team1 = match.players.filter((p: { team: number }) => p.team === 1).map((p: { steamid64: string }) => p.steamid64);
    const team2 = match.players.filter((p: { team: number }) => p.team === 2).map((p: { steamid64: string }) => p.steamid64);
    await calculateElo(team1, team2, winner);
  }

  console.log(`[Webhook] Partida ${match.id} finalizada. Placar: ${score1}-${score2}`);
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateElo } from "@/lib/elo-service";

// MatchZy envia um POST aqui ao final da partida
// Docs: https://github.com/shobhit-pathak/MatchZy/blob/master/README.md#webhooks
export async function POST(request: Request) {
  // Valida o secret configurado no MatchZy config.cfg
  const secret = request.headers.get("x-matchzy-secret");
  if (secret !== "matchzy-pug-secret") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const matchId: string = body.matchid;
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

  // Extrair placar do payload do MatchZy
  const score1: number = body.team1?.score ?? 0;
  const score2: number = body.team2?.score ?? 0;
  const winner = score1 > score2 ? 1 : score2 > score1 ? 2 : null;

  // Extrair stats por jogador
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

  // Atualizar match no banco
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

  // Atualizar stats de cada jogador
  for (const player of match.players) {
    const stats = playerStats[player.steamid64];
    if (stats) {
      await prisma.matchPlayer.update({
        where: { matchId_steamid64: { matchId: match.id, steamid64: player.steamid64 } },
        data: stats,
      });
    }
  }

  // Atualizar lobby para status "open" novamente
  await prisma.lobby.update({
    where: { id: match.lobbyId },
    data: { status: "open" },
  });

  // Calcular e atualizar ELO
  if (winner !== null) {
    const team1 = match.players.filter((p) => p.team === 1).map((p) => p.steamid64);
    const team2 = match.players.filter((p) => p.team === 2).map((p) => p.steamid64);
    await calculateElo(team1, team2, winner);
  }

  console.log(`[Webhook] Partida ${match.id} finalizada. Placar: ${score1}-${score2}`);
  return NextResponse.json({ ok: true });
}

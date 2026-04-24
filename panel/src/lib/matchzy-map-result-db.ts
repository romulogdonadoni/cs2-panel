import { prisma } from "./prisma";
import { calculateElo } from "./elo-service";

function n(x: unknown): number {
  const v = Number(x);
  return Number.isFinite(v) ? v : 0;
}

type MzP = { steamid?: string; stats?: { kills?: unknown; deaths?: unknown; assists?: unknown; damage?: unknown } };
type MzT = { score?: number; players?: MzP[] };

/**
 * Fim de mapa: actualiza partida, jogadores, lobby e ELO. Idempotente o suficiente (map_result 1x).
 */
export async function processMapResultForDb(body: Record<string, unknown>) {
  if (body.event !== "map_result") {
    return;
  }

  const matchId = String(body.matchid ?? "");
  if (!matchId) {
    return;
  }

  const match = await prisma.match.findUnique({
    where: { matchzyId: matchId },
    include: { players: true },
  });

  if (!match) {
    console.warn(`[MatchZy] map_result: partida não encontrada (matchzyId=${matchId})`);
    return;
  }

  if (match.status === "finished") {
    return;
  }

  const t1 = body.team1 as MzT | undefined;
  const t2 = body.team2 as MzT | undefined;
  const score1 = n(t1?.score);
  const score2 = n(t2?.score);
  const winner = score1 > score2 ? 1 : score2 > score1 ? 2 : null;

  const bySteam: Record<string, { kills: number; deaths: number; assists: number; adr: number }> = {};
  for (const p of t1?.players || []) {
    const id = p.steamid != null ? String(p.steamid) : "";
    if (!id || !p.stats) continue;
    const s = p.stats;
    bySteam[id] = {
      kills: n(s.kills),
      deaths: n(s.deaths),
      assists: n(s.assists),
      adr: n(s.damage),
    };
  }
  for (const p of t2?.players || []) {
    const id = p.steamid != null ? String(p.steamid) : "";
    if (!id || !p.stats) continue;
    const s = p.stats;
    bySteam[id] = {
      kills: n(s.kills),
      deaths: n(s.deaths),
      assists: n(s.assists),
      adr: n(s.damage),
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
    const stats = bySteam[player.steamid64];
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
    const team1 = match.players.filter((p) => p.team === 1).map((p) => p.steamid64);
    const team2 = match.players.filter((p) => p.team === 2).map((p) => p.steamid64);
    await calculateElo(team1, team2, winner);
  }

  console.log(`[MatchZy] map_result: partida ${match.id} finalizada. ${score1}-${score2}`);
}

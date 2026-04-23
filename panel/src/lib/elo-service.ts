import { prisma } from "./prisma";

const K_FACTOR = 32;

function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function newElo(rating: number, expected: number, actual: number): number {
  return Math.round(rating + K_FACTOR * (actual - expected));
}

/**
 * Calcula e salva ELO para dois times após uma partida.
 * @param team1SteamIds - steamid64s do time 1
 * @param team2SteamIds - steamid64s do time 2
 * @param winner - 1 se time 1 ganhou, 2 se time 2 ganhou
 */
export async function calculateElo(
  team1SteamIds: string[],
  team2SteamIds: string[],
  winner: 1 | 2
): Promise<void> {
  const allIds = [...team1SteamIds, ...team2SteamIds];

  // Busca ratings existentes
  const existing = await prisma.playerRating.findMany({
    where: { steamid64: { in: allIds } },
  });

  const ratingMap = new Map<string, number>(
    existing.map((r) => [r.steamid64, r.elo] as [string, number])
  );

  // Default de 1000 para novatos
  for (const id of allIds) {
    if (!ratingMap.has(id)) ratingMap.set(id, 1000);
  }

  // ELO médio de cada time
  const avg = (ids: string[]) =>
    ids.reduce((sum, id) => sum + (ratingMap.get(id) ?? 1000), 0) / (ids.length || 1);

  const avg1 = avg(team1SteamIds);
  const avg2 = avg(team2SteamIds);

  const exp1 = expectedScore(avg1, avg2);
  const exp2 = expectedScore(avg2, avg1);

  const score1 = winner === 1 ? 1 : 0;
  const score2 = winner === 2 ? 1 : 0;

  const updates = allIds.map((id) => {
    const isTeam1 = team1SteamIds.includes(id);
    const current = ratingMap.get(id) ?? 1000;
    const expected = isTeam1 ? exp1 : exp2;
    const actual = isTeam1 ? score1 : score2;
    const updated = newElo(current, expected, actual);
    const won = (isTeam1 && winner === 1) || (!isTeam1 && winner === 2);

    return prisma.playerRating.upsert({
      where: { steamid64: id },
      create: {
        steamid64: id,
        elo: updated,
        wins: won ? 1 : 0,
        losses: won ? 0 : 1,
        draws: 0,
      },
      update: {
        elo: updated,
        ...(won ? { wins: { increment: 1 } } : { losses: { increment: 1 } }),
      },
    });
  });

  await prisma.$transaction(updates);
}

export async function getLeaderboard(limit = 20) {
  return prisma.playerRating.findMany({
    orderBy: { elo: "desc" },
    take: limit,
  });
}

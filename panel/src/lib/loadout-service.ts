import { prisma } from "./prisma";

export async function getLoadoutBody(steamid64: string) {
  const row = await prisma.loadout.findUnique({ where: { steamid64 } });
  if (!row) {
    return null;
  }
  try {
    return { body: JSON.parse(row.body) as unknown, updatedAt: row.updatedAt };
  } catch {
    return null;
  }
}

export async function saveLoadout(steamid64: string, body: unknown) {
  const json = JSON.stringify(body);
  await prisma.loadout.upsert({
    where: { steamid64 },
    create: { steamid64, body: json },
    update: { body: json },
  });
}

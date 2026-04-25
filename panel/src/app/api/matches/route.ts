import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const matches = await prisma.match.findMany({
    where: {
      status: "finished",
    },
    include: {
      players: {
        include: {
          // Precisamos dos nomes/avatares dos users
        }
      }
    },
    orderBy: {
      startedAt: "desc",
    },
    take: 50,
  });

  // Para cada player, buscar o user correspondente (já que MatchPlayer não tem relação direta no Prisma schema com User, ah espera, tem?)
  // Schema: MatchPlayer { matchId, steamid64, ... } -> User { steamid64, ... }
  // O schema.prisma não tem relação MatchPlayer -> User. Vou adicionar ou fazer o join manual.
  
  const matchesWithUsers = await Promise.all(matches.map(async (m) => {
    const playersWithUsers = await Promise.all(m.players.map(async (p) => {
      const user = await prisma.user.findUnique({ where: { steamid64: p.steamid64 } });
      return { ...p, user };
    }));
    return { ...m, players: playersWithUsers };
  }));

  return NextResponse.json({ matches: matchesWithUsers });
}

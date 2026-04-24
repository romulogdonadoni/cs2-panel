import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildMatchZyConfig } from "@/lib/match-service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const match = await prisma.match.findUnique({
    where: { id },
    include: { lobby: true }
  });

  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const team1Players = await prisma.matchPlayer.findMany({
    where: { matchId: id, team: 1 }
  });
  const team2Players = await prisma.matchPlayer.findMany({
    where: { matchId: id, team: 2 }
  });

  const config = buildMatchZyConfig(
    match.id,
    match.lobbyId,
    match.mapId,
    match.team1Name,
    match.team2Name,
    match.lobby.settingsJson
  );

  // Preencher os players no config
  team1Players.forEach((p: any) => {
    (config.team1.players as any)[p.steamid64] = "";
  });
  team2Players.forEach((p: any) => {
    (config.team2.players as any)[p.steamid64] = "";
  });

  return NextResponse.json(config);
}

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getLobbyByCodeRaw, startMatch, getPublicIp } from "@/lib/lobby-service";
import { launchMatch } from "@/lib/match-service";
import { readServerEnvFile } from "@/lib/envfile";
import { getComposeDir } from "@/lib/panel-constants";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { code } = await params;
  const lobby = await getLobbyByCodeRaw(code);
  if (!lobby) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    // 1. Valida e muda status do lobby para "live"
    const updated = await startMatch(lobby, s.steamid64);

    // 2. Separa jogadores por time
    const team1 = lobby.members.filter((m) => m.team === 1).map((m) => m.steamid64);
    const team2 = lobby.members.filter((m) => m.team === 2).map((m) => m.steamid64);

    // 3. Cria registro de partida + envia config MatchZy via RCON
    const match = await launchMatch(
      lobby.id,
      lobby.mapId,
      lobby.team1Name,
      lobby.team2Name,
      team1,
      team2
    );

    // 4. Monta connect string para o cliente
    const ip = await getPublicIp();
    const env = readServerEnvFile(getComposeDir());
    const port = "27015";
    const pw = env.CS2_PW || "";
    const connectCmd = `connect ${ip}:${port}${pw ? `; password ${pw}` : ""}`;

    return NextResponse.json({ lobby: updated, match, connectCmd });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const lobby = await getLobbyByCodeRaw(code);
  if (!lobby) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (lobby.status !== "live") {
    return NextResponse.json({ live: false });
  }

  const ip = await getPublicIp();
  const env = readServerEnvFile(getComposeDir());
  const pw = env.CS2_PW || "";
  const connectCmd = `connect ${ip}:27015${pw ? `; password ${pw}` : ""}`;

  return NextResponse.json({ live: true, connectCmd });
}

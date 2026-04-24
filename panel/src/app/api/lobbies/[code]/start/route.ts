import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getLobbyByCodeRaw, startMatch, getPublicIp, cancelLiveLobby } from "@/lib/lobby-service";
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

  const ip = await getPublicIp();
  const env = readServerEnvFile(getComposeDir());
  const port = "27015";
  const pw = env.CS2_PW || "";
  const connectCmd = `connect ${ip}:${port}${pw ? `; password ${pw}` : ""}`;

  try {
    const start = await startMatch(lobby, s.steamid64);

    if (start.kind === "already_live") {
      return NextResponse.json({ lobby: start.lobby, connectCmd, idempotent: true });
    }

    const L = start.lobby;
    const team1 = L.members.filter((m: any) => m.team === 1).map((m: any) => m.steamid64);
    const team2 = L.members.filter((m: any) => m.team === 2).map((m: any) => m.steamid64);

    try {
      const match = await launchMatch(
        L.id,
        L.mapId,
        L.team1Name,
        L.team2Name,
        team1,
        team2,
        L.settingsJson
      );
      return NextResponse.json({ lobby: L, match, connectCmd });
    } catch (launchErr: any) {
      await cancelLiveLobby(L);
      return NextResponse.json(
        { error: launchErr?.message ?? "falha ao lançar partida" },
        { status: 400 }
      );
    }
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

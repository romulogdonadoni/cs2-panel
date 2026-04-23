import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getPanelBaseUrl } from "@/lib/panel-constants";
import type { LobbySettings } from "@/lib/lobby-types";
import { getLobbyByCodeRaw, updateLobbyLeader } from "@/lib/lobby-service";
import { jsonLobby } from "@/lib/lobby-json";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const s = await getSession();
  if (!s) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { code } = await params;
  const lobby0 = await getLobbyByCodeRaw(code);
  if (!lobby0) {
    return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  }
  let patch: {
    team1Name?: string;
    team2Name?: string;
    mapId?: string;
    gameMode?: string;
    region?: string;
    maxPerTeam?: number;
    settings?: LobbySettings;
  } = {};
  try {
    patch = (await request.json()) as typeof patch;
  } catch {
    return NextResponse.json({ error: "json inválido" }, { status: 400 });
  }
  let lobby;
  try {
    lobby = await updateLobbyLeader(lobby0, s.steamid64, patch);
  } catch {
    return NextResponse.json({ error: "só o líder" }, { status: 403 });
  }
  return NextResponse.json({ lobby: jsonLobby(lobby, getPanelBaseUrl()) });
}

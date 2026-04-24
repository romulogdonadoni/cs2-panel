import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPanelBaseUrl } from "@/lib/panel-constants";
import { ensureSingletonLobby, SINGLETON_LOBBY_CODE } from "@/lib/lobby-service";
import { jsonLobby } from "@/lib/lobby-json";

/**
 * Uma única sala (alinhada a um VM/servidor). Estado da partida = `lobby.status` (open | live).
 */
export async function GET() {
  const s = await getSession();
  if (!s) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const lobby = await ensureSingletonLobby(s.steamid64);
  const baseUrl = getPanelBaseUrl();
  return NextResponse.json({
    lobby: jsonLobby(lobby, baseUrl),
    baseUrl,
    singletonCode: SINGLETON_LOBBY_CODE,
  });
}

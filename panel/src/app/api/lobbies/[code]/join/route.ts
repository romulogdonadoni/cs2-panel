import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getPanelBaseUrl } from "@/lib/panel-constants";
import { getLobbyByCodeRaw, getLobbyById, joinLobby } from "@/lib/lobby-service";
import { jsonLobby } from "@/lib/lobby-json";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const s = await getSession();
  if (!s) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { code } = await params;
  const lobby = await getLobbyByCodeRaw(code);
  if (!lobby) {
    return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  }
  await joinLobby(lobby.id, s.steamid64);
  const up = await getLobbyById(lobby.id);
  if (!up) {
    return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  }
  const baseUrl = getPanelBaseUrl();
  return NextResponse.json({ lobby: jsonLobby(up, baseUrl), baseUrl });
}

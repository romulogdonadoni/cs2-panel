import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getPanelBaseUrl } from "@/lib/panel-constants";
import { getLobbyByCodeRaw, getLobbyById, kickMember } from "@/lib/lobby-service";
import { jsonLobby } from "@/lib/lobby-json";

export async function POST(
  request: NextRequest,
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
  if (lobby.leaderSteamid64 !== s.steamid64) {
    return NextResponse.json({ error: "só o líder" }, { status: 403 });
  }
  let body: { steamid64?: string } = {};
  try {
    body = (await request.json()) as { steamid64?: string };
  } catch {
    return NextResponse.json({ error: "json" }, { status: 400 });
  }
  if (!body.steamid64 || !/^\d{17}$/.test(body.steamid64)) {
    return NextResponse.json({ error: "steamid64" }, { status: 400 });
  }
  await kickMember(lobby.id, body.steamid64);
  const up = await getLobbyById(lobby.id);
  if (!up) {
    return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, lobby: jsonLobby(up, getPanelBaseUrl()) });
}

import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getPanelBaseUrl } from "@/lib/panel-constants";
import { getLobbyByCodeRaw, isMember, setMemberReady, setMemberTeam } from "@/lib/lobby-service";
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
  const lobby = await getLobbyByCodeRaw(code);
  if (!lobby) {
    return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  }
  if (!(await isMember(lobby.id, s.steamid64))) {
    return NextResponse.json({ error: "não estás na lobby" }, { status: 403 });
  }
  let body: { team?: number; isReady?: boolean } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json inválido" }, { status: 400 });
  }
  if (body.team !== undefined) {
    const r = await setMemberTeam(lobby.id, s.steamid64, body.team, lobby.maxPerTeam);
    if (!r.ok) {
      return NextResponse.json({ error: r.error }, { status: 400 });
    }
  }
  if (body.isReady !== undefined) {
    await setMemberReady(lobby.id, s.steamid64, body.isReady);
  }
  const up = await getLobbyByCodeRaw(code);
  if (!up) {
    return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ lobby: jsonLobby(up, getPanelBaseUrl()), baseUrl: getPanelBaseUrl() });
}

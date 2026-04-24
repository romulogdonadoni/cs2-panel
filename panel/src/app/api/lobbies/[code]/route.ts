import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getPanelBaseUrl } from "@/lib/panel-constants";
import { deleteLobby, getLobbyByCodeRaw, SINGLETON_LOBBY_CODE } from "@/lib/lobby-service";
import { jsonLobby } from "@/lib/lobby-json";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const lobby = await getLobbyByCodeRaw(code);
  if (!lobby) {
    return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  }
  const baseUrl = getPanelBaseUrl();
  return NextResponse.json({ lobby: jsonLobby(lobby, baseUrl), baseUrl });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const s = await getSession();
  if (!s) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { code } = await params;
  if (code.toUpperCase() === SINGLETON_LOBBY_CODE) {
    return NextResponse.json(
      { error: "A sala do servidor é única; não podes apagá-la. Usa o painel." },
      { status: 400 }
    );
  }
  const lobby = await getLobbyByCodeRaw(code);
  if (!lobby) {
    return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  }
  try {
    await deleteLobby(lobby, s.steamid64);
  } catch {
    return NextResponse.json({ error: "só o líder" }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}

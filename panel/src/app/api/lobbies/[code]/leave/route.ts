import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getLobbyByCodeRaw, leaveLobby } from "@/lib/lobby-service";

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
  if (lobby.leaderSteamid64 === s.steamid64) {
    return NextResponse.json({ error: "líder deve excluir a lobby" }, { status: 400 });
  }
  await leaveLobby(lobby.id, s.steamid64);
  return NextResponse.json({ ok: true });
}

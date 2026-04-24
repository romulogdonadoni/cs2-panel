import { NextResponse, type NextRequest } from "next/server";
import { getFaceitCs2ForSteamIds, faceitApiConfigured, type FaceitCs2Public } from "@/lib/faceit";
import { getLobbyByCodeRaw } from "@/lib/lobby-service";

export type FaceitLobbyGetResponse = {
  available: boolean;
  faceit: Record<string, FaceitCs2Public | null>;
};

/**
 * Dados FACEIT (Elo / level CS2) para os membros do lobby, por SteamID64.
 * Requer FACEIT_API_KEY no painel. Sem chave, `available` é false e `faceit` fica vazio.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const lobby = await getLobbyByCodeRaw(code);
  if (!lobby) {
    return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  }

  if (!faceitApiConfigured()) {
    const body: FaceitLobbyGetResponse = { available: false, faceit: {} };
    return NextResponse.json(body);
  }

  const ids = lobby.members.map((m) => m.steamid64);
  const faceit = await getFaceitCs2ForSteamIds(ids);
  const body: FaceitLobbyGetResponse = { available: true, faceit };
  return NextResponse.json(body);
}

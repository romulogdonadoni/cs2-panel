import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getLobbyByCodeRaw, cancelLiveLobby } from "@/lib/lobby-service";
import { endMatchOnServer } from "@/lib/match-service";
import { parseSettings } from "@/lib/lobby-types";

/**
 * Líder cancela a partida no CS2 (MatchZy `css_endmatch`) e repõe o lobby em "open".
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { code } = await params;
  const lobby = await getLobbyByCodeRaw(code);
  if (!lobby) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (lobby.status !== "live") {
    return NextResponse.json({ error: "não há partida ativa neste lobby", lobby }, { status: 400 });
  }

  if (lobby.leaderSteamid64 !== s.steamid64) {
    return NextResponse.json({ error: "só o líder pode cancelar" }, { status: 403 });
  }

  try {
    const training = parseSettings(lobby.settingsJson).serverMode === "training";
    await endMatchOnServer({ training });
  } catch (e: any) {
    console.error("[Cancel] RCON fim de sessão falhou:", e);
    return NextResponse.json(
      { error: e?.message || "não foi possível contactar o servidor (RCON). Tente de novo." },
      { status: 502 }
    );
  }

  try {
    const updated = await cancelLiveLobby(lobby);
    return NextResponse.json({ ok: true, lobby: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "falha ao atualizar o lobby" }, { status: 500 });
  }
}

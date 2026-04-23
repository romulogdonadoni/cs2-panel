import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import {
  loadPlayerSkins,
  loadPlayerKnife,
  loadPlayerGloves,
  loadPlayerAgents,
} from "@/lib/weaponpaints-db";

// GET /api/skins — retorna todas as skins do jogador logado
export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const steamid = session.steamid64;

  const [skins, knives, gloves, agents] = await Promise.all([
    loadPlayerSkins(steamid),
    loadPlayerKnife(steamid),
    loadPlayerGloves(steamid),
    loadPlayerAgents(steamid),
  ]);

  return NextResponse.json({ skins, knives, gloves, agents });
}

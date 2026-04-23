import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { savePlayerKnife, savePlayerGloves, savePlayerAgents } from "@/lib/weaponpaints-db";

/**
 * POST /api/skins/extras
 * Body: {
 *   knife_ct?: string,   ex: "weapon_m9_bayonet"
 *   knife_t?: string,
 *   glove_ct?: number,   weapon_defindex da luva
 *   glove_t?: number,
 *   agent_ct?: string,   ex: "ctm_fbi.fbi_hrt"
 *   agent_t?: string,
 * }
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const steamid = session.steamid64;
  const tasks: Promise<void>[] = [];

  // Faca CT (team 1)
  if (typeof body.knife_ct === "string" && body.knife_ct) {
    tasks.push(savePlayerKnife(steamid, 1, body.knife_ct));
  }
  // Faca T (team 2)
  if (typeof body.knife_t === "string" && body.knife_t) {
    tasks.push(savePlayerKnife(steamid, 2, body.knife_t));
  }
  // Luva CT
  if (typeof body.glove_ct === "number" && body.glove_ct > 0) {
    tasks.push(savePlayerGloves(steamid, 1, body.glove_ct));
  }
  // Luva T
  if (typeof body.glove_t === "number" && body.glove_t > 0) {
    tasks.push(savePlayerGloves(steamid, 2, body.glove_t));
  }
  // Agentes
  if (body.agent_ct !== undefined || body.agent_t !== undefined) {
    tasks.push(
      savePlayerAgents(
        steamid,
        typeof body.agent_ct === "string" ? body.agent_ct : null,
        typeof body.agent_t === "string" ? body.agent_t : null
      )
    );
  }

  await Promise.all(tasks);
  return NextResponse.json({ ok: true });
}

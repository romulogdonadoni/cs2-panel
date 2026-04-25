import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import {
  savePlayerSkin,
  savePlayerKnife,
  savePlayerGloves,
  removePlayerSkin,
  clearPlayerGlovesSkins,
  clearPlayerKnivesSkins,
  type WpSkinRow,
} from "@/lib/weaponpaints-db";
import { KNIFE_DEFINDEX_TO_CLASSNAME } from "@/lib/knife-classnames";

// Defindexes de luvas (para wp_player_gloves)
const GLOVE_DEFINDEXES = new Set([4725, 5027, 5030, 5031, 5032, 5033, 5034, 5035]);

/**
 * POST /api/skins/weapon
 * Body: { weapon_defindex, weapon_paint_id, weapon_wear, weapon_seed,
 *         weapon_nametag?, weapon_stattrak?, weapon_team? }
 *
 * Se weapon_defindex for uma faca, também atualiza wp_player_knife
 * automaticamente para que o modelo correto seja equipado.
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

  const defindex = Number(body.weapon_defindex);
  const paintId  = Number(body.weapon_paint_id ?? 0);
  const wear     = Number(body.weapon_wear ?? 0.01);
  const seed     = Number(body.weapon_seed ?? 0);
  const team     = ([0, 2, 3].includes(Number(body.weapon_team)) ? Number(body.weapon_team) : 0) as 0 | 2 | 3;

  if (!Number.isInteger(defindex) || defindex <= 0) {
    return NextResponse.json({ error: "weapon_defindex inválido" }, { status: 400 });
  }

  const row: WpSkinRow = {
    steamid: session.steamid64,
    weapon_team: team,
    weapon_defindex: defindex,
    weapon_paint_id: paintId,
    weapon_wear: Math.min(1, Math.max(0.000001, wear)),
    weapon_seed: seed,
    weapon_nametag: typeof body.weapon_nametag === "string" ? body.weapon_nametag : null,
    weapon_stattrak: body.weapon_stattrak ? 1 : 0,
    weapon_stattrak_count: 0,
  };

  const knifeClassname = KNIFE_DEFINDEX_TO_CLASSNAME[defindex];
  const tasks: Promise<void>[] = [];

  if (team === 0) {
    [2, 3].forEach((t) => {
      if (knifeClassname) tasks.push(clearPlayerKnivesSkins(session.steamid64, t as 2 | 3));
      if (GLOVE_DEFINDEXES.has(defindex)) tasks.push(clearPlayerGlovesSkins(session.steamid64, t as 2 | 3));
    });
    [2, 3].forEach((t) => {
      tasks.push(savePlayerSkin({ ...row, weapon_team: t as 2 | 3 }));
      if (knifeClassname) tasks.push(savePlayerKnife(session.steamid64, t as 2 | 3, knifeClassname));
      if (GLOVE_DEFINDEXES.has(defindex)) tasks.push(savePlayerGloves(session.steamid64, t as 2 | 3, defindex, paintId, wear, seed));
    });
  } else {
    if (knifeClassname) tasks.push(clearPlayerKnivesSkins(session.steamid64, team));
    if (GLOVE_DEFINDEXES.has(defindex)) tasks.push(clearPlayerGlovesSkins(session.steamid64, team));
    tasks.push(savePlayerSkin(row));
    if (knifeClassname) tasks.push(savePlayerKnife(session.steamid64, team, knifeClassname));
    if (GLOVE_DEFINDEXES.has(defindex)) tasks.push(savePlayerGloves(session.steamid64, team, defindex, paintId, wear, seed));
  }

  await Promise.all(tasks);
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/skins/weapon
 * Body: { weapon_defindex, weapon_team? }
 */
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const defindex = Number(body.weapon_defindex);
  const team = ([0, 2, 3].includes(Number(body.weapon_team)) ? Number(body.weapon_team) : 0) as 0 | 2 | 3;

  await removePlayerSkin(session.steamid64, team, defindex);
  return NextResponse.json({ ok: true });
}

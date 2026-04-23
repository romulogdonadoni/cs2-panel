/**
 * POST /api/skins/stickers
 * Salva stickers e/ou keychain de UMA arma específica.
 *
 * Formato WeaponPaints:
 *   sticker:  "sticker_id;wear;x;y;zoom;rotation;0"
 *   keychain: "keychain_id;seed;float;0;0"
 *
 * Body:
 * {
 *   weapon_defindex: number,
 *   weapon_team: 0|1|2,           // default 0
 *   stickers?: (number|null)[],   // array de 5 itens (null = vazio)
 *   keychain?: number | null      // def_index do keychain, null = remover
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getWeaponPaintsDb } from "@/lib/weaponpaints-db";

const EMPTY_STICKER = "0;0;0;0;0;0;0";
const EMPTY_KEYCHAIN = "0;0;0;0;0";

function buildStickerStr(id: number | null, wear: number = 0): string {
  if (!id) return EMPTY_STICKER;
  // wear=W, x=0, y=0, zoom=1, rotation=0, slot=0
  return `${id};${wear};0;0;1;0;0`;
}

function buildKeychainStr(id: number | null, seed: number = 0): string {
  if (!id) return EMPTY_KEYCHAIN;
  // seed=X, float=0, reserved=0, reserved=0
  return `${id};${seed};0;0;0`;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const steamid      = session.steamid64;
  const defindex     = Number(body.weapon_defindex);
  const team         = Number(body.weapon_team ?? 0);

  if (!defindex) return NextResponse.json({ error: "weapon_defindex required" }, { status: 400 });

  const db = getWeaponPaintsDb();

  // Verifica se a skin já está salva (precisa existir para atualizar stickers)
  const [rows] = await db.execute(
    "SELECT weapon_stattrak, weapon_wear, weapon_paint_id, weapon_seed, weapon_nametag, weapon_stattrak_count FROM wp_player_skins WHERE steamid=? AND weapon_team=? AND weapon_defindex=?",
    [steamid, team, defindex]
  ) as [Record<string, unknown>[], unknown];

  if (!rows.length) {
    return NextResponse.json({ error: "Salve a skin primeiro antes de adicionar stickers/keychain" }, { status: 404 });
  }

  const updates: string[] = [];
  const params: string[] = [];

  // Stickers (array de 5)
  if (Array.isArray(body.stickers)) {
    const arr = body.stickers as (number | null)[];
    const wearArr = Array.isArray(body.stickerWear) ? (body.stickerWear as number[]) : [];
    for (let i = 0; i < 5; i++) {
      const val = buildStickerStr(arr[i] ?? null, wearArr[i] ?? 0);
      updates.push(`weapon_sticker_${i} = ?`);
      params.push(val);
    }
  }

  // Keychain
  if ("keychain" in body) {
    updates.push("weapon_keychain = ?");
    const seed = Number(body.keychainSeed ?? 0);
    params.push(buildKeychainStr((body.keychain as number | null), seed));
  }

  if (updates.length === 0) {
    return NextResponse.json({ ok: true, message: "nothing to update" });
  }

  params.push(steamid, String(team), String(defindex));
  await db.execute(
    `UPDATE wp_player_skins SET ${updates.join(", ")} WHERE steamid=? AND weapon_team=? AND weapon_defindex=?`,
    params
  );

  return NextResponse.json({ ok: true });
}

/**
 * GET /api/skins/stickers?weapon_defindex=X
 * Retorna stickers/keychain atuais de uma arma
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const defindex = Number(req.nextUrl.searchParams.get("weapon_defindex"));
  const team = Number(req.nextUrl.searchParams.get("weapon_team") ?? 0);
  if (!defindex) return NextResponse.json({ error: "weapon_defindex required" }, { status: 400 });

  const db = getWeaponPaintsDb();
  const [rows] = await db.execute(
    "SELECT weapon_sticker_0, weapon_sticker_1, weapon_sticker_2, weapon_sticker_3, weapon_sticker_4, weapon_keychain FROM wp_player_skins WHERE steamid=? AND weapon_team=? AND weapon_defindex=?",
    [session.steamid64, team, defindex]
  ) as [Record<string, string>[], unknown];

  if (!rows.length) return NextResponse.json({ stickers: [null,null,null,null,null], keychain: null });

  const r = rows[0]!;

  // Parse: "id;wear;x;y;zoom;rot;0" → { id, wear }
  function parseStickerStr(s: string): { id: number | null; wear: number } {
    const parts = s.split(";");
    const id = parseInt(parts[0] ?? "0", 10);
    const wear = parseFloat(parts[1] ?? "0");
    return { id: id > 0 ? id : null, wear };
  }
  function parseKeychainStr(s: string): { id: number | null; seed: number } {
    const parts = s.split(";");
    const id = parseInt(parts[0] ?? "0", 10);
    const seed = parseInt(parts[1] ?? "0", 10);
    return { id: id > 0 ? id : null, seed };
  }

  const kc = parseKeychainStr(r.weapon_keychain ?? "0");

  const stickers = [
    parseStickerStr(r.weapon_sticker_0 ?? "0"),
    parseStickerStr(r.weapon_sticker_1 ?? "0"),
    parseStickerStr(r.weapon_sticker_2 ?? "0"),
    parseStickerStr(r.weapon_sticker_3 ?? "0"),
    parseStickerStr(r.weapon_sticker_4 ?? "0"),
  ];

  return NextResponse.json({
    stickers: stickers.map(s => s.id),
    sticker_wear: stickers.map(s => s.wear),
    keychain: kc.id,
    keychain_seed: kc.seed,
  });
}

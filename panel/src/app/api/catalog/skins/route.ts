import { NextRequest, NextResponse } from "next/server";
import * as cat from "@/lib/catalog";
import { getDataDir } from "@/lib/panel-constants";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const filter = searchParams.get("filter") || "all";
  const q = searchParams.get("q") || "";
  const weaponDefRaw = searchParams.get("weapon_defindex");
  const weaponDefindex =
    weaponDefRaw != null && weaponDefRaw !== ""
      ? Number.parseInt(weaponDefRaw, 10)
      : NaN;
  const weaponDef =
    Number.isFinite(weaponDefindex) && weaponDefindex > 0 ? weaponDefindex : null;
  const offset = Math.max(0, Number.parseInt(searchParams.get("offset") || "0", 10) || 0);
  const limit = Math.min(10000, Math.max(1, Number.parseInt(searchParams.get("limit") || "48", 10) || 48));
  try {
    const all = await cat.loadSkinsData(getDataDir());
    const filtered = cat.filterSkins(all, filter, q, weaponDef);
    const total = filtered.length;
    const slice = cat.paginate(filtered, offset, limit);
    const items = slice.map((s) => ({
      id: s.id,
      name: s.name,
      image: s.image,
      paint_index: s.paint_index,
      weapon: s.weapon,
      category: s.category,
      rarity: s.rarity,
      min_float: s.min_float,
      max_float: s.max_float,
      stattrak: s.stattrak,
    }));
    return NextResponse.json({ items, total, offset, limit });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg, items: [], total: 0, offset, limit }, { status: 502 });
  }
}

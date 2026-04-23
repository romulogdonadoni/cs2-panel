import { NextRequest, NextResponse } from "next/server";
import * as cat from "@/lib/catalog";
import { getDataDir } from "@/lib/panel-constants";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q") || "";
  const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10) || 0);
  const limit  = Math.min(96, Math.max(1, parseInt(searchParams.get("limit") || "48", 10) || 48));
  try {
    const all = await cat.loadStickersData(getDataDir());
    const filtered = cat.filterStickers(all, q);
    const total = filtered.length;
    const items = cat.paginate(filtered, offset, limit).map(s => ({
      id: s.id,
      name: s.name,
      image: s.image,
      def_index: s.def_index,
      rarity: s.rarity,
    }));
    return NextResponse.json({ items, total, offset, limit });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg, items: [], total: 0 }, { status: 502 });
  }
}

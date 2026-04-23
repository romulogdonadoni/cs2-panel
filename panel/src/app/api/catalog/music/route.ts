import { NextRequest, NextResponse } from "next/server";
import * as cat from "@/lib/catalog";
import { getDataDir } from "@/lib/panel-constants";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q") || "";
  const offset = Math.max(0, Number.parseInt(searchParams.get("offset") || "0", 10) || 0);
  const limit = Math.min(120, Math.max(1, Number.parseInt(searchParams.get("limit") || "60", 10) || 60));
  try {
    const all = await cat.loadMusicData(getDataDir());
    const filtered = cat.filterMusic(all, q);
    const total = filtered.length;
    const slice = cat.paginate(filtered, offset, limit);
    const items = slice.map((m) => ({
      id: m.id,
      name: m.name,
      image: m.image,
      def_index: m.def_index,
    }));
    return NextResponse.json({ items, total, offset, limit });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg, items: [], total: 0, offset, limit }, { status: 502 });
  }
}

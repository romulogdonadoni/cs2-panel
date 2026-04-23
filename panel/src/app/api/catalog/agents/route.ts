import { NextRequest, NextResponse } from "next/server";
import * as cat from "@/lib/catalog";
import { getDataDir } from "@/lib/panel-constants";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const team = searchParams.get("team") || "all";
  const q = searchParams.get("q") || "";
  const offset = Math.max(0, Number.parseInt(searchParams.get("offset") || "0", 10) || 0);
  const limit = Math.min(10000, Math.max(1, Number.parseInt(searchParams.get("limit") || "48", 10) || 48));
  try {
    const all = await cat.loadAgentsData(getDataDir());
    const filtered = cat.filterAgents(all, team, q);
    const total = filtered.length;
    const slice = cat.paginate(filtered, offset, limit);
    const items = slice.map((a) => ({
      id: a.id,
      name: a.name,
      image: a.image,
      def_index: a.def_index,
      model_player: a.model_player ?? null, // campo crítico para WeaponPaints
      team: a.team,
      rarity: a.rarity,
    }));
    return NextResponse.json({ items, total, offset, limit });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg, items: [], total: 0, offset, limit }, { status: 502 });
  }
}

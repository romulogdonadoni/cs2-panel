import { NextResponse, type NextRequest } from "next/server";
import { loadMusicData, filterMusic } from "@/lib/catalog";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  
  const dataDir = process.env.PANEL_DATA_DIR || "/data";
  try {
    const all = await loadMusicData(dataDir);
    const filtered = filterMusic(all, q);
    return NextResponse.json({ items: filtered, total: filtered.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

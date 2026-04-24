import { NextResponse, type NextRequest } from "next/server";
import { loadPinsData, filterPins } from "@/lib/catalog";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  
  const dataDir = process.env.PANEL_DATA_DIR || "/data";
  try {
    const all = await loadPinsData(dataDir);
    const filtered = filterPins(all, q);
    return NextResponse.json({ items: filtered, total: filtered.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

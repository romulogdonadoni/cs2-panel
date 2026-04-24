import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { loadPlayerPins, savePlayerPin } from "@/lib/weaponpaints-db";
import { loadPinsData } from "@/lib/catalog";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await loadPlayerPins(session.steamid64);
  
  const dataDir = process.env.PANEL_DATA_DIR || "/data";
  const allPins = await loadPinsData(dataDir).catch(() => []);

  const pinsInfo = rows.map(r => {
    const item = allPins.find(x => x.def_index === String(r.id));
    return item ? { id: r.id, name: item.name, image: item.image, team: r.weapon_team } : { id: r.id, team: r.weapon_team };
  });

  return NextResponse.json({ pins: pinsInfo });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const pinId = Number(body.pin_id);
  const team = Number(body.weapon_team ?? 0) as 0 | 2 | 3;

  if (team === 0) {
    await Promise.all([
      savePlayerPin(session.steamid64, 2, pinId),
      savePlayerPin(session.steamid64, 3, pinId),
    ]);
  } else {
    await savePlayerPin(session.steamid64, team, pinId);
  }

  return NextResponse.json({ ok: true });
}

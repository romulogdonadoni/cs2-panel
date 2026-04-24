import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { loadPlayerMusic, savePlayerMusic } from "@/lib/weaponpaints-db";
import { loadMusicData } from "@/lib/catalog";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await loadPlayerMusic(session.steamid64);
  
  const dataDir = process.env.PANEL_DATA_DIR || "/data";
  const allMusic = await loadMusicData(dataDir).catch(() => []);

  const musicInfo = rows.map(r => {
    const item = allMusic.find(x => x.def_index === String(r.music_id));
    return item ? { id: r.music_id, name: item.name, image: item.image, team: r.weapon_team } : { id: r.music_id, team: r.weapon_team };
  });

  return NextResponse.json({ music: musicInfo });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const musicId = Number(body.music_id);
  const team = Number(body.weapon_team ?? 0) as 0 | 2 | 3;

  if (team === 0) {
    await Promise.all([
      savePlayerMusic(session.steamid64, 2, musicId),
      savePlayerMusic(session.steamid64, 3, musicId),
    ]);
  } else {
    await savePlayerMusic(session.steamid64, team, musicId);
  }

  return NextResponse.json({ ok: true });
}

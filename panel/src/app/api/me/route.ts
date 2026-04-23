import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSteamPlayerSummary } from "@/lib/steam-summaries";

export async function GET() {
  const s = await getSession();
  if (!s) {
    return NextResponse.json({ user: null });
  }
  const p = await getSteamPlayerSummary(s.steamid64);
  const { readServerEnvFile } = await import("@/lib/envfile");
  const { getComposeDir } = await import("@/lib/panel-constants");
  const { isAdmin } = await import("@/lib/panel-helpers");
  
  const env = readServerEnvFile(getComposeDir());
  const admin = isAdmin(s.steamid64, env);

  return NextResponse.json({
    user: {
      steamid64: s.steamid64,
      name: p.personaname,
      avatar: p.avatarfull,
      profileUrl: p.profileurl,
    },
    isAdmin: admin,
  });
}

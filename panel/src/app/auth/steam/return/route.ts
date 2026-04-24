import { NextRequest, NextResponse } from "next/server";
import { verifySteamOpenIdCallback } from "@/lib/steam";
import { newSession } from "@/lib/session-crypto";
import { COOKIE } from "@/lib/auth";
import { getPanelBaseUrl } from "@/lib/panel-constants";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    return new NextResponse("SESSION_SECRET not configured", { status: 500 });
  }
  const usp = request.nextUrl.searchParams;
  const steamid = await verifySteamOpenIdCallback(usp);
  if (!steamid) {
    return NextResponse.redirect(new URL("/?err=auth", getPanelBaseUrl()));
  }

  // Fetch Steam Profile
  const steamApiKey = process.env.STEAM_WEB_API_KEY;
  let name = `SteamUser_${steamid.slice(-5)}`;
  let avatar = "https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg"; // default

  if (steamApiKey) {
    try {
      const pUrl = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${steamApiKey}&steamids=${steamid}`;
      const pr = await fetch(pUrl);
      const pj = await pr.json();
      const player = pj?.response?.players?.[0];
      if (player) {
        name = player.personaname || name;
        avatar = player.avatarfull || avatar;
      }
    } catch (err) {
      console.error("Falha ao buscar perfil Steam:", err);
    }
  }

  // Upsert user in DB
  try {
    await prisma.user.upsert({
      where: { steamid64: steamid },
      update: { name, avatar },
      create: { steamid64: steamid, name, avatar },
    });
  } catch (err) {
    console.error("Falha ao salvar user no BD:", err);
  }

  const token = newSession(steamid, secret);
  const res = NextResponse.redirect(new URL("/", getPanelBaseUrl()));
  res.cookies.set(COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}

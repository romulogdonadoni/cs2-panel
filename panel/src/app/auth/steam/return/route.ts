import { NextRequest, NextResponse } from "next/server";
import { verifySteamOpenIdCallback } from "@/lib/steam";
import { newSession } from "@/lib/session-crypto";
import { COOKIE } from "@/lib/auth";
import { getPanelBaseUrl } from "@/lib/panel-constants";

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

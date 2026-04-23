import { NextResponse } from "next/server";
import { getSteamLoginRedirectUrl } from "@/lib/steam";
import { baseOpenIdRealm, steamReturnToUrl } from "@/lib/panel-constants";

export function GET() {
  if (!process.env.SESSION_SECRET) {
    return new NextResponse("SESSION_SECRET not configured", { status: 500 });
  }
  const u = getSteamLoginRedirectUrl(baseOpenIdRealm(), steamReturnToUrl());
  return NextResponse.redirect(u);
}

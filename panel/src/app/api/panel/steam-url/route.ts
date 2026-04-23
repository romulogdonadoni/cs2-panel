import { NextResponse } from "next/server";
import { getPanelBaseUrl } from "@/lib/panel-constants";

export function GET() {
  return NextResponse.json({ url: `${getPanelBaseUrl()}/auth/steam` });
}

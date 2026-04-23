import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getComposeDir } from "@/lib/panel-constants";
import { readServerEnvFile, writeServerEnvFile } from "@/lib/envfile";
import { isAdmin, maskServerEnvForUi } from "@/lib/panel-helpers";

export async function GET() {
  const s = await getSession();
  if (!s) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const e = readServerEnvFile(getComposeDir());
  if (!isAdmin(s.steamid64, e)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return NextResponse.json({ env: maskServerEnvForUi(e) });
}

export async function PUT(request: Request) {
  const s = await getSession();
  if (!s) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const e0 = readServerEnvFile(getComposeDir());
  if (!isAdmin(s.steamid64, e0)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let body: { updates?: Record<string, string> };
  try {
    body = (await request.json()) as { updates?: Record<string, string> };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.updates || typeof body.updates !== "object") {
    return NextResponse.json({ error: "updates required" }, { status: 400 });
  }
  const e = { ...e0, ...body.updates };
  if (e.SRCDS_TOKEN?.includes("*")) {
    e.SRCDS_TOKEN = e0.SRCDS_TOKEN ?? e.SRCDS_TOKEN;
  }
  if (e.LOADOUT_API_KEY === "********" || e.LOADOUT_API_KEY === "") {
    e.LOADOUT_API_KEY = e0.LOADOUT_API_KEY ?? e.LOADOUT_API_KEY;
  }
  if (e.SESSION_SECRET === "********" || e.SESSION_SECRET === "") {
    e.SESSION_SECRET = e0.SESSION_SECRET ?? e.SESSION_SECRET;
  }
  writeServerEnvFile(getComposeDir(), e);
  return NextResponse.json({ ok: true, env: maskServerEnvForUi(readServerEnvFile(getComposeDir())) });
}

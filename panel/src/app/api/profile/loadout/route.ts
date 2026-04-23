import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getLoadoutBody, saveLoadout } from "@/lib/loadout-service";

export async function GET() {
  const s = await getSession();
  if (!s) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const row = await getLoadoutBody(s.steamid64);
  return NextResponse.json({
    body: row?.body ?? { version: 1, slots: {} },
    updated_at: row ? row.updatedAt.getTime() : 0,
  });
}

export async function PUT(request: Request) {
  const s = await getSession();
  if (!s) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (typeof raw !== "object" || raw === null) {
    return NextResponse.json({ error: "object required" }, { status: 400 });
  }
  await saveLoadout(s.steamid64, { ...(raw as object), version: 1 });
  return NextResponse.json({ ok: true });
}

import { NextResponse, type NextRequest } from "next/server";
import { getLoadoutBody } from "@/lib/loadout-service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ steamid64: string }> }
) {
  const key = process.env.LOADOUT_API_KEY;
  if (!key || _req.headers.get("X-API-Key") !== key) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const { steamid64: sid } = await params;
  if (!/^\d{17}$/.test(sid)) {
    return new NextResponse("Invalid steamid", { status: 400 });
  }
  const row = await getLoadoutBody(sid);
  const raw = row?.body ?? { version: 1, slots: {} as Record<string, unknown> };
  const body = typeof raw === "object" && raw !== null ? { ...raw } : { version: 1, slots: {} };
  const o = body as Record<string, unknown>;
  o["version"] = 1;
  o["steamid64"] = sid;
  return NextResponse.json(o);
}

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPanelBaseUrl } from "@/lib/panel-constants";
import { createLobby } from "@/lib/lobby-service";
import { jsonLobby } from "@/lib/lobby-json";

export async function POST(request: Request) {
  const s = await getSession();
  if (!s) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { team1Name?: string; team2Name?: string; mapId?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    /* empty */
  }
  const lobby = await createLobby(s.steamid64, body);
  const baseUrl = getPanelBaseUrl();
  return NextResponse.json({ lobby: jsonLobby(lobby, baseUrl), baseUrl });
}

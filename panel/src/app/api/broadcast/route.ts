import { NextResponse } from "next/server";
import { getMatchzyScoreboard } from "@/lib/matchzy-scoreboard-store";
import type { BroadcastGetResponse } from "@/lib/broadcast-types";

export const dynamic = "force-dynamic";

/**
 * Placar para browsers/OBS: último `round_end` / `map_result` do MatchZy (webhook do servidor).
 */
export async function GET() {
  const mz = getMatchzyScoreboard();

  if (mz) {
    return NextResponse.json({
      source: "matchzy",
      updatedAt: mz.updatedAt,
      hasData: true,
      view: mz.view,
    } satisfies BroadcastGetResponse);
  }

  return NextResponse.json({
    source: "none",
    updatedAt: 0,
    hasData: false,
    view: null,
  } satisfies BroadcastGetResponse);
}

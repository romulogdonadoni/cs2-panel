import { NextResponse } from "next/server";
import { ingestMatchZyEventBody } from "@/lib/matchzy-ingest";
import { matchzyWebhookAuthOk } from "@/lib/matchzy-webhook-auth";

export const dynamic = "force-dynamic";

/**
 * Todos os eventos MatchZy via `matchzy_remote_log_url` (POST).
 * Incl. `round_end` (scoreboard) e `map_result` (fim de mapa + DB).
 * @see https://shobhit-pathak.github.io/MatchZy/configuration/#matchzy_remote_log_url
 *
 * GET: smoke test (curl no servidor CS2) — só confirma que host/porta/rota existem; eventos vêm em POST.
 */

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "matchzy-events",
    message:
      "MatchZy envia POST JSON (event round_end, map_result, …). Configure matchzy_remote_log_url para esta URL. GET é só teste de conectividade.",
    doc: "https://shobhit-pathak.github.io/MatchZy/events.html",
  });
}

export async function POST(request: Request) {
  if (!matchzyWebhookAuthOk(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  try {
    await ingestMatchZyEventBody(body);
  } catch (e) {
    console.error("[MatchZy events]", e);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

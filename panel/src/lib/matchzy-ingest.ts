import { matchZyEventToScoreboard } from "./matchzy-to-scoreboard";
import { clearMatchzyScoreboard, setMatchzyScoreboard } from "./matchzy-scoreboard-store";
import { processMapResultForDb } from "./matchzy-map-result-db";

/**
 * Recebe o JSON de um evento HTTP MatchZy (matchzy_remote_log_url ou legado com `event`).
 */
export async function ingestMatchZyEventBody(body: unknown) {
  if (!body || typeof body !== "object") {
    return;
  }
  const b = body as Record<string, unknown>;
  const ev = b.event;
  const now = Date.now();

  // Só limpa no início de nova série. `going_live` dispara noutros momentos e apagava o placar após o 1.º `round_end`.
  if (ev === "series_start") {
    clearMatchzyScoreboard();
  }

  if (ev === "round_end" || ev === "map_result") {
    const view = matchZyEventToScoreboard(b, now);
    if (view) {
      setMatchzyScoreboard(view);
    }
  }

  if (ev === "map_result") {
    await processMapResultForDb(b);
  }
}

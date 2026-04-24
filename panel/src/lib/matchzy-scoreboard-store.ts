/**
 * Último placar a partir de eventos MatchZy (round_end / map_result). Memória do processo Node.
 */

import type { ScoreboardSnapshot } from "./scoreboard-types";

type Entry = { view: ScoreboardSnapshot; updatedAt: number };

const store: { current: Entry | null } = { current: null };

export function setMatchzyScoreboard(view: ScoreboardSnapshot) {
  store.current = { view, updatedAt: Date.now() };
}

export function getMatchzyScoreboard(): Entry | null {
  return store.current;
}

export function clearMatchzyScoreboard() {
  store.current = null;
}

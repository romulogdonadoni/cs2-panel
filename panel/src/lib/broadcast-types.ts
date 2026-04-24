import type { ScoreboardSnapshot } from "./scoreboard-types";

export type BroadcastGetResponse = {
  source: "matchzy" | "none";
  updatedAt: number;
  hasData: boolean;
  view: ScoreboardSnapshot | null;
};

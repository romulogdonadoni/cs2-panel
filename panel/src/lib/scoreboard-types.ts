/**
 * Formato comum do placar (p.ex. eventos `round_end` do MatchZy convertidos no painel).
 */

export type ScoreboardPlayer = {
  key: string;
  name: string;
  team: "CT" | "T" | "SPEC";
  health: number;
  armor: number;
  money: number;
  kills: number;
  deaths: number;
  assists: number;
  alive: boolean;
  primaryWeapon: string;
  /** Pontos de scoreboard in-game, quando existirem */
  matchScore: number;
  mvps: number;
  /** Dano acumulado; ADR ≈ damage / rondas disputadas */
  damage: number;
  headshotKills: number;
};

export type ScoreboardSnapshot = {
  updatedAt: number;
  hasData: boolean;
  mapName: string;
  mode: string;
  phase: string;
  round: number;
  teamCt: { name?: string; score: number };
  teamT: { name?: string; score: number };
  /** Rondas concluídas (soma dos placares) — base para K/R e DMR */
  roundsPlayed: number;
  roundPhase?: string;
  bombState?: string;
  players: ScoreboardPlayer[];
};

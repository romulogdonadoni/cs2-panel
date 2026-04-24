/**
 * Converte `round_end` / `map_result` (MatchZy) para o formato do placar no painel.
 * @see https://shobhit-pathak.github.io/MatchZy/events.html
 */
import type { ScoreboardPlayer, ScoreboardSnapshot } from "./scoreboard-types";

function n(x: unknown): number {
  const v = Number(x);
  return Number.isFinite(v) ? v : 0;
}
function str(x: unknown, d = ""): string {
  return x != null ? String(x) : d;
}

function sideToTeam(
  s: unknown
): "CT" | "T" {
  const t = str(s, "").toLowerCase();
  if (t === "t" || t === "3") return "T";
  return "CT";
}

function playerRow(
  p: { steamid?: string; name?: string; stats?: Record<string, unknown> },
  team: "CT" | "T",
  keyPrefix: string
): ScoreboardPlayer {
  const st = p.stats && typeof p.stats === "object" ? p.stats as Record<string, unknown> : {};
  const k = n(st.kills);
  const mvp = n((st as { mvp?: unknown }).mvp) || n((st as { mvps?: unknown }).mvps);
  return {
    key: `${keyPrefix}:${String(p.steamid ?? p.name ?? "x")}`,
    name: str(p.name, "—"),
    team,
    health: 0,
    armor: 0,
    money: 0,
    kills: k,
    deaths: n(st.deaths),
    assists: n(st.assists),
    alive: true,
    primaryWeapon: "—",
    matchScore: n(st.score),
    mvps: mvp,
    damage: n(st.damage) || n((st as { dmg?: unknown }).dmg),
    headshotKills: n(st.headshot_kills) || n((st as { headshots?: unknown }).headshots),
  };
}

type MzTeam = {
  name?: string;
  score?: number;
  side?: string;
  players?: { steamid?: string; name?: string; stats?: Record<string, unknown> }[];
};

function teamsFromEvent(body: Record<string, unknown>): { t1: MzTeam; t2: MzTeam } {
  return {
    t1: (body.team1 as MzTeam) || {},
    t2: (body.team2 as MzTeam) || {},
  };
}

/**
 * Só gera `hasData: true` se tiver `team1`+`team2` com `players` ou scores.
 */
export function matchZyEventToScoreboard(
  body: unknown,
  updatedAt: number
): ScoreboardSnapshot | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const ev = str(b.event, "");
  if (ev !== "round_end" && ev !== "map_result") return null;
  const { t1, t2 } = teamsFromEvent(b);
  const s1 = n(t1.score);
  const s2 = n(t2.score);
  const d1 = sideToTeam(t1.side);
  const d2 = sideToTeam(t2.side);

  const teamCt = d1 === "CT" ? t1 : t2;
  const teamT = d1 === "T" ? t1 : t2;
  const ctName = str(teamCt.name, "CT");
  const tName = str(teamT.name, "T");
  const ctScore = d1 === "CT" ? s1 : s2;
  const tScore = d1 === "T" ? s1 : s2;

  const players: ScoreboardPlayer[] = [];
  for (const p of t1.players || []) {
    players.push(playerRow(p, d1, "t1"));
  }
  for (const p of t2.players || []) {
    players.push(playerRow(p, d2, "t2"));
  }
  const roundsPlayed = Math.max(1, s1 + s2);
  const roundUi =
    ev === "round_end" ? n(b.round_number) + 1 : Math.max(roundsPlayed, n(b.round_number) + 1);

  return {
    updatedAt,
    hasData: true,
    mapName: "—",
    mode: "MatchZy",
    phase: str(b.event, "live"),
    round: roundUi,
    teamCt: { name: ctName, score: ctScore },
    teamT: { name: tName, score: tScore },
    roundsPlayed,
    roundPhase: ev,
    players,
  };
}

/**
 * FACEIT Data API v4 — associar SteamID64 a perfil CS2.
 * @see https://www.faceit.com/developers
 */

const FACEIT_PLAYERS = "https://open.faceit.com/data/v4/players";
const CACHE_TTL_MS = 5 * 60_000;
const CONCURRENCY = 5;

type CacheEntry = { at: number; data: FaceitCs2Public | null };

const cache = new Map<string, CacheEntry>();

export type FaceitCs2Public = {
  playerId: string;
  nickname: string;
  skillLevel: number;
  skillLevelLabel: string;
  elo: number;
  faceitUrl: string;
};

function isConfigured(): boolean {
  return !!process.env.FACEIT_API_KEY?.trim();
}

export function faceitApiConfigured(): boolean {
  return isConfigured();
}

async function fetchFaceitBySteamId64(steamid64: string): Promise<FaceitCs2Public | null> {
  const apiKey = process.env.FACEIT_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  let r = await fetchPlayerBySteam(steamid64, "cs2", apiKey);
  if (r.status === 404) {
    r = await fetchPlayerBySteam(steamid64, "csgo", apiKey);
  }
  if (r.status === 404) {
    return null;
  }
  if (!r.ok) {
    console.error("[faceit] API error", r.status, await r.text().catch(() => ""));
    return null;
  }

  const j = (await r.json()) as {
    player_id?: string;
    nickname?: string;
    games?: Record<string, { skill_level?: number; faceit_elo?: number; skill_level_label?: string }>;
  };
  const block = pickCs2OrCsgoGame(j?.games);
  if (!block) {
    return null;
  }
  const nickname = j.nickname ?? "";
  return {
    playerId: j.player_id ?? "",
    nickname,
    skillLevel: Number(block.skill_level) || 0,
    skillLevelLabel: String(block.skill_level_label ?? block.skill_level ?? ""),
    elo: Math.round(Number(block.faceit_elo) || 0),
    faceitUrl: nickname
      ? `https://www.faceit.com/players/${encodeURIComponent(nickname)}`
      : "https://www.faceit.com",
  };
}

function pickCs2OrCsgoGame(
  games: Record<string, { skill_level?: number; faceit_elo?: number; skill_level_label?: string }> | undefined
): { skill_level?: number; faceit_elo?: number; skill_level_label?: string } | null {
  if (!games) return null;
  const cs2 = games.cs2;
  if (cs2 && (cs2.faceit_elo != null || cs2.skill_level != null)) {
    return cs2;
  }
  const csgo = games.csgo;
  if (csgo && (csgo.faceit_elo != null || csgo.skill_level != null)) {
    return csgo;
  }
  for (const g of Object.values(games)) {
    if (g && (g.faceit_elo != null || g.skill_level != null)) {
      return g;
    }
  }
  return null;
}

async function fetchPlayerBySteam(steamid64: string, game: "cs2" | "csgo", apiKey: string) {
  const url = new URL(FACEIT_PLAYERS);
  url.searchParams.set("game", game);
  url.searchParams.set("game_player_id", steamid64);
  return fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}` },
    next: { revalidate: 0 },
  });
}

/**
 * Lê cache ou API. 404 = sem conta FACEIT ligada ao Steam; fica em cache.
 */
export async function getFaceitCs2BySteamId64(steamid64: string): Promise<FaceitCs2Public | null> {
  if (!isConfigured()) {
    return null;
  }
  const now = Date.now();
  const hit = cache.get(steamid64);
  if (hit && now - hit.at < CACHE_TTL_MS) {
    return hit.data;
  }

  const data = await fetchFaceitBySteamId64(steamid64);
  cache.set(steamid64, { at: now, data });
  return data;
}

export async function getFaceitCs2ForSteamIds(steamid64s: string[]): Promise<Record<string, FaceitCs2Public | null>> {
  const unique = [...new Set(steamid64s.filter(Boolean))];
  const out: Record<string, FaceitCs2Public | null> = {};
  if (!isConfigured() || unique.length === 0) {
    for (const id of unique) {
      out[id] = null;
    }
    return out;
  }

  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    const chunk = unique.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map((id) => getFaceitCs2BySteamId64(id)));
    chunk.forEach((id, idx) => {
      out[id] = results[idx] ?? null;
    });
  }
  return out;
}

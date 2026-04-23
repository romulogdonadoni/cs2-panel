export type SteamPlayerSummary = {
  steamid64: string;
  personaname: string | null;
  avatarfull: string | null;
  profileurl: string | null;
};

/**
 * Requer `STEAM_WEB_API_KEY` (https://steamcommunity.com/dev/apikey).
 * Sem chave, devolve só o steamid64.
 */
export async function getSteamPlayerSummary(steamid64: string): Promise<SteamPlayerSummary> {
  const key = process.env.STEAM_WEB_API_KEY?.trim();
  const base: SteamPlayerSummary = {
    steamid64,
    personaname: null,
    avatarfull: null,
    profileurl: null,
  };
  if (!key) {
    return base;
  }
  const u = new URL("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/");
  u.searchParams.set("key", key);
  u.searchParams.set("steamids", steamid64);
  try {
    const r = await fetch(u.toString(), { cache: "no-store" });
    if (!r.ok) {
      return base;
    }
    const j = (await r.json()) as {
      response?: { players?: Array<{ personaname?: string; avatarfull?: string; profileurl?: string }> };
    };
    const p = j.response?.players?.[0];
    if (!p) {
      return base;
    }
    return {
      steamid64,
      personaname: p.personaname ?? null,
      avatarfull: p.avatarfull ?? null,
      profileurl: p.profileurl ?? null,
    };
  } catch {
    return base;
  }
}

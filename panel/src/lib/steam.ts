const STEAM_OPENID = "https://steamcommunity.com/openid/login";
const ID_PREFIX = "https://steamcommunity.com/openid/id/";

export function getSteamLoginRedirectUrl(realm: string, returnTo: string): string {
  const u = new URL(STEAM_OPENID);
  u.searchParams.set("openid.ns", "http://specs.openid.net/auth/2.0");
  u.searchParams.set("openid.mode", "checkid_setup");
  u.searchParams.set("openid.return_to", returnTo);
  u.searchParams.set("openid.realm", realm);
  u.searchParams.set("openid.identity", "http://specs.openid.net/auth/2.0/identifier_select");
  u.searchParams.set("openid.claimed_id", "http://specs.openid.net/auth/2.0/identifier_select");
  return u.toString();
}

export async function verifySteamOpenIdCallback(query: URLSearchParams): Promise<string | null> {
  if (query.get("openid.mode") === "setup_needed" || query.get("openid.mode") === "cancel") {
    return null;
  }
  const claimed = query.get("openid.claimed_id");
  if (!claimed || !claimed.startsWith(ID_PREFIX)) {
    return null;
  }
  const steamid64 = claimed.slice(ID_PREFIX.length);
  if (!/^\d{17}$/.test(steamid64)) {
    return null;
  }
  const body = new URLSearchParams();
  for (const [k, v] of query) {
    body.set(k, v);
  }
  body.set("openid.mode", "check_authentication");
  const r = await fetch(STEAM_OPENID, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const text = await r.text();
  if (!/is_valid\s*:\s*true/i.test(text)) {
    return null;
  }
  return steamid64;
}

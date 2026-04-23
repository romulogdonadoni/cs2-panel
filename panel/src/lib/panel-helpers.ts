export function isAdmin(steamid64: string, serverEnv: Record<string, string>): boolean {
  const a = (serverEnv["ADMIN_STEAMID64S"] || process.env["ADMIN_STEAMID64S"] || "").trim();
  if (!a) {
    return true;
  }
  return a
    .split(",")
    .map((s) => s.trim())
    .includes(steamid64);
}

export function maskServerEnvForUi(e: Record<string, string>): Record<string, string> {
  const o = { ...e };
  if (o.SRCDS_TOKEN) {
    o.SRCDS_TOKEN = o.SRCDS_TOKEN.length > 4 ? `***${o.SRCDS_TOKEN.slice(-4)}` : "********";
  }
  if (o.SESSION_SECRET) {
    o.SESSION_SECRET = o.SESSION_SECRET ? "********" : "";
  }
  if (o.LOADOUT_API_KEY) {
    o.LOADOUT_API_KEY = o.LOADOUT_API_KEY ? "********" : "";
  }
  return o;
}

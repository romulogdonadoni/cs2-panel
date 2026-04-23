import { Hono, type Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { serveStatic } from "hono/bun";
import { verifySteamOpenIdCallback, getSteamLoginRedirectUrl } from "./steam";
import { newSession, parseSession } from "./session";
import { getLoadout, saveLoadout } from "./db";
import { readServerEnvFile, writeServerEnvFile } from "./envfile";
import * as cat from "./catalog";
import { registerLobbyRoutes } from "./lobby-routes";

const COOKIE = "cs2pat";

function env(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

const PORT = Number.parseInt(env("PORT", "3080"), 10) || 3080;
const PANEL_DATA_DIR = env("PANEL_DATA_DIR", "./data");
const PANEL_COMPOSE_DIR = env("PANEL_COMPOSE_DIR", process.cwd() + "/..");
const PANEL_BASE_URL = env("PANEL_BASE_URL", `http://127.0.0.1:${PORT}`).replace(/\/$/, "");
const SESSION_SECRET = env("SESSION_SECRET", "");
const LOADOUT_API_KEY = env("LOADOUT_API_KEY", "");

function baseRealm(): string {
  try {
    const u = new URL(PANEL_BASE_URL);
    return `${u.origin}/`;
  } catch {
    return "http://127.0.0.1/";
  }
}

function returnToUrl(): string {
  return `${PANEL_BASE_URL}/auth/steam/return`;
}

type Ctx = { steamid64: string; exp: number };
function getSession(c: Context): Ctx | null {
  if (!SESSION_SECRET) {
    return null;
  }
  const raw = getCookie(c, COOKIE);
  if (!raw) {
    return null;
  }
  return parseSession(raw, SESSION_SECRET);
}

function isAdmin(steamid64: string, serverEnv: Record<string, string>): boolean {
  const a = (serverEnv["ADMIN_STEAMID64S"] || process.env["ADMIN_STEAMID64S"] || "").trim();
  if (!a) {
    return true;
  }
  return a
    .split(",")
    .map((s) => s.trim())
    .includes(steamid64);
}

function maskServerEnvForUi(e: Record<string, string>): Record<string, string> {
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

const app = new Hono();

// --- Public API (plugin no servidor) ---
app.get("/api/v1/loadout/:steamid64", (c) => {
  if (c.req.header("X-API-Key") !== LOADOUT_API_KEY || !LOADOUT_API_KEY) {
    return c.text("Unauthorized", 401);
  }
  const sid = c.req.param("steamid64");
  if (!/^\d{17}$/.test(sid)) {
    return c.text("Invalid steamid", 400);
  }
  const row = getLoadout(PANEL_DATA_DIR, sid);
  const raw = row?.body ?? { version: 1, slots: {} as Record<string, unknown> };
  const body = typeof raw === "object" && raw !== null ? { ...raw } : { version: 1, slots: {} };
  const o = body as Record<string, unknown>;
  o["version"] = 1;
  o["steamid64"] = sid;
  return c.json(o);
});

// --- Health ---
app.get("/api/health", (c) => c.json({ ok: true }));

// --- Catálogo (dados Comunidade: ByMykel/CSGO-API, cache em disco) ---
app.get("/api/catalog/skins", async (c) => {
  const filter = c.req.query("filter") || "all";
  const q = c.req.query("q") || "";
  const offset = Math.max(0, Number.parseInt(c.req.query("offset") || "0", 10) || 0);
  const limit = Math.min(96, Math.max(1, Number.parseInt(c.req.query("limit") || "48", 10) || 48));
  try {
    const all = await cat.loadSkinsData(PANEL_DATA_DIR);
    const filtered = cat.filterSkins(all, filter, q);
    const total = filtered.length;
    const slice = cat.paginate(filtered, offset, limit);
    const items = slice.map((s) => ({
      id: s.id,
      name: s.name,
      image: s.image,
      paint_index: s.paint_index,
      weapon: s.weapon,
      category: s.category,
      rarity: s.rarity,
      min_float: s.min_float,
      max_float: s.max_float,
      stattrak: s.stattrak,
    }));
    return c.json({ items, total, offset, limit });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ error: msg, items: [], total: 0, offset, limit }, 502);
  }
});

app.get("/api/catalog/agents", async (c) => {
  const team = c.req.query("team") || "all";
  const q = c.req.query("q") || "";
  const offset = Math.max(0, Number.parseInt(c.req.query("offset") || "0", 10) || 0);
  const limit = Math.min(96, Math.max(1, Number.parseInt(c.req.query("limit") || "48", 10) || 48));
  try {
    const all = await cat.loadAgentsData(PANEL_DATA_DIR);
    const filtered = cat.filterAgents(all, team, q);
    const total = filtered.length;
    const slice = cat.paginate(filtered, offset, limit);
    const items = slice.map((a) => ({
      id: a.id,
      name: a.name,
      image: a.image,
      def_index: a.def_index,
      team: a.team,
      rarity: a.rarity,
    }));
    return c.json({ items, total, offset, limit });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ error: msg, items: [], total: 0, offset, limit }, 502);
  }
});

app.get("/api/catalog/music", async (c) => {
  const q = c.req.query("q") || "";
  const offset = Math.max(0, Number.parseInt(c.req.query("offset") || "0", 10) || 0);
  const limit = Math.min(120, Math.max(1, Number.parseInt(c.req.query("limit") || "60", 10) || 60));
  try {
    const all = await cat.loadMusicData(PANEL_DATA_DIR);
    const filtered = cat.filterMusic(all, q);
    const total = filtered.length;
    const slice = cat.paginate(filtered, offset, limit);
    const items = slice.map((m) => ({
      id: m.id,
      name: m.name,
      image: m.image,
      def_index: m.def_index,
    }));
    return c.json({ items, total, offset, limit });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ error: msg, items: [], total: 0, offset, limit }, 502);
  }
});

// --- Auth ---
app.get("/auth/steam", (c) => {
  if (!SESSION_SECRET) {
    return c.text("SESSION_SECRET not configured", 500);
  }
  const u = getSteamLoginRedirectUrl(baseRealm(), returnToUrl());
  return c.redirect(u);
});

app.get("/auth/steam/return", async (c) => {
  if (!SESSION_SECRET) {
    return c.text("SESSION_SECRET not configured", 500);
  }
  const usp = new URL(c.req.url).searchParams;
  const steamid = await verifySteamOpenIdCallback(usp);
  if (!steamid) {
    return c.redirect("/?err=auth");
  }
  const s = newSession(steamid, SESSION_SECRET);
  setCookie(c, COOKIE, s, {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    maxAge: 7 * 24 * 60 * 60,
  });
  return c.redirect("/");
});

app.get("/api/me", (c) => {
  const s = getSession(c);
  if (!s) {
    return c.json({ user: null });
  }
  return c.json({ user: { steamid64: s.steamid64 } });
});

app.get("/api/profile/loadout", (c) => {
  const s = getSession(c);
  if (!s) {
    return c.json({ error: "unauthorized" }, 401);
  }
  const row = getLoadout(PANEL_DATA_DIR, s.steamid64);
  return c.json({
    body: row?.body ?? { version: 1, slots: {} },
    updated_at: row?.updated_at ?? 0,
  });
});

app.put("/api/profile/loadout", async (c) => {
  const s = getSession(c);
  if (!s) {
    return c.json({ error: "unauthorized" }, 401);
  }
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }
  if (typeof raw !== "object" || raw === null) {
    return c.json({ error: "object required" }, 400);
  }
  saveLoadout(PANEL_DATA_DIR, s.steamid64, { ...raw, version: 1 });
  return c.json({ ok: true });
});

// --- Server env (MAPA, etc.): escreve .env do projeto do compose ---
app.get("/api/panel/server", (c) => {
  const s = getSession(c);
  if (!s) {
    return c.json({ error: "unauthorized" }, 401);
  }
  const e = readServerEnvFile(PANEL_COMPOSE_DIR);
  if (!isAdmin(s.steamid64, e)) {
    return c.json({ error: "forbidden" }, 403);
  }
  return c.json({ env: maskServerEnvForUi(e) });
});

app.put("/api/panel/server", async (c) => {
  const s = getSession(c);
  if (!s) {
    return c.json({ error: "unauthorized" }, 401);
  }
  const e0 = readServerEnvFile(PANEL_COMPOSE_DIR);
  if (!isAdmin(s.steamid64, e0)) {
    return c.json({ error: "forbidden" }, 403);
  }
  let body: { updates?: Record<string, string> };
  try {
    body = (await c.req.json()) as { updates?: Record<string, string> };
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }
  if (!body.updates || typeof body.updates !== "object") {
    return c.json({ error: "updates required" }, 400);
  }
  const e = { ...e0, ...body.updates };
  // Não deixar apagar segredos com strings máscara da UI
  if (e.SRCDS_TOKEN?.includes("*")) {
    e.SRCDS_TOKEN = e0.SRCDS_TOKEN ?? e.SRCDS_TOKEN;
  }
  if (e.LOADOUT_API_KEY === "********" || e.LOADOUT_API_KEY === "") {
    e.LOADOUT_API_KEY = e0.LOADOUT_API_KEY ?? e.LOADOUT_API_KEY;
  }
  if (e.SESSION_SECRET === "********" || e.SESSION_SECRET === "") {
    e.SESSION_SECRET = e0.SESSION_SECRET ?? e.SESSION_SECRET;
  }
  writeServerEnvFile(PANEL_COMPOSE_DIR, e);
  return c.json({ ok: true, env: maskServerEnvForUi(readServerEnvFile(PANEL_COMPOSE_DIR)) });
});

app.get("/api/panel/steam-url", (c) => c.json({ url: PANEL_BASE_URL + "/auth/steam" }));

registerLobbyRoutes(app, { PANEL_DATA_DIR, PANEL_BASE_URL, getSession });

// Sala de lobby (grelha de equipas + definições)
app.get("/lobby/:code", (c) => {
  return new Response(Bun.file("public/lobby.html"), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});

// Static: raiz = index.html, resto em /public
app.get("/", (c) => {
  return new Response(Bun.file("public/index.html"), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});
app.use("/*", serveStatic({ root: "./public" }));

app.notFound((c) => {
  const p = new URL(c.req.url).pathname;
  if (p.startsWith("/api") || p.startsWith("/auth")) {
    return c.json({ error: "not found" }, 404);
  }
  return c.redirect("/");
});

console.log(`CS2 panel http://0.0.0.0:${PORT}  PANEL_BASE_URL=${PANEL_BASE_URL}`);

Bun.serve({ port: PORT, fetch: app.fetch });

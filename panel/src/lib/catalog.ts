import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SKINS_URL =
  "https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json";
const AGENTS_URL =
  "https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/agents.json";
const MUSIC_URL =
  "https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/music_kits.json";
const STICKERS_URL =
  "https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/stickers.json";
const KEYCHAINS_URL =
  "https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/keychains.json";
const PINS_URL =
  "https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/collectibles.json";

const CAT = {
  gloves: "sfui_invpanel_filter_gloves",
  melee: "sfui_invpanel_filter_melee",
  rifles: "csgo_inventory_weapon_category_rifles",
  smgs: "csgo_inventory_weapon_category_smgs",
  pistols: "csgo_inventory_weapon_category_pistols",
  heavy: "csgo_inventory_weapon_category_heavy",
} as const;

const SNIPER = new Set(["weapon_awp", "weapon_ssg08", "weapon_g3sg1", "weapon_scar20"]);
const SHOTGUN = new Set(["weapon_nova", "weapon_mag7", "weapon_sawedoff", "weapon_xm1014"]);
const MACHINE = new Set(["weapon_m249", "weapon_negev"]);

type SkinRow = {
  id: string;
  name: string;
  image: string;
  paint_index: string;
  weapon: { id: string; name: string; weapon_id: number };
  category: { id: string; name: string };
  rarity: { name: string; color: string };
  min_float: number;
  max_float: number;
  stattrak: boolean;
};

type AgentRow = {
  id: string;
  name: string;
  image: string;
  def_index: string;
  model_player?: string; // path do modelo CS2 (ex: agents/models/tm_professional/tm_professional_varf5.vmdl)
  team: { id: string; name: string };
  rarity: { name: string; color: string };
};

type MusicRow = {
  id: string;
  name: string;
  image?: string;
  def_index?: string;
};

let skinsInMemory: SkinRow[] | null = null;
let agentsInMemory: AgentRow[] | null = null;
let musicInMemory: MusicRow[] | null = null;
let loadSkinsError: string | null = null;

function cachePath(dataDir: string, name: string): string {
  const d = join(dataDir, "cache");
  mkdirSync(d, { recursive: true });
  return join(d, name);
}

const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function isCacheFresh(p: string): boolean {
  if (!existsSync(p)) {
    return false;
  }
  try {
    if (statSync(p).size < 1000) {
      return false;
    }
  } catch {
    return false;
  }
  const m = readFileSync(p, "utf8");
  const first = m.split("\n", 1)[0];
  const t = first?.match(/^#cache:(\d+)/);
  if (t) {
    return Date.now() - Number(t[1]) < MAX_CACHE_AGE_MS;
  }
  try {
    const age = Date.now() - statSync(p).mtimeMs;
    return age < MAX_CACHE_AGE_MS;
  } catch {
    return true;
  }
}

function readCachedJson<T>(p: string): T | null {
  if (!existsSync(p)) {
    return null;
  }
  const raw = readFileSync(p, "utf8");
  const j = raw.startsWith("#cache:") ? raw.slice(raw.indexOf("\n") + 1) : raw;
  try {
    return JSON.parse(j) as T;
  } catch {
    return null;
  }
}

function writeCacheJson(p: string, data: unknown): void {
  const line = `#cache:${Date.now()}\n`;
  writeFileSync(p, line + JSON.stringify(data), "utf8");
}

export async function loadSkinsData(dataDir: string): Promise<SkinRow[]> {
  if (skinsInMemory) {
    return skinsInMemory;
  }
  if (loadSkinsError) {
    throw new Error(loadSkinsError);
  }
  const p = cachePath(dataDir, "skins.json");
  if (isCacheFresh(p)) {
    const j = readCachedJson<SkinRow[]>(p);
    if (j && Array.isArray(j) && j.length) {
      skinsInMemory = j;
      return j;
    }
  }
  try {
    const r = await fetch(SKINS_URL, { signal: AbortSignal.timeout(120_000) });
    if (!r.ok) throw new Error(`HTTP ${r.status} skins`);

    const arr = (await r.json()) as SkinRow[];
    skinsInMemory = arr;
    writeCacheJson(p, arr);
    return arr;
  } catch (e) {
    loadSkinsError = e instanceof Error ? e.message : String(e);
    const j = readCachedJson<SkinRow[]>(p);
    if (j && j.length) {
      skinsInMemory = j;
      return j;
    }
    throw e;
  }
}

export async function loadAgentsData(dataDir: string): Promise<AgentRow[]> {
  if (agentsInMemory) {
    return agentsInMemory;
  }
  const p = cachePath(dataDir, "agents.json");
  if (isCacheFresh(p)) {
    const j = readCachedJson<AgentRow[]>(p);
    if (j && j.length) {
      agentsInMemory = j;
      return j;
    }
  }
  const r = await fetch(AGENTS_URL, { signal: AbortSignal.timeout(60_000) });
  if (!r.ok) {
    throw new Error(`HTTP ${r.status} agents`);
  }
  const arr = (await r.json()) as AgentRow[];
  
  // O plugin WeaponPaints adiciona "agents/models/" e ".vmdl" automaticamente no código C# dele
  // Portanto, precisamos salvar no banco APENAS o caminho interno.
  arr.forEach(agent => {
    if (agent.model_player) {
      agent.model_player = agent.model_player
        .replace("agents/models/", "")
        .replace("characters/models/", "")
        .replace(".vmdl", "");
    }
  });
  
  agentsInMemory = arr;
  writeCacheJson(p, arr);
  return arr;
}

export async function loadMusicData(dataDir: string): Promise<MusicRow[]> {
  if (musicInMemory) {
    return musicInMemory;
  }
  const p = cachePath(dataDir, "music_kits.json");
  if (isCacheFresh(p)) {
    const j = readCachedJson<MusicRow[]>(p);
    if (j && j.length) {
      musicInMemory = j;
      return j;
    }
  }
  const r = await fetch(MUSIC_URL, { signal: AbortSignal.timeout(60_000) });
  if (!r.ok) {
    throw new Error(`HTTP ${r.status} music`);
  }
  const arr = (await r.json()) as MusicRow[];
  musicInMemory = arr;
  writeCacheJson(p, arr);
  return arr;
}

function skinMatchesFilter(s: SkinRow, filter: string): boolean {
  const c = s.category?.id;
  const w = s.weapon?.id;
  if (!w) {
    return false;
  }
  switch (filter) {
    case "all":
      return true;
    case "knife":
      return c === CAT.melee;
    case "gloves":
      return c === CAT.gloves;
    case "smg":
      return c === CAT.smgs;
    case "pistol":
      return c === CAT.pistols;
    case "rifle":
      return c === CAT.rifles && !SNIPER.has(w);
    case "sniper":
      return c === CAT.rifles && SNIPER.has(w);
    case "shotgun":
      return c === CAT.heavy && SHOTGUN.has(w);
    case "heavy":
      return c === CAT.heavy && MACHINE.has(w);
    default:
      return true;
  }
}

export function filterSkins(all: SkinRow[], filter: string, q: string): SkinRow[] {
  const qn = (q || "").trim().toLowerCase();
  let list = all.filter((s) => skinMatchesFilter(s, filter));
  if (qn) {
    list = list.filter((s) => s.name.toLowerCase().includes(qn));
  }
  return list;
}

export function filterAgents(agents: AgentRow[], team: string, q: string): AgentRow[] {
  let list = agents;
  const t = team || "all";
  if (t === "ct") {
    list = list.filter((a) => a.team?.id === "counter-terrorists");
  } else if (t === "t") {
    list = list.filter((a) => a.team?.id === "terrorists");
  }
  const qn = (q || "").trim().toLowerCase();
  if (qn) {
    list = list.filter((a) => a.name.toLowerCase().includes(qn));
  }
  return list;
}

export function filterMusic(kit: MusicRow[], q: string): MusicRow[] {
  const qn = (q || "").trim().toLowerCase();
  if (!qn) {
    return kit;
  }
  return kit.filter((m) => m.name.toLowerCase().includes(qn));
}

export function paginate<T>(list: T[], offset: number, limit: number): T[] {
  return list.slice(offset, offset + limit);
}

// ─── Stickers ──────────────────────────────────────────────────────────────────

export type StickerRow = {
  id: string;
  name: string;
  image: string;
  def_index: string;
  rarity?: { name: string; color: string };
  tournament_event?: { name: string } | null;
};

let stickersInMemory: StickerRow[] | null = null;

export async function loadStickersData(dataDir: string): Promise<StickerRow[]> {
  if (stickersInMemory) return stickersInMemory;
  const p = cachePath(dataDir, "stickers.json");
  if (isCacheFresh(p)) {
    const j = readCachedJson<StickerRow[]>(p);
    if (j && j.length) { stickersInMemory = j; return j; }
  }
  const r = await fetch(STICKERS_URL, { signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} stickers`);
  const arr = (await r.json()) as StickerRow[];
  stickersInMemory = arr;
  writeCacheJson(p, arr);
  return arr;
}

export function filterStickers(list: StickerRow[], q: string): StickerRow[] {
  const qn = (q || "").trim().toLowerCase();
  if (!qn) return list;
  return list.filter(s => s.name.toLowerCase().includes(qn));
}

// ─── Keychains ─────────────────────────────────────────────────────────────────

export type KeychainRow = {
  id: string;
  name: string;
  image: string;
  def_index: string;
  rarity?: { name: string; color: string };
};

let keychainsInMemory: KeychainRow[] | null = null;

export async function loadKeychainsData(dataDir: string): Promise<KeychainRow[]> {
  if (keychainsInMemory) return keychainsInMemory;
  const p = cachePath(dataDir, "keychains.json");
  if (isCacheFresh(p)) {
    const j = readCachedJson<KeychainRow[]>(p);
    if (j && j.length) { keychainsInMemory = j; return j; }
  }
  const r = await fetch(KEYCHAINS_URL, { signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} keychains`);
  const arr = (await r.json()) as KeychainRow[];
  keychainsInMemory = arr;
  writeCacheJson(p, arr);
  return arr;
}

export function filterKeychains(list: KeychainRow[], q: string): KeychainRow[] {
  const qn = (q || "").trim().toLowerCase();
  if (!qn) return list;
  return list.filter(k => k.name.toLowerCase().includes(qn));
}

// ─── Pins ──────────────────────────────────────────────────────────────────────

export type PinRow = {
  id: string;
  name: string;
  image: string;
  def_index: string;
  rarity?: { name: string; color: string };
};

let pinsInMemory: PinRow[] | null = null;

export async function loadPinsData(dataDir: string): Promise<PinRow[]> {
  if (pinsInMemory) return pinsInMemory;
  const p = cachePath(dataDir, "pins.json");
  if (isCacheFresh(p)) {
    const j = readCachedJson<PinRow[]>(p);
    if (j && j.length) { pinsInMemory = j; return j; }
  }
  const r = await fetch(PINS_URL, { signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} pins`);
  const arr = (await r.json()) as PinRow[];
  pinsInMemory = arr;
  writeCacheJson(p, arr);
  return arr;
}

export function filterPins(list: PinRow[], q: string): PinRow[] {
  const qn = (q || "").trim().toLowerCase();
  if (!qn) return list;
  return list.filter(p => p.name.toLowerCase().includes(qn));
}

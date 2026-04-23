import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

let db: Database | null = null;

export function getDb(dataDir: string): Database {
  if (db) {
    return db;
  }
  const p = resolve(dataDir, "panel.sqlite");
  mkdirSync(dirname(p), { recursive: true });
  const d = new Database(p);
  d.run("PRAGMA foreign_keys = ON");
  d.run(
    `CREATE TABLE IF NOT EXISTS loadouts (
      steamid64 TEXT PRIMARY KEY,
      body TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`
  );
  d.run(
    `CREATE TABLE IF NOT EXISTS lobbies (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      leader_steamid64 TEXT NOT NULL,
      team1_name TEXT NOT NULL DEFAULT 'Time 1',
      team2_name TEXT NOT NULL DEFAULT 'Time 2',
      map_id TEXT NOT NULL DEFAULT 'de_mirage',
      game_mode TEXT NOT NULL DEFAULT 'competitive',
      region TEXT NOT NULL DEFAULT 'sao_paulo',
      max_per_team INTEGER NOT NULL DEFAULT 5,
      status TEXT NOT NULL DEFAULT 'open',
      settings_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`
  );
  d.run(
    `CREATE TABLE IF NOT EXISTS lobby_members (
      lobby_id TEXT NOT NULL,
      steamid64 TEXT NOT NULL,
      team INTEGER NOT NULL DEFAULT 0,
      is_ready INTEGER NOT NULL DEFAULT 0,
      is_leader INTEGER NOT NULL DEFAULT 0,
      joined_at INTEGER NOT NULL,
      PRIMARY KEY (lobby_id, steamid64),
      FOREIGN KEY (lobby_id) REFERENCES lobbies(id) ON DELETE CASCADE
    )`
  );
  d.run("CREATE INDEX IF NOT EXISTS idx_lobbies_code ON lobbies(code)");
  db = d;
  return d;
}

export type LoadoutRow = { steamid64: string; body: unknown; updated_at: number };

export function getLoadout(dataDir: string, steamid64: string): LoadoutRow | null {
  const d = getDb(dataDir);
  const row = d
    .query("SELECT body, updated_at FROM loadouts WHERE steamid64 = ?")
    .get(steamid64) as { body: string; updated_at: number } | null;
  if (!row) {
    return null;
  }
  try {
    return {
      steamid64,
      body: JSON.parse(row.body) as unknown,
      updated_at: row.updated_at,
    };
  } catch {
    return null;
  }
}

export function saveLoadout(dataDir: string, steamid64: string, body: unknown): void {
  const d = getDb(dataDir);
  const json = JSON.stringify(body);
  d.run(
    `INSERT INTO loadouts (steamid64, body, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(steamid64) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at`,
    [steamid64, json, Date.now()]
  );
}

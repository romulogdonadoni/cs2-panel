/**
 * Cliente MySQL para o banco de dados do WeaponPaints.
 * Separado do Prisma (SQLite) do painel.
 */
import mysql from "mysql2/promise";

let pool: mysql.Pool | null = null;

export function getWeaponPaintsDb(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.WP_DB_HOST ?? "127.0.0.1",
      port: parseInt(process.env.WP_DB_PORT ?? "3306", 10),
      user: process.env.WP_DB_USER ?? "wp_user",
      password: process.env.WP_DB_PASSWORD ?? "wp_password",
      database: process.env.WP_DB_NAME ?? "weapon_paints",
      waitForConnections: true,
      connectionLimit: 5,
    });
  }
  return pool;
}

// ─── Tipos espelhando as tabelas do WeaponPaints ──────────────────────────────

export type WpSkinRow = {
  steamid: string;
  weapon_team: 0 | 2 | 3; // 0=both, 2=T, 3=CT
  weapon_defindex: number;
  weapon_paint_id: number;
  weapon_wear: number;
  weapon_seed: number;
  weapon_nametag: string | null;
  weapon_stattrak: 0 | 1;
  weapon_stattrak_count: number;
};

export type WpKnifeRow = {
  steamid: string;
  weapon_team: 0 | 2 | 3;
  knife: string; // ex: "weapon_m9_bayonet"
};

export type WpGloveRow = {
  steamid: string;
  weapon_team: 0 | 2 | 3;
  weapon_defindex: number;
};

export type WpAgentRow = {
  steamid: string;
  agent_ct: string | null;
  agent_t: string | null;
};

export type WpMusicRow = {
  steamid: string;
  music_id: number;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Carrega todas as skins de um jogador */
export async function loadPlayerSkins(steamid: string): Promise<WpSkinRow[]> {
  const db = getWeaponPaintsDb();
  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    "SELECT * FROM wp_player_skins WHERE steamid = ?",
    [steamid]
  );
  return rows as WpSkinRow[];
}

/** Carrega faca de um jogador */
export async function loadPlayerKnife(steamid: string): Promise<WpKnifeRow[]> {
  const db = getWeaponPaintsDb();
  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    "SELECT * FROM wp_player_knife WHERE steamid = ?",
    [steamid]
  );
  return rows as WpKnifeRow[];
}

/** Carrega luvas de um jogador */
export async function loadPlayerGloves(steamid: string): Promise<WpGloveRow[]> {
  const db = getWeaponPaintsDb();
  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    "SELECT * FROM wp_player_gloves WHERE steamid = ?",
    [steamid]
  );
  return rows as WpGloveRow[];
}

/** Carrega agentes de um jogador */
export async function loadPlayerAgents(steamid: string): Promise<WpAgentRow | null> {
  const db = getWeaponPaintsDb();
  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    "SELECT * FROM wp_player_agents WHERE steamid = ? LIMIT 1",
    [steamid]
  );
  return (rows[0] as WpAgentRow) ?? null;
}

/** Salva/atualiza uma skin */
export async function savePlayerSkin(row: WpSkinRow): Promise<void> {
  const db = getWeaponPaintsDb();
  await db.execute(
    `INSERT INTO wp_player_skins
       (steamid, weapon_team, weapon_defindex, weapon_paint_id, weapon_wear,
        weapon_seed, weapon_nametag, weapon_stattrak, weapon_stattrak_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       weapon_paint_id = VALUES(weapon_paint_id),
       weapon_wear = VALUES(weapon_wear),
       weapon_seed = VALUES(weapon_seed),
       weapon_nametag = VALUES(weapon_nametag),
       weapon_stattrak = VALUES(weapon_stattrak),
       weapon_stattrak_count = VALUES(weapon_stattrak_count)`,
    [
      row.steamid, row.weapon_team, row.weapon_defindex,
      row.weapon_paint_id, row.weapon_wear, row.weapon_seed,
      row.weapon_nametag ?? null, row.weapon_stattrak, row.weapon_stattrak_count,
    ]
  );
}

/** Salva/atualiza faca */
export async function savePlayerKnife(steamid: string, team: 0 | 2 | 3, knife: string): Promise<void> {
  const db = getWeaponPaintsDb();
  await db.execute(
    `INSERT INTO wp_player_knife (steamid, weapon_team, knife)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE knife = VALUES(knife)`,
    [steamid, team, knife]
  );
}

/** Salva/atualiza luvas */
export async function savePlayerGloves(steamid: string, team: 0 | 2 | 3, defindex: number): Promise<void> {
  const db = getWeaponPaintsDb();
  await db.execute(
    `INSERT INTO wp_player_gloves (steamid, weapon_team, weapon_defindex)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE weapon_defindex = VALUES(weapon_defindex)`,
    [steamid, team, defindex]
  );
}

/** Salva/atualiza agentes */
export async function savePlayerAgents(steamid: string, agent_ct: string | null, agent_t: string | null): Promise<void> {
  const db = getWeaponPaintsDb();
  await db.execute(
    `INSERT INTO wp_player_agents (steamid, agent_ct, agent_t)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE agent_ct = VALUES(agent_ct), agent_t = VALUES(agent_t)`,
    [steamid, agent_ct, agent_t]
  );
}

/** Remove skin de uma arma específica */
export async function removePlayerSkin(steamid: string, team: 0 | 2 | 3, defindex: number): Promise<void> {
  const db = getWeaponPaintsDb();
  await db.execute(
    "DELETE FROM wp_player_skins WHERE steamid = ? AND weapon_team = ? AND weapon_defindex = ?",
    [steamid, team, defindex]
  );
}

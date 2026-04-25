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
  weapon_paint_id: number;
  weapon_wear: number;
  weapon_seed: number;
};

export type WpAgentRow = {
  steamid: string;
  agent_ct: string | null;
  agent_t: string | null;
};

export type WpMusicRow = {
  steamid: string;
  weapon_team: 0 | 2 | 3;
  music_id: number;
};

export type WpPinRow = {
  steamid: string;
  weapon_team: 0 | 2 | 3;
  id: number;
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

/** Carrega música de um jogador */
export async function loadPlayerMusic(steamid: string): Promise<WpMusicRow[]> {
  const db = getWeaponPaintsDb();
  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    "SELECT * FROM wp_player_music WHERE steamid = ?",
    [steamid]
  );
  return rows as WpMusicRow[];
}

/** Carrega pins de um jogador */
export async function loadPlayerPins(steamid: string): Promise<WpPinRow[]> {
  const db = getWeaponPaintsDb();
  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    "SELECT * FROM wp_player_pins WHERE steamid = ?",
    [steamid]
  );
  return rows as WpPinRow[];
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
export async function savePlayerGloves(steamid: string, team: 0 | 2 | 3, defindex: number, paintId: number = 0, wear: number = 0, seed: number = 0): Promise<void> {
  const db = getWeaponPaintsDb();
  await db.execute(
    `INSERT INTO wp_player_gloves (steamid, weapon_team, weapon_defindex, weapon_paint_id, weapon_wear, weapon_seed)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE 
       weapon_defindex = VALUES(weapon_defindex),
       weapon_paint_id = VALUES(weapon_paint_id),
       weapon_wear = VALUES(weapon_wear),
       weapon_seed = VALUES(weapon_seed)`,
    [steamid, team, defindex, paintId, wear, seed]
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

/** Salva/atualiza música */
export async function savePlayerMusic(steamid: string, team: 0 | 2 | 3, music_id: number): Promise<void> {
  const db = getWeaponPaintsDb();
  await db.execute(
    `INSERT INTO wp_player_music (steamid, weapon_team, music_id)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE music_id = VALUES(music_id)`,
    [steamid, team, music_id]
  );
}

/** Salva/atualiza pin */
export async function savePlayerPin(steamid: string, team: 0 | 2 | 3, pin_id: number): Promise<void> {
  const db = getWeaponPaintsDb();
  await db.execute(
    `INSERT INTO wp_player_pins (steamid, weapon_team, id)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE id = VALUES(id)`,
    [steamid, team, pin_id]
  );
}

/** Remove skin de uma arma específica. team 0 = ambos os lados (TR+CT), alinhado ao POST. */
export async function removePlayerSkin(steamid: string, team: 0 | 2 | 3, defindex: number): Promise<void> {
  const db = getWeaponPaintsDb();
  if (team === 0) {
    await db.execute(
      "DELETE FROM wp_player_skins WHERE steamid = ? AND weapon_defindex = ? AND weapon_team IN (0, 2, 3)",
      [steamid, defindex]
    );
  } else {
    await db.execute(
      "DELETE FROM wp_player_skins WHERE steamid = ? AND weapon_team = ? AND weapon_defindex = ?",
      [steamid, team, defindex]
    );
  }
}

/** Limpa skins de luvas (wp_player_skins) para uma equipa antes de gravar nova luva */
export async function clearPlayerGlovesSkins(steamid: string, team: 0 | 2 | 3): Promise<void> {
  const db = getWeaponPaintsDb();
  await db.execute(
    "DELETE FROM wp_player_skins WHERE steamid = ? AND weapon_team = ? AND weapon_defindex IN (4725, 5027, 5030, 5031, 5032, 5033, 5034, 5035)",
    [steamid, team]
  );
}

/** Limpa skins de facas para uma equipa antes de gravar nova faca */
export async function clearPlayerKnivesSkins(steamid: string, team: 0 | 2 | 3): Promise<void> {
  const db = getWeaponPaintsDb();
  await db.execute(
    "DELETE FROM wp_player_skins WHERE steamid = ? AND weapon_team = ? AND weapon_defindex IN (500,503,505,506,507,508,509,512,514,515,516,517,518,519,520,521,522,523,525,526)",
    [steamid, team]
  );
}

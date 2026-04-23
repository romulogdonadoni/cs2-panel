import { randomBytes } from "node:crypto";
import { getDb } from "./db";

export type LobbySettings = {
  lobbyVisibility?: "public" | "private";
  mapSelection?: "selected" | "vote" | "random";
  teamSelection?: "knife_round" | "captains" | "free";
  voiceChat?: "all" | "team" | "off";
  freeTeamSelect?: boolean;
  bots?: boolean;
  readyCheck?: boolean;
  extraSettings?: boolean;
  funSettings?: boolean;
};

export type LobbyRow = {
  id: string;
  code: string;
  leader_steamid64: string;
  team1_name: string;
  team2_name: string;
  map_id: string;
  game_mode: string;
  region: string;
  max_per_team: number;
  status: string;
  settings: LobbySettings;
  created_at: number;
  updated_at: number;
};

export type MemberRow = {
  steamid64: string;
  team: number;
  is_ready: number;
  is_leader: number;
  joined_at: number;
};

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function genCode(): string {
  const b = randomBytes(12);
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += CODE_CHARS[b[i]! % CODE_CHARS.length];
  }
  return s;
}

function defaultSettings(): LobbySettings {
  return {
    lobbyVisibility: "public",
    mapSelection: "selected",
    teamSelection: "knife_round",
    voiceChat: "all",
    freeTeamSelect: true,
    bots: false,
    readyCheck: true,
    extraSettings: false,
    funSettings: false,
  };
}

function parseSettings(json: string): LobbySettings {
  try {
    return { ...defaultSettings(), ...(JSON.parse(json) as LobbySettings) };
  } catch {
    return defaultSettings();
  }
}

export function createLobby(
  dataDir: string,
  leader: string,
  opts?: { team1Name?: string; team2Name?: string; mapId?: string }
): LobbyRow {
  const d = getDb(dataDir);
  const id = crypto.randomUUID();
  const now = Date.now();
  let code = genCode();
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      d.run(
        `INSERT INTO lobbies (id, code, leader_steamid64, team1_name, team2_name, map_id, game_mode, region, max_per_team, status, settings_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'competitive', 'sao_paulo', 5, 'open', ?, ?, ?)`,
        [
          id,
          code,
          leader,
          opts?.team1Name ?? "Time 1",
          opts?.team2Name ?? "Time 2",
          opts?.mapId ?? "de_mirage",
          JSON.stringify(defaultSettings()),
          now,
          now,
        ]
      );
      d.run(
        `INSERT INTO lobby_members (lobby_id, steamid64, team, is_ready, is_leader, joined_at) VALUES (?, ?, 0, 0, 1, ?)`,
        [id, leader, now]
      );
      return getLobbyById(dataDir, id)!;
    } catch {
      code = genCode();
    }
  }
  throw new Error("Não foi possível gerar código de lobby");
}

function rowToLobby(r: {
  id: string;
  code: string;
  leader_steamid64: string;
  team1_name: string;
  team2_name: string;
  map_id: string;
  game_mode: string;
  region: string;
  max_per_team: number;
  status: string;
  settings_json: string;
  created_at: number;
  updated_at: number;
}): LobbyRow {
  return {
    id: r.id,
    code: r.code,
    leader_steamid64: r.leader_steamid64,
    team1_name: r.team1_name,
    team2_name: r.team2_name,
    map_id: r.map_id,
    game_mode: r.game_mode,
    region: r.region,
    max_per_team: r.max_per_team,
    status: r.status,
    settings: parseSettings(r.settings_json),
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export function getLobbyByCode(dataDir: string, code: string): LobbyRow | null {
  const d = getDb(dataDir);
  const c = String(code).toUpperCase();
  const r = d
    .query("SELECT * FROM lobbies WHERE code = ?")
    .get(c) as
    | {
        id: string;
        code: string;
        leader_steamid64: string;
        team1_name: string;
        team2_name: string;
        map_id: string;
        game_mode: string;
        region: string;
        max_per_team: number;
        status: string;
        settings_json: string;
        created_at: number;
        updated_at: number;
      }
    | null;
  return r ? rowToLobby(r) : null;
}

export function getLobbyById(dataDir: string, id: string): LobbyRow | null {
  const d = getDb(dataDir);
  const r = d.query("SELECT * FROM lobbies WHERE id = ?").get(id) as
    | {
        id: string;
        code: string;
        leader_steamid64: string;
        team1_name: string;
        team2_name: string;
        map_id: string;
        game_mode: string;
        region: string;
        max_per_team: number;
        status: string;
        settings_json: string;
        created_at: number;
        updated_at: number;
      }
    | null;
  return r ? rowToLobby(r) : null;
}

export function listMembers(dataDir: string, lobbyId: string): MemberRow[] {
  const d = getDb(dataDir);
  return d
    .query(
      "SELECT steamid64, team, is_ready, is_leader, joined_at FROM lobby_members WHERE lobby_id = ? ORDER BY joined_at"
    )
    .all(lobbyId) as MemberRow[];
}

export function isMember(dataDir: string, lobbyId: string, steamid64: string): boolean {
  const d = getDb(dataDir);
  const r = d
    .query("SELECT 1 FROM lobby_members WHERE lobby_id = ? AND steamid64 = ?")
    .get(lobbyId, steamid64) as { 1: number } | null;
  return !!r;
}

function countTeam(dataDir: string, lobbyId: string, team: number): number {
  const d = getDb(dataDir);
  const r = d
    .query("SELECT COUNT(*) as c FROM lobby_members WHERE lobby_id = ? AND team = ?")
    .get(lobbyId, team) as { c: number };
  return r.c;
}

export function joinLobby(dataDir: string, lobbyId: string, steamid64: string): void {
  if (isMember(dataDir, lobbyId, steamid64)) {
    return;
  }
  const d = getDb(dataDir);
  const now = Date.now();
  d.run(
    `INSERT INTO lobby_members (lobby_id, steamid64, team, is_ready, is_leader, joined_at) VALUES (?, ?, 0, 0, 0, ?)`,
    [lobbyId, steamid64, now]
  );
  touchLobby(dataDir, lobbyId);
}

export function leaveLobby(dataDir: string, lobbyId: string, steamid64: string): void {
  const d = getDb(dataDir);
  d.run("DELETE FROM lobby_members WHERE lobby_id = ? AND steamid64 = ? AND is_leader = 0", [lobbyId, steamid64]);
  touchLobby(dataDir, lobbyId);
}

export function kickMember(dataDir: string, lobbyId: string, target: string): void {
  const d = getDb(dataDir);
  d.run("DELETE FROM lobby_members WHERE lobby_id = ? AND steamid64 = ? AND is_leader = 0", [lobbyId, target]);
  touchLobby(dataDir, lobbyId);
}

export function setMemberTeam(
  dataDir: string,
  lobbyId: string,
  steamid64: string,
  team: number,
  lobby: LobbyRow
): { ok: true } | { ok: false; error: string } {
  if (team < 0 || team > 3) {
    return { ok: false, error: "time inválido" };
  }
  const d = getDb(dataDir);
  if (team === 1 || team === 2) {
    const c = countTeam(dataDir, lobbyId, team);
    const cur = d
      .query("SELECT team FROM lobby_members WHERE lobby_id = ? AND steamid64 = ?")
      .get(lobbyId, steamid64) as { team: number } | null;
    const same = cur && cur.team === team;
    if (!same && c >= lobby.max_per_team) {
      return { ok: false, error: "time cheio" };
    }
  }
  d.run("UPDATE lobby_members SET team = ? WHERE lobby_id = ? AND steamid64 = ?", [team, lobbyId, steamid64]);
  touchLobby(dataDir, lobbyId);
  return { ok: true };
}

export function setMemberReady(
  dataDir: string,
  lobbyId: string,
  steamid64: string,
  ready: boolean
): void {
  const d = getDb(dataDir);
  d.run("UPDATE lobby_members SET is_ready = ? WHERE lobby_id = ? AND steamid64 = ?", [ready ? 1 : 0, lobbyId, steamid64]);
  touchLobby(dataDir, lobbyId);
}

function touchLobby(dataDir: string, lobbyId: string): void {
  const d = getDb(dataDir);
  d.run("UPDATE lobbies SET updated_at = ? WHERE id = ?", [Date.now(), lobbyId]);
}

export function updateLobbyLeader(
  dataDir: string,
  lobby: LobbyRow,
  leader: string,
  patch: {
    team1Name?: string;
    team2Name?: string;
    mapId?: string;
    gameMode?: string;
    region?: string;
    maxPerTeam?: number;
    settings?: LobbySettings;
  }
): LobbyRow {
  if (lobby.leader_steamid64 !== leader) {
    throw new Error("só o líder");
  }
  const d = getDb(dataDir);
  const s = { ...lobby.settings, ...patch.settings };
  const t1 = patch.team1Name ?? lobby.team1_name;
  const t2 = patch.team2Name ?? lobby.team2_name;
  const map = patch.mapId ?? lobby.map_id;
  const mode = patch.gameMode ?? lobby.game_mode;
  const reg = patch.region ?? lobby.region;
  const max = Math.min(8, Math.max(1, patch.maxPerTeam ?? lobby.max_per_team));
  d.run(
    `UPDATE lobbies SET team1_name = ?, team2_name = ?, map_id = ?, game_mode = ?, region = ?, max_per_team = ?, settings_json = ?, updated_at = ? WHERE id = ?`,
    [t1, t2, map, mode, reg, max, JSON.stringify(s), Date.now(), lobby.id]
  );
  return getLobbyById(dataDir, lobby.id)!;
}

export function deleteLobby(dataDir: string, lobby: LobbyRow, leader: string): void {
  if (lobby.leader_steamid64 !== leader) {
    throw new Error("só o líder");
  }
  const d = getDb(dataDir);
  d.run("DELETE FROM lobbies WHERE id = ?", [lobby.id]);
}

export { defaultSettings, parseSettings };

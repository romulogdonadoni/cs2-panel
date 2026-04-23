import type { Hono, Context } from "hono";
import * as L from "./lobby-store";

type Deps = {
  PANEL_DATA_DIR: string;
  PANEL_BASE_URL: string;
  getSession: (c: Context) => { steamid64: string; exp: number } | null;
};

function jsonLobby(lobby: L.LobbyRow, members: L.MemberRow[], baseUrl: string) {
  const cap = lobby.max_per_team * 2;
  const n = members.filter((m) => m.team === 1 || m.team === 2).length;
  return {
    id: lobby.id,
    code: lobby.code,
    joinUrl: `${baseUrl}/lobby/${lobby.code}`,
    shortId: lobby.code,
    leaderSteamid64: lobby.leader_steamid64,
    team1Name: lobby.team1_name,
    team2Name: lobby.team2_name,
    mapId: lobby.map_id,
    gameMode: lobby.game_mode,
    region: lobby.region,
    maxPerTeam: lobby.max_per_team,
    status: lobby.status,
    settings: lobby.settings,
    createdAt: lobby.created_at,
    updatedAt: lobby.updated_at,
    members: members.map((m) => ({
      steamid64: m.steamid64,
      team: m.team,
      isReady: !!m.is_ready,
      isLeader: !!m.is_leader,
    })),
    fillCount: n,
    capacity: cap,
  };
}

export function registerLobbyRoutes(app: Hono, d: Deps) {
  const { PANEL_DATA_DIR, PANEL_BASE_URL, getSession } = d;

  app.post("/api/lobbies", async (c) => {
    const s = getSession(c);
    if (!s) {
      return c.json({ error: "unauthorized" }, 401);
    }
    let body: { team1Name?: string; team2Name?: string; mapId?: string } = {};
    try {
      body = (await c.req.json()) as typeof body;
    } catch {
      /* empty */
    }
    const lobby = L.createLobby(PANEL_DATA_DIR, s.steamid64, body);
    const members = L.listMembers(PANEL_DATA_DIR, lobby.id);
    return c.json({ lobby: jsonLobby(lobby, members, PANEL_BASE_URL), baseUrl: PANEL_BASE_URL });
  });

  app.get("/api/lobbies/:code", (c) => {
    const code = c.req.param("code").toUpperCase();
    const lobby = L.getLobbyByCode(PANEL_DATA_DIR, code);
    if (!lobby) {
      return c.json({ error: "não encontrado" }, 404);
    }
    const members = L.listMembers(PANEL_DATA_DIR, lobby.id);
    return c.json({ lobby: jsonLobby(lobby, members, PANEL_BASE_URL), baseUrl: PANEL_BASE_URL });
  });

  app.post("/api/lobbies/:code/join", (c) => {
    const s = getSession(c);
    if (!s) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const code = c.req.param("code").toUpperCase();
    const lobby = L.getLobbyByCode(PANEL_DATA_DIR, code);
    if (!lobby) {
      return c.json({ error: "não encontrado" }, 404);
    }
    L.joinLobby(PANEL_DATA_DIR, lobby.id, s.steamid64);
    const members = L.listMembers(PANEL_DATA_DIR, lobby.id);
    return c.json({
      lobby: jsonLobby(L.getLobbyById(PANEL_DATA_DIR, lobby.id)!, members, PANEL_BASE_URL),
      baseUrl: PANEL_BASE_URL,
    });
  });

  app.post("/api/lobbies/:code/leave", (c) => {
    const s = getSession(c);
    if (!s) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const code = c.req.param("code").toUpperCase();
    const lobby = L.getLobbyByCode(PANEL_DATA_DIR, code);
    if (!lobby) {
      return c.json({ error: "não encontrado" }, 404);
    }
    if (lobby.leader_steamid64 === s.steamid64) {
      return c.json({ error: "líder deve excluir a lobby" }, 400);
    }
    L.leaveLobby(PANEL_DATA_DIR, lobby.id, s.steamid64);
    return c.json({ ok: true });
  });

  app.put("/api/lobbies/:code/me", async (c) => {
    const s = getSession(c);
    if (!s) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const code = c.req.param("code").toUpperCase();
    const lobby = L.getLobbyByCode(PANEL_DATA_DIR, code);
    if (!lobby) {
      return c.json({ error: "não encontrado" }, 404);
    }
    if (!L.isMember(PANEL_DATA_DIR, lobby.id, s.steamid64)) {
      return c.json({ error: "não estás na lobby" }, 403);
    }
    let body: { team?: number; isReady?: boolean } = {};
    try {
      body = (await c.req.json()) as typeof body;
    } catch {
      return c.json({ error: "json inválido" }, 400);
    }
    if (body.team !== undefined) {
      const r = L.setMemberTeam(PANEL_DATA_DIR, lobby.id, s.steamid64, body.team, L.getLobbyById(PANEL_DATA_DIR, lobby.id)!);
      if (!r.ok) {
        return c.json({ error: r.error }, 400);
      }
    }
    if (body.isReady !== undefined) {
      L.setMemberReady(PANEL_DATA_DIR, lobby.id, s.steamid64, body.isReady);
    }
    const up = L.getLobbyById(PANEL_DATA_DIR, lobby.id)!;
    const j = jsonLobby(up, L.listMembers(PANEL_DATA_DIR, lobby.id), PANEL_BASE_URL);
    return c.json({ lobby: j, baseUrl: PANEL_BASE_URL });
  });

  app.put("/api/lobbies/:code/settings", async (c) => {
    const s = getSession(c);
    if (!s) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const code = c.req.param("code").toUpperCase();
    let lobby = L.getLobbyByCode(PANEL_DATA_DIR, code);
    if (!lobby) {
      return c.json({ error: "não encontrado" }, 404);
    }
    let patch: {
      team1Name?: string;
      team2Name?: string;
      mapId?: string;
      gameMode?: string;
      region?: string;
      maxPerTeam?: number;
      settings?: L.LobbySettings;
    } = {};
    try {
      patch = (await c.req.json()) as typeof patch;
    } catch {
      return c.json({ error: "json inválido" }, 400);
    }
    try {
      lobby = L.updateLobbyLeader(PANEL_DATA_DIR, lobby, s.steamid64, patch);
    } catch {
      return c.json({ error: "só o líder" }, 403);
    }
    return c.json({ lobby: jsonLobby(lobby, L.listMembers(PANEL_DATA_DIR, lobby.id), PANEL_BASE_URL) });
  });

  app.post("/api/lobbies/:code/kick", async (c) => {
    const s = getSession(c);
    if (!s) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const code = c.req.param("code").toUpperCase();
    const lobby = L.getLobbyByCode(PANEL_DATA_DIR, code);
    if (!lobby) {
      return c.json({ error: "não encontrado" }, 404);
    }
    if (lobby.leader_steamid64 !== s.steamid64) {
      return c.json({ error: "só o líder" }, 403);
    }
    let body: { steamid64?: string } = {};
    try {
      body = (await c.req.json()) as { steamid64?: string };
    } catch {
      return c.json({ error: "json" }, 400);
    }
    if (!body.steamid64 || !/^\d{17}$/.test(body.steamid64)) {
      return c.json({ error: "steamid64" }, 400);
    }
    L.kickMember(PANEL_DATA_DIR, lobby.id, body.steamid64);
    return c.json({
      ok: true,
      lobby: jsonLobby(L.getLobbyById(PANEL_DATA_DIR, lobby.id)!, L.listMembers(PANEL_DATA_DIR, lobby.id), PANEL_BASE_URL),
    });
  });

  app.delete("/api/lobbies/:code", (c) => {
    const s = getSession(c);
    if (!s) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const code = c.req.param("code").toUpperCase();
    const lobby = L.getLobbyByCode(PANEL_DATA_DIR, code);
    if (!lobby) {
      return c.json({ error: "não encontrado" }, 404);
    }
    try {
      L.deleteLobby(PANEL_DATA_DIR, lobby, s.steamid64);
    } catch {
      return c.json({ error: "só o líder" }, 403);
    }
    return c.json({ ok: true });
  });
}

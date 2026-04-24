import { randomBytes } from "node:crypto";
import { prisma } from "./prisma";
import { defaultSettings, parseSettings, type LobbySettings } from "./lobby-types";

/** Uma linha lógica: um servidor = uma sala, sempre a mesma no painel. */
export const SINGLETON_LOBBY_CODE = "GLOBAL";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function genCode(): string {
  const b = randomBytes(12);
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += CODE_CHARS[b[i]! % CODE_CHARS.length];
  }
  return s;
}

async function touchLobby(lobbyId: string) {
  await prisma.lobby.update({
    where: { id: lobbyId },
    data: { updatedAt: new Date() },
  });
}

function isP2002(e: any): boolean {
  return e?.code === "P2002";
}

export async function createLobby(
  leader: string,
  opts?: { team1Name?: string; team2Name?: string; mapId?: string }
) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = genCode();
    const id = crypto.randomUUID();
    const settings = JSON.stringify(defaultSettings());
    try {
      return await prisma.$transaction(async (tx: any) => {
        // Garantir que o user existe para evitar P2003 (Foreign Key)
        await tx.user.upsert({
          where: { steamid64: leader },
          update: {},
          create: { steamid64: leader, name: `User_${leader.slice(-5)}`, avatar: "" }
        });

        const lobby = await tx.lobby.create({
          data: {
            id,
            code,
            leaderSteamid64: leader,
            team1Name: opts?.team1Name ?? "Time 1",
            team2Name: opts?.team2Name ?? "Time 2",
            mapId: opts?.mapId ?? "de_mirage",
            settingsJson: settings,
            members: {
              create: {
                steamid64: leader,
                team: 3, // Inicia como Espectador (Unassigned)
                isReady: false,
                isLeader: true,
              },
            },
          },
          include: { members: true },
        });
        return lobby;
      });
    } catch (e) {
      if (isP2002(e)) {
        continue;
      }
      throw e;
    }
  }
  throw new Error("Não foi possível gerar código de lobby");
}

export function getLobbyByCodeRaw(code: string) {
  return prisma.lobby.findUnique({
    where: { code: code.toUpperCase() },
    include: { members: { orderBy: { joinedAt: "asc" }, include: { user: true } } },
  });
}

export function getLobbyById(lobbyId: string) {
  return prisma.lobby.findUnique({
    where: { id: lobbyId },
    include: { members: { orderBy: { joinedAt: "asc" }, include: { user: true } } },
  });
}

export async function isMember(lobbyId: string, steamid64: string) {
  const m = await prisma.lobbyMember.findUnique({
    where: { lobbyId_steamid64: { lobbyId, steamid64 } },
  });
  return !!m;
}

async function countTeam(lobbyId: string, team: number) {
  return prisma.lobbyMember.count({ where: { lobbyId, team } });
}

export async function joinLobby(lobbyId: string, steamid64: string) {
  const ex = await prisma.lobbyMember.findUnique({
    where: { lobbyId_steamid64: { lobbyId, steamid64 } },
  });
  if (ex) {
    return;
  }
  await prisma.lobbyMember.create({
    data: { lobbyId, steamid64, team: 3, isReady: false, isLeader: false },
  });
  await touchLobby(lobbyId);
}

/**
 * Garante a existência da sala única e adiciona o utilizador como membro. Idempotente.
 * Um VM / um servidor = uma sala; o estado "partida activa" é `lobby.status === "live"`.
 */
export async function ensureSingletonLobby(steamid64: string) {
  await prisma.user.upsert({
    where: { steamid64 },
    update: {},
    create: { steamid64, name: `User_${steamid64.slice(-5)}`, avatar: "" },
  });

  let lobby = await getLobbyByCodeRaw(SINGLETON_LOBBY_CODE);
  if (!lobby) {
    const settings = JSON.stringify(defaultSettings());
    const id = crypto.randomUUID();
    try {
      lobby = await prisma.lobby.create({
        data: {
          id,
          code: SINGLETON_LOBBY_CODE,
          leaderSteamid64: steamid64,
          team1Name: "Time 1",
          team2Name: "Time 2",
          mapId: "de_mirage",
          settingsJson: settings,
          members: {
            create: {
              steamid64,
              team: 3,
              isReady: false,
              isLeader: true,
            },
          },
        },
        include: { members: { orderBy: { joinedAt: "asc" }, include: { user: true } } },
      });
    } catch (e) {
      if (isP2002(e)) {
        lobby = await getLobbyByCodeRaw(SINGLETON_LOBBY_CODE);
      } else {
        throw e;
      }
    }
  }

  if (!lobby) {
    throw new Error("Não foi possível criar a sala");
  }

  if (!(await isMember(lobby.id, steamid64))) {
    await joinLobby(lobby.id, steamid64);
  }

  const out = await getLobbyByCodeRaw(SINGLETON_LOBBY_CODE);
  if (!out) throw new Error("sala inesperadamente inexistente");
  return out;
}

export async function leaveLobby(lobbyId: string, steamid64: string) {
  await prisma.lobbyMember.deleteMany({
    where: { lobbyId, steamid64, isLeader: false },
  });
  await touchLobby(lobbyId);
}

export async function kickMember(lobbyId: string, target: string) {
  await prisma.lobbyMember.deleteMany({
    where: { lobbyId, steamid64: target, isLeader: false },
  });
  await touchLobby(lobbyId);
}

export async function setMemberTeam(
  lobbyId: string,
  steamid64: string,
  team: number,
  maxPerTeam: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (team < 0 || team > 3) {
    return { ok: false, error: "time inválido" };
  }
  if (team === 1 || team === 2) {
    const c = await countTeam(lobbyId, team);
    const cur = await prisma.lobbyMember.findUnique({
      where: { lobbyId_steamid64: { lobbyId, steamid64 } },
    });
    const same = cur && cur.team === team;
    if (!same && c >= maxPerTeam) {
      return { ok: false, error: "time cheio" };
    }
  }
  await prisma.lobbyMember.update({
    where: { lobbyId_steamid64: { lobbyId, steamid64 } },
    data: { team },
  });
  await touchLobby(lobbyId);
  return { ok: true };
}

export async function setMemberReady(lobbyId: string, steamid64: string, ready: boolean) {
  await prisma.lobbyMember.update({
    where: { lobbyId_steamid64: { lobbyId, steamid64 } },
    data: { isReady: ready },
  });
  await touchLobby(lobbyId);
}

type LobbyWithMembers = NonNullable<Awaited<ReturnType<typeof getLobbyByCodeRaw>>>;

export async function updateLobbyLeader(
  lobby: LobbyWithMembers,
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
) {
  if (lobby.leaderSteamid64 !== leader) {
    throw new Error("só o líder");
  }
  const s = { ...parseSettings(lobby.settingsJson), ...patch.settings };
  const t1 = patch.team1Name ?? lobby.team1Name;
  const t2 = patch.team2Name ?? lobby.team2Name;
  const map = patch.mapId ?? lobby.mapId;
  const mode = patch.gameMode ?? lobby.gameMode;
  const reg = patch.region ?? lobby.region;
  const max = Math.min(8, Math.max(1, patch.maxPerTeam ?? lobby.maxPerTeam));
  return prisma.lobby.update({
    where: { id: lobby.id },
    data: {
      team1Name: t1,
      team2Name: t2,
      mapId: map,
      gameMode: mode,
      region: reg,
      maxPerTeam: max,
      settingsJson: JSON.stringify(s),
    },
    include: { members: { orderBy: { joinedAt: "asc" }, include: { user: true } } },
  });
}

export async function deleteLobby(lobby: LobbyWithMembers, leader: string) {
  if (lobby.leaderSteamid64 !== leader) {
    throw new Error("só o líder");
  }
  await prisma.lobby.delete({ where: { id: lobby.id } });
}

export type StartMatchResult =
  | { kind: "already_live"; lobby: LobbyWithMembers }
  | { kind: "started"; lobby: LobbyWithMembers };

/**
 * Põe o lobby em "live" e devolve o estado atual. Idempotente: se já estava "live",
 * não reenvia a partida (evita 2.º `matchzy_loadmatch` a cancelar o download do workshop).
 * Usa `updateMany` (open → live) para evitar duplo POST em paralelo a disparar o servidor 2x.
 */
export async function startMatch(lobby: LobbyWithMembers, leader: string): Promise<StartMatchResult> {
  if (lobby.leaderSteamid64 !== leader) {
    throw new Error("só o líder");
  }

  if (lobby.status === "live") {
    return { kind: "already_live", lobby };
  }

  const playing = lobby.members.filter((m: any) => m.team === 1 || m.team === 2);
  const notReady = playing.filter((m: any) => !m.isReady);

  if (notReady.length > 0) {
    throw new Error("nem todos os jogadores estão prontos");
  }

  const n = await prisma.lobby.updateMany({
    where: { id: lobby.id, status: "open" },
    data: { status: "live" },
  });

  if (n.count > 0) {
    const updated = await getLobbyByCodeRaw(lobby.code);
    if (!updated) throw new Error("lobby não encontrada");
    return { kind: "started", lobby: updated };
  }

  const again = await getLobbyByCodeRaw(lobby.code);
  if (again && again.status === "live") {
    return { kind: "already_live", lobby: again };
  }
  throw new Error("não foi possível iniciar o lobby (estado inesperado)");
}

/**
 * Após o MatchZy receber `css_endmatch` no servidor: lobby volta a "open" e partidas abertas a "cancelled".
 */
export async function cancelLiveLobby(lobby: LobbyWithMembers) {
  await prisma.$transaction([
    prisma.match.updateMany({
      where: { lobbyId: lobby.id, status: { in: ["warmup", "live"] } },
      data: { status: "cancelled", endedAt: new Date() },
    }),
    prisma.lobby.update({
      where: { id: lobby.id },
      data: { status: "open" },
    }),
  ]);
  const reloaded = await getLobbyByCodeRaw(lobby.code);
  if (!reloaded) throw new Error("lobby não encontrada");
  return reloaded;
}

export async function getPublicIp(): Promise<string> {
  try {
    const r = await fetch("https://api.ipify.org?format=json");
    const j = await r.json();
    return j.ip || "127.0.0.1";
  } catch {
    return "127.0.0.1";
  }
}

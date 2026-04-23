import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { defaultSettings, parseSettings, type LobbySettings } from "./lobby-types";

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

function isP2002(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
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
      return await prisma.$transaction(async (tx) => {
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
                team: 0,
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
    include: { members: { orderBy: { joinedAt: "asc" } } },
  });
}

export function getLobbyById(lobbyId: string) {
  return prisma.lobby.findUnique({
    where: { id: lobbyId },
    include: { members: { orderBy: { joinedAt: "asc" } } },
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
    data: { lobbyId, steamid64, team: 0, isReady: false, isLeader: false },
  });
  await touchLobby(lobbyId);
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
    include: { members: { orderBy: { joinedAt: "asc" } } },
  });
}

export async function deleteLobby(lobby: LobbyWithMembers, leader: string) {
  if (lobby.leaderSteamid64 !== leader) {
    throw new Error("só o líder");
  }
  await prisma.lobby.delete({ where: { id: lobby.id } });
}

export async function startMatch(lobby: LobbyWithMembers, leader: string) {
  if (lobby.leaderSteamid64 !== leader) {
    throw new Error("só o líder");
  }
  
  const playing = lobby.members.filter(m => m.team === 1 || m.team === 2);
  const notReady = playing.filter(m => !m.isReady);
  
  if (notReady.length > 0) {
    throw new Error("nem todos os jogadores estão prontos");
  }

  return prisma.lobby.update({
    where: { id: lobby.id },
    data: { status: "live" },
    include: { members: { orderBy: { joinedAt: "asc" } } },
  });
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

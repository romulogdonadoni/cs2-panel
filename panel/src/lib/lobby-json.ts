import { parseSettings } from "./lobby-types";
import type { getLobbyByCodeRaw } from "./lobby-service";

type LobbyRow = NonNullable<Awaited<ReturnType<typeof getLobbyByCodeRaw>>>;

export function jsonLobby(lobby: LobbyRow, baseUrl: string) {
  const settings = parseSettings(lobby.settingsJson);
  const cap = lobby.maxPerTeam * 2;
  const n = lobby.members.filter((m) => m.team === 1 || m.team === 2).length;
  return {
    id: lobby.id,
    code: lobby.code,
    joinUrl: `${baseUrl}/lobby/${lobby.code}`,
    shortId: lobby.code,
    leaderSteamid64: lobby.leaderSteamid64,
    team1Name: lobby.team1Name,
    team2Name: lobby.team2Name,
    mapId: lobby.mapId,
    gameMode: lobby.gameMode,
    region: lobby.region,
    maxPerTeam: lobby.maxPerTeam,
    status: lobby.status,
    settings,
    createdAt: lobby.createdAt,
    updatedAt: lobby.updatedAt,
    members: lobby.members.map((m) => ({
      steamid64: m.steamid64,
      team: m.team,
      isReady: m.isReady,
      isLeader: m.isLeader,
    })),
    fillCount: n,
    capacity: cap,
  };
}

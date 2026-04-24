import { parseSettings } from "./lobby-types";
import type { getLobbyByCodeRaw } from "./lobby-service";

type LobbyRow = NonNullable<Awaited<ReturnType<typeof getLobbyByCodeRaw>>>;

export function jsonLobby(lobby: LobbyRow, baseUrl: string) {
  const settings = parseSettings(lobby.settingsJson);
  const cap = lobby.maxPerTeam * 2;
  const n = lobby.members.filter((m: any) => m.team === 1 || m.team === 2).length;
  return {
    id: lobby.id,
    code: lobby.code,
    hasActiveMatch: lobby.status === "live",
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
    members: lobby.members.map((m: any) => {
      // @ts-ignore - The user property is conditionally loaded but type might be inferred incorrectly sometimes
      const u = m.user as { name: string; avatar: string } | undefined;
      return {
        steamid64: m.steamid64,
        team: m.team,
        isReady: m.isReady,
        isLeader: m.isLeader,
        name: u?.name || `SteamUser_${m.steamid64.slice(-5)}`,
        avatar: u?.avatar || "https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg",
      };
    }),
    fillCount: n,
    capacity: cap,
  };
}

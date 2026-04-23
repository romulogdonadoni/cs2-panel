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

export function defaultSettings(): LobbySettings {
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

export function parseSettings(json: string): LobbySettings {
  try {
    return { ...defaultSettings(), ...(JSON.parse(json) as LobbySettings) };
  } catch {
    return defaultSettings();
  }
}

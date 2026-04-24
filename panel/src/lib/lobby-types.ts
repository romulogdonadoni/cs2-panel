export type LobbySettings = {
  /** Partida 5v5 (MatchZy JSON) vs. treino (granadas, lineups — `css_prac`, sem PUG) */
  serverMode?: "match" | "training";
  lobbyVisibility?: "public" | "private";
  mapSelection?: "selected" | "vote" | "random";
  teamSelection?: "knife_round" | "captains" | "free";
  voiceChat?: "all" | "team" | "off";
  freeTeamSelect?: boolean;
  bots?: boolean;
  readyCheck?: boolean;
  extraSettings?: boolean;
  funSettings?: boolean;
  rounds?: number;
  overtime?: boolean;
  /** Lados: rodada de faca (Get5) ou sorteio CT/TR sem faca. */
  roundSides?: "knife" | "random";
};

export function defaultSettings(): LobbySettings {
  return {
    serverMode: "match",
    lobbyVisibility: "public",
    mapSelection: "selected",
    teamSelection: "knife_round",
    voiceChat: "all",
    freeTeamSelect: true,
    bots: false,
    readyCheck: true,
    extraSettings: false,
    funSettings: false,
    rounds: 13,
    overtime: true,
    roundSides: "knife",
  };
}

export function parseSettings(json: string): LobbySettings {
  try {
    return { ...defaultSettings(), ...(JSON.parse(json) as LobbySettings) };
  } catch {
    return defaultSettings();
  }
}

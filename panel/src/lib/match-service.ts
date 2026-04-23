import { prisma } from "./prisma";
import { sendRconCommand } from "./rcon";

// MatchZy envia um GET neste endpoint ao iniciar para confirmar a config.
// Nosso painel responde com o JSON de configuração da partida.
export function buildMatchZyConfig(matchId: string, lobbyId: string, mapId: string, team1: string, team2: string) {
  const webhookBase = process.env.PANEL_BASE_URL ?? "http://127.0.0.1:3080";
  return {
    matchid: matchId,
    num_maps: 1,
    maplist: [mapId],
    map_sides: ["knife"],
    clinch_series: true,
    players_per_team: 5,
    min_players_to_ready: 1,
    cvars: {
      mp_overtime_enable: "1",
      mp_overtime_maxrounds: "6",
      bot_quota: "0",
    },
    team1: { name: team1, players: {} },
    team2: { name: team2, players: {} },
    webhooks: {
      match_end_url: `${webhookBase}/api/webhooks/matchzy`,
    },
  };
}

export async function launchMatch(
  lobbyId: string,
  mapId: string,
  team1Name: string,
  team2Name: string,
  team1Players: string[],
  team2Players: string[]
) {
  // 1. Cria o registro no banco
  const match = await prisma.match.create({
    data: {
      lobbyId,
      mapId,
      team1Name,
      team2Name,
      status: "warmup",
      players: {
        create: [
          ...team1Players.map((s) => ({ steamid64: s, team: 1 })),
          ...team2Players.map((s) => ({ steamid64: s, team: 2 })),
        ],
      },
    },
  });

  // 2. Envia a config ao servidor via RCON (MatchZy loadmatch)
  const config = buildMatchZyConfig(match.id, lobbyId, mapId, team1Name, team2Name);
  const configJson = JSON.stringify(config).replace(/'/g, "\\'");

  try {
    // MatchZy aceita "matchzy_loadmatch_url" ou "matchzy_loadmatch" com JSON
    await sendRconCommand(`matchzy_loadmatch '${configJson}'`);
    await sendRconCommand(`map ${mapId}`);
  } catch (err) {
    console.error("[Match] Falha ao enviar config para o servidor:", err);
    // Não cancela — o servidor pode estar reiniciando o mapa
  }

  // 3. Atualiza o matchzyId no banco
  await prisma.match.update({
    where: { id: match.id },
    data: { matchzyId: match.id },
  });

  return match;
}

export async function getActiveMatch(lobbyId: string) {
  return prisma.match.findFirst({
    where: { lobbyId, status: { in: ["warmup", "live"] } },
    include: { players: true },
    orderBy: { startedAt: "desc" },
  });
}

export async function getMatchById(matchId: string) {
  return prisma.match.findUnique({
    where: { id: matchId },
    include: { players: true },
  });
}

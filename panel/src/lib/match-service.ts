import { join } from "node:path";
import { prisma } from "./prisma";
import { sendRconCommand } from "./rcon";
import { getComposeDir } from "./panel-constants";
import {
  prepareDiskForOneWorkshopMap,
  prepareDiskForStockMapsOnly,
  workshopMapHasAssetOnDisk,
} from "./workshop-cleanup";

/**
 * Fim de sessão no CS2. Em partida: `css_endmatch`. Em treino: `exec MatchZy/warmup.cfg` (o MatchZy
 * expõe `.exitprac` no jogo, mas o RCON não passa de jogador; o warmup reaproxima o estado).
 */
export async function endMatchOnServer(opts?: { training?: boolean }) {
  if (opts?.training) {
    try {
      await sendRconCommand("css_exitprac");
      await sendRconCommand("exec MatchZy/warmup.cfg");
    } catch {
      await sendRconCommand("css_endmatch");
    }
    return;
  }
  await sendRconCommand("css_endmatch");
}

// MatchZy envia um GET neste endpoint ao iniciar para confirmar a config.
// Nosso painel responde com o JSON de configuração da partida.
import { parseSettings } from "./lobby-types";

/** MatchZy exige int32 parseável; UUID em string faz `matchzy_loadmatch` falhar.
 * O mesmo valor tem de ir para `Match.matchzyId` (string) para o webhook encontrar a partida. */
export function getMatchZyNumericId(uuid: string): number {
  let h = 0;
  for (let i = 0; i < uuid.length; i++) {
    h = (Math.imul(31, h) + uuid.charCodeAt(i)) | 0;
  }
  const n = (Math.abs(h) | 0) & 0x7fffffff;
  return n || 1;
}

export function buildMatchZyConfig(matchId: string, lobbyId: string, mapId: string, team1: string, team2: string, settingsJson?: string) {
  const webhookBase = process.env.PANEL_BASE_URL ?? "http://127.0.0.1:3080";
  const settings = settingsJson ? parseSettings(settingsJson) : null;
  const maxrounds = (settings?.rounds === 16) ? "30" : "24";
  const ot = (settings?.overtime !== false) ? "1" : "0";
  // MatchZy: "knife" = ronda de faca; sem faca, lados = team1_ct | team1_t (como em match_side_type "random" no plugin).
  const map_sides: [string] =
    settings?.roundSides === "random"
      ? [Math.random() < 0.5 ? "team1_ct" : "team1_t"]
      : ["knife"];

  return {
    matchid: getMatchZyNumericId(matchId),
    num_maps: 1,
    maplist: [mapId],
    map_sides,
    clinch_series: true,
    players_per_team: 5,
    min_players_to_ready: 1,
    cvars: {
      mp_maxrounds: maxrounds,
      mp_overtime_enable: ot,
      mp_overtime_maxrounds: "6",
      bot_quota: "0",
      matchzy_record_demos: "1",
      // Não pôr sv_disable_teamselect_menu aqui: se 1 no warmup, o jogo fica em limbo (HUD “morto”)
      // até o MatchZy atribuir o time. O bloqueio do menu fica em knife.cfg / live.cfg.
    },
    team1: { name: team1, players: {} },
    team2: { name: team2, players: {} },
    webhooks: {
      // Opcional: eventos (map_result) vão também via matchzy_remote_log_url no **MatchZy config.cfg** do servidor
      match_end_url: `${webhookBase}/api/webhooks/matchzy-events`,
    },
  };
}

export async function launchMatch(
  lobbyId: string,
  mapId: string,
  team1Name: string,
  team2Name: string,
  team1Players: string[],
  team2Players: string[],
  settingsJson?: string
) {
  const compose = getComposeDir();
  
  // 0) Limpar qualquer estado anterior do MatchZy (partida ou treino) antes de começar.
  try {
    // Tenta sair do modo de treino se estiver ativo
    await sendRconCommand("css_exitprac");
    // Tenta encerrar qualquer partida que esteja a decorrer
    await sendRconCommand("css_endmatch");
    // Pequena pausa para o servidor processar o encerramento
    await new Promise(r => setTimeout(r, 1000));
  } catch (e) {
    console.warn("[Match] Aviso ao limpar estado anterior do MatchZy:", e);
  }

  // 1) Oficina: sem .vpk no volume, NUNCA mandar `host_workshop_map` (o motor cai "Error map!" e o RCON cai).
  if (/^\d+$/.test(mapId)) {
    await prepareDiskForOneWorkshopMap(mapId);
    if (!(await workshopMapHasAssetOnDisk(compose, mapId))) {
      const root = process.env.PANEL_COMPOSE_DIR === "/project" ? "na máquina (repo montado em /project no painel)" : "no host (PANEL_COMPOSE_DIR)";
      throw new Error(
        `Falta um ficheiro .vpk (ou .bsp) do mapa em cs2-data/.../workshop/content/730/${mapId} . O download pelo RCON in-game ` +
          "costuma falhar e rebenta o processo. Na raiz do repositório do servidor corre: " +
          "`./scripts/workshop-steamcmd-download.sh " +
          mapId +
          "` (Docker) e tenta de novo. Os outros mapas deixam de ser apagados ao mudares o ID. " +
          `(${root})`
      );
    }
    console.log(`[Match] Workshop ${mapId}: VPK no cs2-data; a carregar com host_workshop_map.`);
    await new Promise((r) => setTimeout(r, 500));
    await sendRconCommand(`host_workshop_map ${mapId}`);
  } else {
    await prepareDiskForStockMapsOnly();
  }

  const st = parseSettings(settingsJson || "{}");
  const training = st.serverMode === "training";

  // 2. Cria o registro no banco
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

  // 3) Treino: mapa + cfg de prática (não `matchzy_loadmatch`). O `css_prac` no RCON muitas vezes
  // "passa" sem erro, mas o plugin rejeita (sem admin na consola) e não aplica cvars; por isso
  // SEMPRE `exec MatchZy/prac.cfg` (sv_infinite_ammo, dinheiro, trajectórias, etc.) após o mapa
  // estabilizar. Aviso: se `exec` for cedo, o fim do `changelevel` repõe cvars (Mirage ainda no
  // sítio / reinício curto; outros mapas demoram +); por isso esperas longas e um 2.º `exec` após
  // buffer extra.
  if (training) {
    const waitAfterMapStockMs = 10_000;
    const waitAfterWorkshopMs = 10_000;
    const reapplyPracBufferMs = 4_000;

    const applyPrac = async (tag: string) => {
      await sendRconCommand("exec MatchZy/prac.cfg");
      console.log(`[Match] Treino: exec MatchZy/prac.cfg (${tag})`);
    };

    try {
      if (!/^\d+$/.test(mapId)) {
        await sendRconCommand(`map ${mapId}`);
        await new Promise((r) => setTimeout(r, waitAfterMapStockMs));
      } else {
        // host_workshop_map já correu no passo 1; o RCON devolve antes do mapa estar pronto.
        await new Promise((r) => setTimeout(r, waitAfterWorkshopMs));
      }
      await applyPrac("1.ª após carga do mapa");
      await new Promise((r) => setTimeout(r, reapplyPracBufferMs));
      await applyPrac("2.ª: fixar cvars pós-mudança de nível (evita outro mapa “sem prac”)");
      try {
        await sendRconCommand("css_prac");
      } catch (e) {
        console.warn("[Match] Treino: css_prac após prac.cfg (estado do plugin) —", e);
      }
      await prisma.match.update({
        where: { id: match.id },
        data: { matchzyId: String(getMatchZyNumericId(match.id)) },
      });
      return match;
    } catch (err) {
      console.error("[Match] Treino: falha RCON:", err);
      try {
        await prisma.match.delete({ where: { id: match.id } });
      } catch {
        // ignora
      }
      throw err;
    }
  }

  // 3b. Envia a config PUG via arquivo JSON local
  const matchDir = join(compose, "cs2-data", "game", "csgo", "matches");
  const matchFile = `match_${match.id}.json`;
  const fullPath = join(matchDir, matchFile);

  try {
    const fs = await import("node:fs/promises");

    await fs.mkdir(matchDir, { recursive: true });

    const config = buildMatchZyConfig(match.id, lobbyId, mapId, team1Name, team2Name, settingsJson);
    // Preencher players
    team1Players.forEach(s => { (config.team1.players as any)[s] = ""; });
    team2Players.forEach(s => { (config.team2.players as any)[s] = ""; });
    
    await fs.writeFile(fullPath, JSON.stringify(config, null, 2));
    console.log(`[Match] Configuração escrita em ${fullPath}`);

    // MatchZy carregar via arquivo (sem aspas para evitar bugs de parse no RCON)
    await sendRconCommand(`matchzy_loadmatch matches/${matchFile}`);
    
    await new Promise(r => setTimeout(r, 1000));

    // Mapa stock: o MatchZy já faz `changelevel` a partir de `maplist` após load com sucesso.
    // Mapa numérico (workshop): o MatchZy chama `host_workshop_map` sozinho; não duplicar aqui.
    if (!/^\d+$/.test(mapId)) {
      await sendRconCommand(`map ${mapId}`);
    }

    await prisma.match.update({
      where: { id: match.id },
      data: { matchzyId: String(getMatchZyNumericId(match.id)) },
    });

    return match;
  } catch (err) {
    console.error("[Match] Falha ao enviar comandos RCON ou escrever arquivo:", err);
    try {
      await prisma.match.delete({ where: { id: match.id } });
    } catch {
      // já apagado ou inexistente
    }
    throw err;
  }
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

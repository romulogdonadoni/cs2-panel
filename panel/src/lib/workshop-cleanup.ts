import { join } from "node:path";
import { readdir, rm, stat } from "node:fs/promises";
import { getComposeDir } from "./panel-constants";

const APP_ID = "730";

function getGameRoot(): string {
  return join(getComposeDir(), "cs2-data", "game");
}

/** Download bruto (Steam) para mapas de workshop. */
function workshopContent730Path(): string {
  return join(
    getGameRoot(),
    "bin",
    "linuxsteamrt64",
    "steamapps",
    "workshop",
    "content",
    APP_ID
  );
}

function communityAddonsPath(): string {
  return join(getGameRoot(), "csgo_community_addons");
}

function workshopSubdir(relative: string): string {
  return join(
    getGameRoot(),
    "bin",
    "linuxsteamrt64",
    "steamapps",
    "workshop",
    relative
  );
}

async function rmPathIfExists(p: string): Promise<void> {
  try {
    await stat(p);
    await rm(p, { recursive: true, force: true });
  } catch {
    // não existe
  }
}

/**
 * Apaga tudo de `.../workshop/content/730/`, exceto a pasta cujo nome é `keepFileId` (só dígitos).
 * Se `keepFileId` for null, apaga todo o conteúdo.
 */
export async function pruneWorkshopFileIds(keepFileId: string | null): Promise<void> {
  const root = workshopContent730Path();
  let names: string[];
  try {
    names = await readdir(root);
  } catch {
    return;
  }
  for (const name of names) {
    if (!/^\d+$/.test(name)) continue;
    if (keepFileId !== null && name === keepFileId) continue;
    const p = join(root, name);
    await rmPathIfExists(p);
    console.log(`[Workshop] Removido download da oficina: ${p}`);
  }
}

/**
 * Remove subpastas (mapas extraídos) de `csgo_community_addons/`.
 * Não remove ficheiros soltos no nível de raiz (se houver).
 */
export async function pruneAllCommunityAddonFolders(): Promise<void> {
  const root = communityAddonsPath();
  let names: string[];
  try {
    names = await readdir(root);
  } catch {
    return;
  }
  for (const name of names) {
    if (name === "." || name === "..") continue;
    const p = join(root, name);
    try {
      if ((await stat(p)).isDirectory()) {
        await rm(p, { recursive: true, force: true });
        console.log(`[Workshop] Removida pasta community addon: ${name}`);
      }
    } catch {
      // ignora
    }
  }
}

/**
 * Ficheiros temporários do cliente Steam (workshop) — aliviar disco; recria-se com novo download.
 */
export async function pruneWorkshopCacheDirs(): Promise<void> {
  for (const part of ["temp", "downloads"] as const) {
    const root = workshopSubdir(part);
    let names: string[];
    try {
      names = await readdir(root);
    } catch {
      continue;
    }
    for (const name of names) {
      const p = join(root, name);
      try {
        await rm(p, { recursive: true, force: true });
      } catch {
        // ignora
      }
    }
  }
}

/**
 * Não apagar outras pastas de `.../workshop/content/730/`.
 * Apagar outros IDs ao trocar de mapa oficina removia VPKs já descarregados, o
 * utilizador trocava o ID, e o novo mapa ainda sem ficheiro rebentava o servidor
 * a `host_workshop_map` (Error map! / RCON a falhar). Liberta-se espaço fora
 * do jogo, se for preciso, à mão.
 */
export async function prepareDiskForOneWorkshopMap(_keepFileId: string): Promise<void> {
  return;
}

/**
 * Partida com mapa oficial: não apagar `.../workshop/content/730/*`.
 * Apagar tudo aí (como fazíamos com `pruneWorkshopFileIds(null)`) removia os VPKs
 * entre uma partida stock e a próxima workshop — o ACF ainda listava o item, mas
 * a pasta no volume ficava vazia e `host_workshop_map` falhava.
 */
export async function prepareDiskForStockMapsOnly(): Promise<void> {
  await pruneAllCommunityAddonFolders();
  await pruneWorkshopCacheDirs();
}

/** Já existe .vpk/.bsp do item no path que o jogo e o painel usam. */
export async function workshopMapHasAssetOnDisk(
  composeDir: string,
  fileId: string
): Promise<boolean> {
  if (!/^\d+$/.test(fileId)) {
    return true;
  }
  const a = await hasUsableWorkshopAssetInDir(
    workshopIdContentDir(composeDir, fileId)
  );
  if (a) {
    return true;
  }
  return hasUsableWorkshopAssetInDir(
    workshopCommunityDir(composeDir, fileId)
  );
}

function workshopIdContentDir(composeDir: string, fileId: string): string {
  return join(
    composeDir,
    "cs2-data",
    "game",
    "bin",
    "linuxsteamrt64",
    "steamapps",
    "workshop",
    "content",
    "730",
    fileId
  );
}

function workshopCommunityDir(composeDir: string, fileId: string): string {
  return join(composeDir, "cs2-data", "game", "csgo_community_addons", fileId);
}

/** Pelo menos um .vpk ou .bsp (evita falso positivo com pasta vazia / só a criar). */
async function hasUsableWorkshopAssetInDir(p: string): Promise<boolean> {
  try {
    const names = await readdir(p);
    for (const n of names) {
      if (n === "." || n === "..") continue;
      if (/\.(vpk|bsp)$/i.test(n)) {
        return true;
      }
      const sub = join(p, n);
      try {
        if ((await stat(sub)).isDirectory()) {
          const inner = await readdir(sub);
          if (inner.some((f) => /\.(vpk|bsp)$/i.test(f))) {
            return true;
          }
        }
      } catch {
        // ignora
      }
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Após RCON `host_workshop_map <id>`, o Steam despeja ficheiros em `.../workshop/content/730/<id>/`
 * e/ou em `csgo_community_addons/<id>/`. Espera até existir, ou o timeout.
 */
export async function waitForWorkshopMapOnDisk(
  composeDir: string,
  fileId: string,
  maxMs = 180_000,
  intervalMs = 2_000
): Promise<boolean> {
  if (!/^\d+$/.test(fileId)) {
    return true;
  }
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const a = await hasUsableWorkshopAssetInDir(
      workshopIdContentDir(composeDir, fileId)
    );
    const b = await hasUsableWorkshopAssetInDir(
      workshopCommunityDir(composeDir, fileId)
    );
    if (a || b) {
      return true;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

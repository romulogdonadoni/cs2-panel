import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const KNOWN_ORDER = [
  "SRCDS_TOKEN",
  "CS2_SERVERNAME",
  "CS2_STARTMAP",
  "CS2_MAPGROUP",
  "CS2_GAMETYPE",
  "CS2_GAMEMODE",
  "CS2_MAXPLAYERS",
  "CS2_RCONPW",
  "CS2_PW",
  "CS2_HOST_WORKSHOP_MAP",
  "CS2_HOST_WORKSHOP_COLLECTION",
  "CS2_GAMEALIAS",
  "PANEL_PORT",
  "PANEL_BASE_URL",
  "SESSION_SECRET",
  "LOADOUT_API_KEY",
  "PANEL_DATA_DIR",
  "PANEL_COMPOSE_DIR",
  "ADMIN_STEAMID64S",
  "FACEIT_API_KEY",
] as const;

function parseEnvContent(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) {
      continue;
    }
    const eq = t.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    out[k] = v;
  }
  return out;
}

export function readServerEnvFile(projectDir: string): Record<string, string> {
  const p = resolve(projectDir, ".env");
  if (!existsSync(p)) {
    return {};
  }
  return parseEnvContent(readFileSync(p, "utf8"));
}

export function writeServerEnvFile(projectDir: string, updates: Record<string, string>): void {
  const p = resolve(projectDir, ".env");
  const current = readServerEnvFile(projectDir);
  const next = { ...current, ...updates };
  const lines: string[] = [
    "# Gerado/atualizado pelo painel. Revise antes de commitar.",
  ];
  for (const k of KNOWN_ORDER) {
    if (k in next) {
      lines.push(`${k}=${next[k]!}`);
    }
  }
  for (const k of Object.keys(next).sort()) {
    if ((KNOWN_ORDER as readonly string[]).includes(k)) {
      continue;
    }
    lines.push(`${k}=${next[k]!}`);
  }
  writeFileSync(p, lines.join("\n") + "\n", "utf8");
}

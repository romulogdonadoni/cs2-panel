import { join, resolve } from "node:path";

export function getPanelBaseUrl(): string {
  const port = process.env.PORT || "3080";
  return (process.env.PANEL_BASE_URL || `http://127.0.0.1:${port}`).replace(/\/$/, "");
}

export function getDataDir(): string {
  return process.env.PANEL_DATA_DIR
    ? resolve(process.env.PANEL_DATA_DIR)
    : join(process.cwd(), "data");
}

export function getComposeDir(): string {
  return process.env.PANEL_COMPOSE_DIR
    ? resolve(process.env.PANEL_COMPOSE_DIR)
    : resolve(process.cwd(), "..");
}

export function baseOpenIdRealm(): string {
  try {
    const u = new URL(getPanelBaseUrl());
    return `${u.origin}/`;
  } catch {
    return "http://127.0.0.1/";
  }
}

export function steamReturnToUrl(): string {
  return `${getPanelBaseUrl()}/auth/steam/return`;
}

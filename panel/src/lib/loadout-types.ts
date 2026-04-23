/**
 * Estrutura v1: uma skin por `weaponId` (ex.: weapon_ak47) com desgaste (float) e StatTrak.
 */
export type WeaponSlotConfig = {
  skinId: string;
  name?: string;
  /** Desgaste no intervalo canónico da skin (0–1) */
  float: number;
  stattrak: boolean;
};

export type LoadoutV1 = {
  version: 1;
  weapons: Record<string, WeaponSlotConfig>;
  agent_ct?: string;
  agent_t?: string;
  music?: string;
};

export function defaultLoadout(): LoadoutV1 {
  return { version: 1, weapons: {} };
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function midFloat(min: number, max: number): number {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return 0.5;
  }
  return (min + max) / 2;
}

export function normalizeLoadout(raw: unknown): LoadoutV1 {
  if (!raw || typeof raw !== "object") {
    return defaultLoadout();
  }
  const o = raw as Record<string, unknown>;
  const weapons: Record<string, WeaponSlotConfig> = {};
  if (o.weapons && typeof o.weapons === "object" && o.weapons) {
    for (const [wid, w] of Object.entries(o.weapons as Record<string, unknown>)) {
      if (!w || typeof w !== "object") {
        continue;
      }
      const ws = w as Record<string, unknown>;
      if (typeof ws.skinId !== "string") {
        continue;
      }
      const fl = typeof ws.float === "number" && Number.isFinite(ws.float) ? ws.float : 0.5;
      weapons[wid] = {
        skinId: ws.skinId,
        name: typeof ws.name === "string" ? ws.name : undefined,
        float: clamp(fl, 0, 1),
        stattrak: Boolean(ws.stattrak),
      };
    }
  }
  return {
    version: 1,
    weapons,
    agent_ct: typeof o.agent_ct === "string" ? o.agent_ct : undefined,
    agent_t: typeof o.agent_t === "string" ? o.agent_t : undefined,
    music: typeof o.music === "string" ? o.music : undefined,
  };
}

export function toPersist(l: LoadoutV1): Record<string, unknown> {
  return { ...l, version: 1 };
}

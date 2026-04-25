import { type SkinCatalogRow } from "@/components/skin-config-modal";

export type Music = { id: number; name: string; image: string; team?: 0 | 2 | 3 };
export type Pin = { id: number; name: string; image: string; team?: 0 | 2 | 3 };
export type Agent = {
  id: string;
  name: string;
  image: string;
  def_index: string;
  model_player: string | null;
  team: { id: string; name: string };
  rarity: { name: string; color: string };
};
export type Skin = SkinCatalogRow & {
  paint_index: string;
  weapon: { id: string; name: string; weapon_id?: number };
  rarity: { name: string; color: string };
};
export type Saved = {
  weapon_defindex: number;
  weapon_paint_id: number;
  weapon_wear: number;
  weapon_stattrak: 0 | 1;
  weapon_team: 0 | 2 | 3;
};

export type LoadoutSlotType = "weapon" | "knife" | "glove" | "agent" | "music" | "pin";

export type PickingSlot = {
  defindex: number;
  label: string;
  team: "ct" | "t";
  type: LoadoutSlotType;
  weaponId?: string;
};

export const DEFINDEX: Record<string, number> = {
  ak47: 7,
  m4a1_s: 60,
  m4a4: 16,
  awp: 9,
  deagle: 1,
  usp_s: 61,
  glock: 4,
  p250: 36,
  fiveseven: 3,
  tec9: 30,
  hkp2000: 32,
  cz75a: 63,
  revolver: 64,
  elite: 2,
  mp9: 34,
  mac10: 17,
  mp7: 33,
  ump45: 24,
  bizon: 26,
  p90: 19,
  mp5sd: 23,
  famas: 10,
  sg556: 39,
  aug: 8,
  galil: 13,
  m249: 14,
  negev: 28,
  nova: 35,
  mag7: 27,
  sawedoff: 29,
  xm1014: 25,
  ssg08: 40,
  g3sg1: 11,
  scar20: 38,
  bayonet: 500,
  knife_flip: 505,
  knife_gut: 506,
  knife_karambit: 507,
  knife_m9_bayonet: 508,
  knife_tactical: 509,
  knife_falchion: 512,
  knife_survival_bowie: 514,
  knife_butterfly: 515,
  knife_push: 516,
  knife_cord: 517,
  knife_canis: 518,
  knife_ursus: 519,
  knife_gypsy_jackknife: 520,
  knife_outdoor: 521,
  knife_stiletto: 522,
  knife_widowmaker: 523,
  knife_skeleton: 525,
  knife_kukri: 526,
  knife_classic: 503,
  knife_css: 503,
  leather_handwraps: 5032,
  sport_gloves: 5030,
  motorcycle_gloves: 5033,
  specialist_gloves: 5034,
  driver_gloves: 5031,
  hydra_gloves: 5035,
  brokenfang_gloves: 4725,
  bloodhound_gloves: 5027,
};

export const GLOVES = new Set([4725, 5027, 5030, 5031, 5032, 5033, 5034, 5035]);
export const KNIVES = new Set([500, 503, 505, 506, 507, 508, 509, 512, 514, 515, 516, 517, 518, 519, 520, 521, 522, 523, 525, 526]);

export function catalogSkinDefindex(s: { weapon: { id: string; weapon_id?: number } }): number {
  const w = Number(s.weapon?.weapon_id);
  if (Number.isFinite(w) && w > 0) return w;
  const d = DEFINDEX[s.weapon.id];
  return typeof d === "number" && d > 0 ? d : 0;
}

export const CT_WEAPONS = new Set([
  "weapon_m4a1_silencer",
  "weapon_m4a1",
  "weapon_famas",
  "weapon_mp9",
  "weapon_mag7",
  "weapon_scar20",
  "weapon_hkp2000",
  "weapon_usp_silencer",
  "weapon_p2000",
]);
export const T_WEAPONS = new Set([
  "weapon_ak47",
  "weapon_galil",
  "weapon_mac10",
  "weapon_tec9",
  "weapon_g3sg1",
  "weapon_glock",
  "weapon_sg556",
]);

export const RARITY: Record<string, string> = {
  "Consumer Grade": "#b0c3d9",
  "Industrial Grade": "#5e98d9",
  "Mil-Spec Grade": "#4b69ff",
  Restricted: "#8847ff",
  Classified: "#d32ee6",
  Covert: "#eb4b4b",
  Extraordinary: "#e4ae39",
  Consumidor: "#b0c3d9",
  Restrito: "#8847ff",
  Classificado: "#d32ee6",
  Secreto: "#eb4b4b",
  Extraordinário: "#e4ae39",
};

export const CATEGORIES = [
  { id: "loadout", label: "Loadout", icon: "◈" },
  { id: "knife", label: "Facas", icon: "🗡" },
  { id: "gloves", label: "Luvas", icon: "🧤" },
  { id: "agents", label: "Agentes", icon: "🧑" },
  { id: "rifle", label: "Rifles", icon: "🎯" },
  { id: "sniper", label: "Sniper", icon: "🔭" },
  { id: "pistol", label: "Pistolas", icon: "🔫" },
  { id: "smg", label: "SMG", icon: "⚡" },
  { id: "shotgun", label: "Shotgun", icon: "💥" },
  { id: "heavy", label: "Pesado", icon: "🛡" },
  { id: "music", label: "Músicas", icon: "🎵" },
  { id: "pins", label: "Pins", icon: "🏅" },
];

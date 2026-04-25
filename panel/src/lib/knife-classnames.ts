/** Defindex CS2 → classname em wp_player_knife (WeaponPaints). */
export const KNIFE_DEFINDEX_TO_CLASSNAME: Record<number, string> = {
  500: "weapon_bayonet",
  505: "weapon_knife_flip",
  506: "weapon_knife_gut",
  507: "weapon_knife_karambit",
  508: "weapon_knife_m9_bayonet",
  509: "weapon_knife_tactical",
  512: "weapon_knife_falchion",
  514: "weapon_knife_survival_bowie",
  515: "weapon_knife_butterfly",
  516: "weapon_knife_push",
  517: "weapon_knife_cord",
  518: "weapon_knife_canis",
  519: "weapon_knife_ursus",
  520: "weapon_knife_gypsy_jackknife",
  521: "weapon_knife_outdoor",
  522: "weapon_knife_stiletto",
  523: "weapon_knife_widowmaker",
  525: "weapon_knife_skeleton",
  526: "weapon_knife_kukri",
  503: "weapon_knife_css",
};

export const KNIFE_CLASSNAME_TO_DEFINDEX: Record<string, number> = Object.fromEntries(
  Object.entries(KNIFE_DEFINDEX_TO_CLASSNAME).map(([d, c]) => [c, Number(d)])
) as Record<string, number>;

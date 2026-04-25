import { useMemo, useState } from "react";
import { RemoteInventoryImage } from "@/components/remote-inventory-image";
import {
  type Agent,
  type Music,
  type Pin,
  type PickingSlot,
  type LoadoutSlotType,
  type Saved,
  type Skin,
  KNIVES,
  GLOVES,
  catalogSkinDefindex,
} from "./types";

const WEAPONS = [
  { def: 1, label: "Desert Eagle", id: "weapon_deagle", team: "both" as const, category: "pistols" },
  { def: 2, label: "Dual Berettas", id: "weapon_elite", team: "both" as const, category: "pistols" },
  { def: 3, label: "Five-SeveN", id: "weapon_fiveseven", team: "ct" as const, category: "pistols" },
  { def: 4, label: "Glock-18", id: "weapon_glock", team: "t" as const, category: "pistols" },
  { def: 30, label: "Tec-9", id: "weapon_tec9", team: "t" as const, category: "pistols" },
  { def: 32, label: "P2000", id: "weapon_hkp2000", team: "ct" as const, category: "pistols" },
  { def: 36, label: "P250", id: "weapon_p250", team: "both" as const, category: "pistols" },
  { def: 61, label: "USP-S", id: "weapon_usp_silencer", team: "ct" as const, category: "pistols" },
  { def: 63, label: "CZ75-Auto", id: "weapon_cz75a", team: "both" as const, category: "pistols" },
  { def: 64, label: "R8 Revolver", id: "weapon_revolver", team: "both" as const, category: "pistols" },

  { def: 17, label: "MAC-10", id: "weapon_mac10", team: "t" as const, category: "mid" },
  { def: 19, label: "P90", id: "weapon_p90", team: "both" as const, category: "mid" },
  { def: 23, label: "MP5-SD", id: "weapon_mp5sd", team: "both" as const, category: "mid" },
  { def: 24, label: "UMP-45", id: "weapon_ump45", team: "both" as const, category: "mid" },
  { def: 25, label: "XM1014", id: "weapon_xm1014", team: "both" as const, category: "mid" },
  { def: 26, label: "PP-Bizon", id: "weapon_bizon", team: "both" as const, category: "mid" },
  { def: 27, label: "MAG-7", id: "weapon_mag7", team: "ct" as const, category: "mid" },
  { def: 28, label: "Negev", id: "weapon_negev", team: "both" as const, category: "mid" },
  { def: 29, label: "Sawed-Off", id: "weapon_sawedoff", team: "t" as const, category: "mid" },
  { def: 33, label: "MP7", id: "weapon_mp7", team: "both" as const, category: "mid" },
  { def: 34, label: "MP9", id: "weapon_mp9", team: "ct" as const, category: "mid" },
  { def: 35, label: "Nova", id: "weapon_nova", team: "both" as const, category: "mid" },
  { def: 14, label: "M249", id: "weapon_m249", team: "both" as const, category: "mid" },

  { def: 7, label: "AK-47", id: "weapon_ak47", team: "t" as const, category: "rifles" },
  { def: 8, label: "AUG", id: "weapon_aug", team: "ct" as const, category: "rifles" },
  { def: 9, label: "AWP", id: "weapon_awp", team: "both" as const, category: "rifles" },
  { def: 10, label: "FAMAS", id: "weapon_famas", team: "ct" as const, category: "rifles" },
  { def: 11, label: "G3SG1", id: "weapon_g3sg1", team: "t" as const, category: "rifles" },
  { def: 13, label: "Galil AR", id: "weapon_galil", team: "t" as const, category: "rifles" },
  { def: 16, label: "M4A4", id: "weapon_m4a4", team: "ct" as const, category: "rifles" },
  { def: 38, label: "SCAR-20", id: "weapon_scar20", team: "ct" as const, category: "rifles" },
  { def: 39, label: "SG 553", id: "weapon_sg556", team: "t" as const, category: "rifles" },
  { def: 40, label: "SSG 08", id: "weapon_ssg08", team: "both" as const, category: "rifles" },
  { def: 60, label: "M4A1-S", id: "weapon_m4a1_silencer", team: "ct" as const, category: "rifles" },
];

/** Meta / “Tier 2” — blocos horizontais médios (span 2 cols) */
function tier2DefindexOrder(team: "ct" | "t"): number[] {
  if (team === "ct") return [9, 16, 60, 8, 10, 1];
  return [9, 7, 39, 13, 1, 40];
}

function tier2Set(team: "ct" | "t"): Set<number> {
  return new Set(tier2DefindexOrder(team));
}

type CardVariant = "showcase" | "meta" | "standard" | "accessory" | "accessoryPin";

export function LoadoutGrid({
  savedList,
  skins,
  handleRemove,
  onSlotClick,
  music,
  pin,
  agents,
  removeAgent,
  onConfigureSlot,
}: {
  savedList: Saved[];
  skins: Skin[];
  handleRemove: (def: number, paint: number, slotTeam: "ct" | "t") => void;
  onSlotClick: (slot: PickingSlot) => void;
  music: { ct: Music | null; t: Music | null };
  pin: { ct: Pin | null; t: Pin | null };
  agents: { ct: Agent | null; t: Agent | null };
  removeAgent: (side: "ct" | "t") => void;
  onConfigureSlot?: (payload: { skin: Skin; saved: Saved; slotTeam: "ct" | "t"; label: string }) => void;
}) {
  const [activeTeam, setActiveTeam] = useState<"ct" | "t">("ct");
  const [selectedSlotKey, setSelectedSlotKey] = useState<string | null>(null);

  const team = activeTeam;
  const weaponsForSide = useMemo(
    () => WEAPONS.filter((w) => w.team === "both" || w.team === team),
    [team]
  );

  const { tier2List, tier3List } = useMemo(() => {
    const t2 = tier2Set(team);
    const order = tier2DefindexOrder(team);
    const tier2Weapons = order
      .map((def) => weaponsForSide.find((w) => w.def === def))
      .filter((w): w is (typeof WEAPONS)[number] => Boolean(w));
    const tier3Weapons = weaponsForSide.filter((w) => !t2.has(w.def));
    return { tier2List: tier2Weapons, tier3List: tier3Weapons };
  }, [weaponsForSide, team]);

  const tier3Groups = useMemo(
    () => ({
      pistols: tier3List.filter((w) => w.category === "pistols").slice(0, 6),
      mid: tier3List.filter((w) => w.category === "mid").slice(0, 9),
      rifles: tier3List.filter((w) => w.category === "rifles").slice(0, 6),
    }),
    [tier3List]
  );

  const renderItem = (
    defindex: number,
    label: string,
    weaponId: string,
    teamSlot: "ct" | "t",
    type: LoadoutSlotType = "weapon",
    opts: { variant?: CardVariant; gridClass?: string } = {}
  ) => {
    const variant = opts.variant ?? "standard";
    const gridClass = opts.gridClass ?? "";

    let savedItem: Saved | undefined;
    let currentSkin: Skin | undefined;
    let displayLabel = "Padrão";
    let displayImage: string | undefined;
    let vanillaImage: string | null = null;

    if (type === "knife" || type === "glove") {
      savedItem = savedList.find((s) => {
        const wt = Number(s.weapon_team);
        const tMatch = wt === 0 || (teamSlot === "ct" ? wt === 3 : wt === 2);
        if (!tMatch) return false;
        const di = Number(s.weapon_defindex);
        if (type === "glove") return GLOVES.has(di);
        return KNIVES.has(di);
      });
    } else if (type === "agent") {
      const ag = teamSlot === "ct" ? agents.ct : agents.t;
      if (ag) {
        displayLabel = ag.name;
        displayImage = ag.image;
      }
    } else if (type === "music") {
      const m = teamSlot === "ct" ? music.ct : music.t;
      if (m) {
        displayLabel = m.name;
        displayImage = m.image;
      }
    } else if (type === "pin") {
      const p = teamSlot === "ct" ? pin.ct : pin.t;
      if (p) {
        displayLabel = p.name;
        displayImage = p.image;
      }
    } else {
      savedItem = savedList.find((s) => {
        const wt = Number(s.weapon_team);
        const tMatch = wt === 0 || (teamSlot === "ct" ? wt === 3 : wt === 2);
        return Number(s.weapon_defindex) === defindex && tMatch;
      });
    }

    if (savedItem && type !== "agent" && type !== "music" && type !== "pin") {
      currentSkin = skins.find((sk) => {
        const skDef = catalogSkinDefindex(sk);
        const matchesDef = skDef === Number(savedItem!.weapon_defindex);
        const matchesPaint =
          parseInt(String(sk.paint_index ?? "0"), 10) === Number(savedItem!.weapon_paint_id);
        return matchesDef && matchesPaint;
      });
      if (currentSkin) displayLabel = currentSkin.name;
      else displayLabel = `Defindex ${savedItem.weapon_defindex}`;
    }

    if (type === "weapon" && !currentSkin) {
      const vanilla = skins.find((sk) => {
        const skDef = catalogSkinDefindex(sk);
        return skDef === defindex && parseInt(String(sk.paint_index ?? "0"), 10) === 0;
      });
      if (vanilla) vanillaImage = vanilla.image;
    }

    const img = currentSkin?.image ?? displayImage ?? vanillaImage;
    const canConfigure =
      savedItem &&
      currentSkin &&
      onConfigureSlot &&
      (type === "weapon" || type === "knife" || type === "glove");

    const labelCls =
      variant === "showcase"
        ? "mb-1 text-[10px] font-black uppercase leading-tight tracking-wide text-zinc-400 sm:text-[11px]"
        : variant === "meta"
          ? "mb-0.5 text-[10px] font-black uppercase leading-tight tracking-wide text-zinc-400"
          : variant === "accessory" || variant === "accessoryPin"
            ? "mb-0.5 truncate text-[9px] font-black uppercase tracking-wide text-zinc-400"
            : "mb-0.5 truncate text-[8px] font-black uppercase leading-tight tracking-wide text-zinc-500";

    const imgWrapCls =
      variant === "showcase"
        ? "relative min-h-0 flex-1 overflow-hidden py-1"
        : variant === "meta"
          ? "relative max-h-[4.75rem] min-h-0 shrink-0 overflow-hidden py-1 sm:max-h-[5.25rem]"
          : variant === "accessory"
            ? "relative min-h-0 flex-1 overflow-hidden py-0.5"
            : variant === "accessoryPin"
              ? "relative h-10 shrink-0 overflow-hidden"
              : "relative h-[2.85rem] shrink-0 overflow-hidden sm:h-[3.1rem]";

    const imgCls =
      variant === "showcase"
        ? "absolute inset-0 h-full w-full object-contain transition duration-300 group-hover:scale-[1.02]"
        : variant === "meta"
          ? "absolute inset-0 h-full w-full object-contain transition group-hover:scale-[1.02]"
          : variant === "accessory"
            ? "absolute inset-0 h-full w-full object-contain transition group-hover:scale-[1.02]"
            : variant === "accessoryPin"
              ? "absolute inset-0 h-full w-full object-contain"
              : "absolute inset-0 h-full w-full object-contain transition group-hover:scale-[1.03]";

    const titleCls =
      variant === "showcase"
        ? "line-clamp-3 text-left text-xs font-bold leading-snug text-zinc-100 sm:text-sm"
        : variant === "meta"
          ? "line-clamp-2 text-center text-xs font-bold leading-snug text-zinc-50"
          : variant === "accessory" || variant === "accessoryPin"
            ? "line-clamp-2 text-center text-[11px] font-semibold leading-tight text-zinc-100"
            : "truncate text-center text-[11px] font-semibold leading-tight text-zinc-100";

    const pad =
      variant === "showcase"
        ? "p-1.5 sm:p-2"
        : variant === "meta"
          ? "p-2 sm:p-2.5"
          : variant === "accessory" || variant === "accessoryPin"
            ? "p-1.5"
            : "p-1 sm:p-1.5";

    const removeTop =
      variant === "showcase" || variant === "meta"
        ? "right-2 top-2"
        : variant === "accessoryPin"
          ? "right-1 top-1"
          : "right-1 top-5 sm:top-6";

    const slotKey = `${teamSlot}-${defindex}-${label}-${type}`;
    const isSelected = selectedSlotKey === slotKey;
    const interactiveGlow =
      variant === "standard"
        ? "hover:shadow-[0_0_0_1px_rgba(245,158,11,0.45),0_10px_24px_rgba(0,0,0,0.35)]"
        : "hover:shadow-[0_0_0_1px_rgba(245,158,11,0.45),0_12px_28px_rgba(0,0,0,0.4)]";

    return (
      <div
        key={slotKey}
        onClick={() => {
          setSelectedSlotKey(slotKey);
          onSlotClick({ defindex, label, team: teamSlot, type, weaponId });
        }}
        className={`group relative flex h-full min-h-0 cursor-pointer flex-col overflow-hidden rounded-xl border bg-zinc-900/60 transition ${interactiveGlow} ${
          isSelected
            ? "border-amber-400/70 shadow-[0_0_0_1px_rgba(245,158,11,0.6),0_12px_30px_rgba(0,0,0,0.45)]"
            : "border-white/10 shadow-sm hover:border-amber-500/40 hover:bg-zinc-900/92"
        } ${pad} ${gridClass}`}
      >
        <div className={`min-h-0 shrink-0 ${labelCls}`}>{label}</div>
        <div className={imgWrapCls}>
          {img ? (
            <RemoteInventoryImage src={img} alt={displayLabel} className={imgCls} fallbackChar="🎯" />
          ) : (
            <div
              className={
                variant === "showcase"
                  ? "flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/90 text-lg text-zinc-500"
                  : "flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800/90 text-sm text-zinc-500"
              }
            >
              ◆
            </div>
          )}
        </div>
        <div className={`mt-auto min-h-0 shrink-0 pt-0.5 ${variant === "accessoryPin" ? "px-0" : ""}`}>
          <p className={titleCls} title={displayLabel}>
            {displayLabel}
          </p>
        </div>

        {type === "agent" && (teamSlot === "ct" ? agents.ct : agents.t) && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeAgent(teamSlot);
            }}
            className={`absolute ${removeTop} z-10 flex h-6 w-6 items-center justify-center rounded-full bg-red-500/85 text-[10px] text-white opacity-0 transition hover:bg-red-500 group-hover:opacity-100`}
          >
            ✕
          </button>
        )}
        {savedItem && type !== "agent" && type !== "music" && type !== "pin" && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleRemove(Number(savedItem!.weapon_defindex), Number(savedItem!.weapon_paint_id), teamSlot);
            }}
            className={`absolute ${removeTop} z-10 flex h-6 w-6 items-center justify-center rounded-full bg-red-500/85 text-[10px] text-white opacity-0 transition hover:bg-red-500 group-hover:opacity-100`}
          >
            ✕
          </button>
        )}
        {canConfigure && (
          <button
            type="button"
            title="Configurar float, StatTrak, stickers"
            onClick={(e) => {
              e.stopPropagation();
              onConfigureSlot!({
                skin: currentSkin!,
                saved: savedItem!,
                slotTeam: teamSlot,
                label,
              });
            }}
            className="absolute bottom-1.5 right-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-neutral-950/90 text-xs text-amber-400 opacity-0 shadow-md transition hover:bg-neutral-900 group-hover:opacity-100 sm:h-7 sm:w-7 sm:text-sm"
          >
            ⚙
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2.5 overflow-hidden">
      <div className="flex shrink-0 justify-center">
        <div className="inline-flex items-center rounded-lg border border-white/10 bg-zinc-900/80 p-1 shadow-[0_8px_20px_rgba(0,0,0,0.35)]">
        {(["ct", "t"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTeam(t)}
            className={`rounded-md px-4 py-1.5 text-[11px] font-black uppercase tracking-wide transition ${
              activeTeam === t
                ? t === "ct"
                  ? "bg-zinc-100 text-zinc-900 ring-1 ring-amber-500/60"
                  : "bg-amber-500 text-zinc-950 ring-1 ring-amber-400/70"
                : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
            }`}
          >
            {t === "ct" ? "CT" : "TR"}
          </button>
        ))}
        </div>
      </div>

      {/* Bento: 12 colunas × 8 linhas iguais — sem scroll, previsível */}
      <div
        className="grid min-h-0 flex-1 gap-2 overflow-hidden [grid-template-columns:repeat(12,minmax(0,1fr))] [grid-template-rows:repeat(8,minmax(0,1fr))] sm:gap-2.5"
        aria-label="Loadout em grelha bento"
      >
        {/* Tier 1 — showcase (linhas 1–2) */}
        {renderItem(0, "Agente", "", team, "agent", {
          variant: "showcase",
          gridClass: "col-start-1 col-end-5 row-start-1 row-span-2 min-h-0",
        })}
        <div className="col-start-5 col-end-7 row-start-1 row-span-2 flex min-h-0 flex-col gap-1.5">
          {renderItem(0, "Kit música", "", team, "music", {
            variant: "accessory",
            gridClass: "min-h-0 flex-1",
          })}
          {renderItem(0, "Pin ativo", "", team, "pin", {
            variant: "accessoryPin",
            gridClass: "h-[4.25rem] shrink-0 sm:h-[4.5rem]",
          })}
        </div>
        {renderItem(0, "Luva", "", team, "glove", {
          variant: "showcase",
          gridClass: "col-start-7 col-end-10 row-start-1 row-span-2 min-h-0",
        })}
        {renderItem(0, "Faca", "", team, "knife", {
          variant: "showcase",
          gridClass: "col-start-10 col-end-13 row-start-1 row-span-2 min-h-0",
        })}

        {/* Tier 2 — meta (linha 3): cada arma span 2 colunas */}
        <div className="col-span-12 row-start-3 row-end-4 grid min-h-0 grid-cols-12 gap-2 sm:gap-2.5">
          {tier2List.map((w) => (
            <div key={`meta-${w.id}`} className="col-span-2 min-h-0 self-start">
              {renderItem(w.def, w.label, w.id, team, "weapon", { variant: "meta" })}
            </div>
          ))}
        </div>

        {/* Tier 3 — agrupamento semântico compacto */}
        <div
          className="col-span-12 row-start-4 row-end-9 grid min-h-0 grid-cols-12 gap-2 sm:gap-2.5"
          aria-label="Armas secundárias e utilitárias"
        >
          <div className="col-span-4 flex min-h-0 flex-col gap-1.5">
            <p className="shrink-0 border-b border-white/10 pb-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-300">
              Pistolas
            </p>
            <div className="grid min-h-0 flex-1 grid-cols-2 content-start gap-2">
              {tier3Groups.pistols.map((w) => (
                <div key={w.id} className="min-h-0">
                  {renderItem(w.def, w.label, w.id, team, "weapon", { variant: "standard" })}
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-4 flex min-h-0 flex-col gap-1.5">
            <p className="shrink-0 border-b border-white/10 pb-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-300">
              Intermediárias
            </p>
            <div className="grid min-h-0 flex-1 grid-cols-3 content-start gap-2">
              {tier3Groups.mid.map((w) => (
                <div key={w.id} className="min-h-0">
                  {renderItem(w.def, w.label, w.id, team, "weapon", { variant: "standard" })}
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-4 flex min-h-0 flex-col gap-1.5">
            <p className="shrink-0 border-b border-white/10 pb-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-300">
              Rifles
            </p>
            <div className="grid min-h-0 flex-1 grid-cols-2 content-start gap-2">
              {tier3Groups.rifles.map((w) => (
                <div key={w.id} className="min-h-0">
                  {renderItem(w.def, w.label, w.id, team, "weapon", { variant: "standard" })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

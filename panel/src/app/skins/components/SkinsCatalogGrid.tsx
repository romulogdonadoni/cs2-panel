"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RemoteInventoryImage } from "@/components/remote-inventory-image";
import type { Skin, Saved } from "../types";

export function SkinsCatalogGrid({
  cat,
  total,
  visibleSkins,
  groups,
  groupNames,
  configuredInCatalog,
  loading,
  getDefindex,
  rarityColor,
  keyOf,
  activeByDef,
  busyKey,
  saved,
  team,
  onSelectSkin,
  onSticker,
  onRemove,
}: {
  cat: string;
  total: number;
  visibleSkins: Skin[];
  groups: Record<string, Skin[]>;
  groupNames: string[];
  configuredInCatalog: number;
  loading: boolean;
  getDefindex: (s: Skin) => number;
  rarityColor: (s: Skin) => string;
  keyOf: (def: number, paint: number) => string;
  activeByDef: Record<number, Record<number, number>>;
  busyKey: string | null;
  saved: Record<string, Saved>;
  team: "all" | "ct" | "t";
  onSelectSkin: (skin: Skin) => void;
  onSticker: (defindex: number, name: string) => void;
  onRemove: (def: number, paint: number) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  if (cat === "agents" || cat === "music" || cat === "pins" || cat === "loadout") return null;

  if (groupNames.length === 0 && !loading) return null;

  return (
    <div className="space-y-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3.5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Catálogo (filtro atual)
          </p>
          <p className="mt-0.5 text-slate-200">
            {total > 0 ? (
              <>
                <span className="text-2xl font-black tabular-nums text-white">{visibleSkins.length}</span>
                <span className="mx-1 text-slate-500">/</span>
                <span className="text-lg font-semibold tabular-nums text-slate-400">{total}</span>
                <span className="ml-2 text-sm text-slate-500">skins</span>
              </>
            ) : loading ? (
              <span className="text-slate-400">A carregar…</span>
            ) : (
              <span className="text-slate-500">Nada nesta categoria</span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Neste filtro
          </p>
          <p>
            <span className="text-2xl font-black tabular-nums text-amber-400">{configuredInCatalog}</span>
            <span className="ml-2 text-sm text-slate-400">configuradas</span>
          </p>
        </div>
      </div>

      {groupNames.map((gname, idx) => {
        const gskins = groups[gname]!;
        const isOpen = collapsed[gname] !== undefined ? collapsed[gname] : idx === 0;
        return (
          <div key={gname}>
            <button
              type="button"
              className="group mb-3 flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left transition hover:bg-white/[0.03]"
              onClick={() => setCollapsed((p) => ({ ...p, [gname]: !isOpen }))}
            >
              <span className="text-base font-black text-white">{gname}</span>
              <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-slate-300">
                {gskins.length}
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
              <span
                className={`text-slate-400 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`}
                aria-hidden
              >
                ▾
              </span>
            </button>

            {isOpen && (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                <AnimatePresence mode="popLayout">
                  {gskins.map((skin, i) => {
                    const def = getDefindex(skin);
                    const paint = parseInt(String(skin.paint_index ?? "0"), 10);
                    const k = keyOf(def, paint);
                    const activeTeams = activeByDef[def] ?? {};
                    const isSaved = Object.values(activeTeams).includes(paint);
                    const teamsApplied = Object.entries(activeTeams)
                      .filter(([, p]) => p === paint)
                      .map(([t]) => parseInt(t, 10));
                    const isBusy = busyKey === k;
                    const rc = rarityColor(skin);
                    const sav = saved[k];
                    const matchesTeam =
                      team === "all" ||
                      !sav ||
                      (team === "ct" && (sav.weapon_team === 3 || sav.weapon_team === 0)) ||
                      (team === "t" && (sav.weapon_team === 2 || sav.weapon_team === 0));
                    const showSaved = isSaved && matchesTeam;
                    return (
                      <motion.div
                        key={k}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.12, delay: Math.min(i * 0.01, 0.2) }}
                      >
                        <div
                          className="group relative cursor-pointer overflow-hidden rounded-xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 hover:ring-1 hover:ring-amber-500/20"
                          style={{
                            background: "rgba(15,23,42,0.9)",
                            borderColor: showSaved ? `${rc}55` : "rgba(255,255,255,0.08)",
                            boxShadow: showSaved ? `0 0 20px ${rc}18` : undefined,
                          }}
                          onClick={() => onSelectSkin(skin)}
                        >
                          <div
                            className="absolute inset-x-0 top-0 h-[2px]"
                            style={{ background: `linear-gradient(90deg,${rc}00,${rc},${rc}00)` }}
                          />
                          {showSaved && (
                            <div className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-slate-900/50 bg-amber-400 shadow-lg">
                              <span className="text-[10px] font-black text-slate-900">✓</span>
                            </div>
                          )}
                          <div className="absolute left-1.5 top-1.5 z-10 flex flex-col gap-1">
                            {teamsApplied.includes(0) && (
                              <span className="rounded border border-white/10 bg-white/20 px-1 text-[10px] font-black text-white backdrop-blur-sm">
                                ANY
                              </span>
                            )}
                            {teamsApplied.includes(2) && (
                              <span className="rounded border border-amber-500/20 bg-amber-500/30 px-1 text-[10px] font-black text-amber-300 backdrop-blur-sm">
                                T
                              </span>
                            )}
                            {teamsApplied.includes(3) && (
                              <span className="rounded border border-blue-500/20 bg-blue-500/30 px-1 text-[10px] font-black text-blue-300 backdrop-blur-sm">
                                CT
                              </span>
                            )}
                          </div>
                          <div
                            className="flex aspect-[4/3] items-center justify-center p-2"
                            style={{ background: "linear-gradient(180deg,rgba(30,41,59,0.5),transparent)" }}
                          >
                            <RemoteInventoryImage
                              src={skin.image}
                              alt={skin.name}
                              className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                              fallbackChar="🗡"
                            />
                          </div>
                          <div className="px-2.5 pb-2.5 pt-1">
                            <p className="line-clamp-2 min-h-[2.25em] text-xs font-bold leading-snug text-white">
                              {skin.name.replace(/^.*\|\s*/, "")}
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1">
                              <span
                                className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase sm:text-xs"
                                style={{ color: rc, background: `${rc}20` }}
                              >
                                {skin.rarity?.name?.split(" ").pop()}
                              </span>
                              {skin.stattrak && (
                                <span className="rounded bg-orange-400/15 px-1.5 py-0.5 text-[10px] font-bold text-orange-400 sm:text-xs">
                                  ST
                                </span>
                              )}
                            </div>
                          </div>
                          {showSaved && !isBusy && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSticker(def, `${skin.weapon.name} | ${skin.name.replace(/^.*\|\s*/, "")}`);
                                }}
                                className="absolute bottom-1 left-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-violet-500 text-[8px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                                title="Stickers & Pingente"
                              >
                                🎨
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRemove(def, paint);
                                }}
                                className="absolute bottom-1 right-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                              >
                                ✕
                              </button>
                            </>
                          )}
                          {isBusy && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

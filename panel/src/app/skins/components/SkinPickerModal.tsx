"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { RemoteInventoryImage } from "@/components/remote-inventory-image";
import {
  type Agent,
  type Music,
  type Pin,
  type PickingSlot,
  type Skin,
  KNIVES,
  GLOVES,
  catalogSkinDefindex,
  RARITY,
} from "../types";

function skinGroupKey(s: Skin): string {
  const wid = Number(s.weapon?.weapon_id);
  if (Number.isFinite(wid) && wid > 0) return String(wid);
  return s.weapon?.id ?? s.weapon?.name ?? "?";
}

function rarityColor(s: Skin) {
  return RARITY[s.rarity?.name ?? ""] ?? s.rarity?.color ?? "#b0c3d9";
}

export function SkinPickerModal({
  slot,
  skins,
  agents,
  musics,
  pins,
  onClose,
  onPickSkin,
  onPickAgent,
  onPickMusic,
  onPickPin,
  savingAgent,
  savingMusic,
  savingPin,
}: {
  slot: PickingSlot | null;
  skins: Skin[];
  agents: Agent[];
  musics: Music[];
  pins: Pin[];
  onClose: () => void;
  onPickSkin: (skin: Skin) => void;
  onPickAgent: (agent: Agent) => void;
  onPickMusic: (m: Music) => void;
  onPickPin: (p: Pin) => void;
  savingAgent?: string | null;
  savingMusic?: number | null;
  savingPin?: number | null;
}) {
  const [query, setQuery] = useState("");
  const [openAcc, setOpenAcc] = useState<Record<string, boolean>>({});

  const q = query.trim().toLowerCase();

  const title = useMemo(() => {
    if (!slot) return "";
    if (slot.type === "agent") return `Agente — ${slot.team.toUpperCase()}`;
    if (slot.type === "music") return `Kit de música — ${slot.team.toUpperCase()}`;
    if (slot.type === "pin") return `Pin — ${slot.team.toUpperCase()}`;
    return `${slot.label} — ${slot.team.toUpperCase()}`;
  }, [slot]);

  const filteredSkins = useMemo(() => {
    if (!slot || slot.type === "agent" || slot.type === "music" || slot.type === "pin") return [];
    let list = skins;
    if (slot.type === "weapon") {
      list = list.filter((s) => catalogSkinDefindex(s) === slot.defindex);
    } else if (slot.type === "knife") {
      list = list.filter((s) => KNIVES.has(catalogSkinDefindex(s)));
    } else if (slot.type === "glove") {
      list = list.filter((s) => GLOVES.has(catalogSkinDefindex(s)));
    }
    if (!q) return list;
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) || (s.weapon?.name ?? "").toLowerCase().includes(q)
    );
  }, [skins, slot, q]);

  const skinGroups = useMemo(() => {
    const acc: Record<string, Skin[]> = {};
    for (const s of filteredSkins) {
      const key =
        slot?.type === "knife" || slot?.type === "glove" ? skinGroupKey(s) : (slot?.label ?? "Skins");
      if (!acc[key]) acc[key] = [];
      acc[key]!.push(s);
    }
    return acc;
  }, [filteredSkins, slot]);

  const groupNames = useMemo(() => Object.keys(skinGroups).sort(), [skinGroups]);

  const agentsForSlot = useMemo(() => {
    if (!slot || slot.type !== "agent") return [];
    const wantCt = slot.team === "ct";
    return agents.filter((a) =>
      wantCt ? a.team?.id?.includes("counter") : !a.team?.id?.includes("counter")
    );
  }, [slot, agents]);

  const filterAgents = (list: Agent[]) => {
    if (!q) return list;
    return list.filter((a) => a.name.toLowerCase().includes(q));
  };

  const filterMusics = () => {
    if (!q) return musics;
    return musics.filter((m) => m.name.toLowerCase().includes(q));
  };

  const filterPins = () => {
    if (!q) return pins;
    return pins.filter((p) => p.name.toLowerCase().includes(q));
  };

  if (!slot) return null;

  const isOpen = (id: string, idx: number) =>
    openAcc[id] !== undefined ? Boolean(openAcc[id]) : idx === 0;

  const toggleAcc = (id: string, idx: number) => {
    setOpenAcc((p) => {
      const cur = p[id] !== undefined ? Boolean(p[id]) : idx === 0;
      return { ...p, [id]: !cur };
    });
  };

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-zinc-400 hover:text-white"
          >
            Fechar
          </button>
        </div>
        <div className="shrink-0 border-b border-white/5 px-5 py-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar…"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-500/40"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:pb-6">
          {(slot.type === "weapon" || slot.type === "knife" || slot.type === "glove") && (
            <div className="space-y-3">
              {groupNames.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-500">Nada encontrado.</p>
              )}
              {groupNames.map((gname, idx) => {
                const gskins = skinGroups[gname]!;
                const open = slot.type === "weapon" ? true : isOpen(gname, idx);
                const isAccordion = slot.type === "knife" || slot.type === "glove";
                return (
                  <div key={gname}>
                    {isAccordion && (
                      <button
                        type="button"
                        onClick={() => toggleAcc(gname, idx)}
                        className="mb-2 flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-white/[0.04]"
                      >
                        <span className="min-w-0 truncate text-sm font-bold text-white">
                          {gskins[0]?.weapon.name ?? gname}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-bold text-slate-300">
                            {gskins.length}
                          </span>
                          <span className={`text-slate-400 transition ${open ? "" : "-rotate-90"}`}>▾</span>
                        </span>
                      </button>
                    )}
                    {open && (
                      <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-4">
                        {gskins.map((skin) => {
                          const rc = rarityColor(skin);
                          return (
                            <button
                              key={skin.id}
                              type="button"
                              onClick={() => onPickSkin(skin)}
                              className="group overflow-hidden rounded-xl border border-white/10 bg-zinc-900/85 p-2.5 pb-3 text-left transition hover:border-amber-500/35"
                              style={{ borderTopColor: rc, borderTopWidth: 3 }}
                            >
                              <div className="flex aspect-square min-h-[112px] w-full items-center justify-center p-2">
                                <RemoteInventoryImage
                                  src={skin.image}
                                  alt={skin.name}
                                  className="h-full w-full max-h-[120px] object-contain transition group-hover:scale-[1.02]"
                                  fallbackChar="🎯"
                                />
                              </div>
                              <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-left text-xs font-bold leading-snug text-white">
                                {skin.name.replace(/^.*\|\s*/, "")}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {slot.type === "agent" && (
            <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-4">
              {filterAgents(agentsForSlot).map((agent) => {
                const busy = savingAgent === agent.id;
                const rc = RARITY[agent.rarity?.name ?? ""] ?? agent.rarity?.color ?? "#8847ff";
                return (
                  <button
                    key={agent.id}
                    type="button"
                    disabled={busy}
                    onClick={() => !busy && onPickAgent(agent)}
                    className="relative overflow-hidden rounded-xl border border-white/10 bg-zinc-900/85 p-2.5 pb-3 text-left transition hover:border-amber-500/35 disabled:opacity-50"
                    style={{ borderTopColor: rc, borderTopWidth: 3 }}
                  >
                    <div className="aspect-square">
                      <RemoteInventoryImage
                        src={agent.image}
                        alt={agent.name}
                        className="h-full w-full object-contain"
                        fallbackChar="👤"
                      />
                    </div>
                    <p
                      className="mt-2 line-clamp-2 text-xs font-bold leading-snug text-white"
                      title={agent.name.split("|")[0]?.trim()}
                    >
                      {agent.name.split("|")[0]?.trim()}
                    </p>
                    {busy && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {slot.type === "music" && (
            <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-4">
              {filterMusics().map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onPickMusic(m)}
                  className="relative rounded-xl border border-white/10 bg-zinc-900/85 p-3 pb-3"
                >
                  <RemoteInventoryImage
                    src={m.image}
                    alt={m.name}
                    className="mx-auto h-20 w-20 object-cover"
                    fallbackChar="🎵"
                  />
                  <p className="mt-2 line-clamp-2 text-xs font-bold leading-snug text-white">{m.name}</p>
                  {savingMusic === m.id && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {slot.type === "pin" && (
            <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-4">
              {filterPins().map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onPickPin(p)}
                  className="relative rounded-xl border border-white/10 bg-zinc-900/85 p-3 pb-3"
                >
                  <RemoteInventoryImage
                    src={p.image}
                    alt={p.name}
                    className="mx-auto h-16 w-16 object-contain"
                    fallbackChar="○"
                  />
                  <p className="mt-2 line-clamp-2 text-center text-xs font-bold leading-snug text-white">
                    {p.name}
                  </p>
                  {savingPin === p.id && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { clamp } from "@/lib/loadout-types";
import { GLOVES, catalogSkinDefindex } from "@/app/skins/types";
import {
  StickerKeychainSection,
  type StickerKeychainSectionHandle,
  type StickerSlotConfig,
} from "@/components/sticker-keychain-modal";

export type SkinCatalogRow = {
  id: string;
  name: string;
  image: string;
  paint_index?: string;
  min_float: number;
  max_float: number;
  stattrak: boolean;
  weapon: { id: string; name: string; weapon_id?: number };
  rarity?: { name: string; color: string };
};

export type SkinConfigSavePayload = {
  float: number;
  stattrak: boolean;
  /** Só enviado quando a skin suporta stickers/pingente (não-luvas) */
  stickerExtras?: StickerSlotConfig;
};

type Props = {
  item: SkinCatalogRow | null;
  initial?: { skinId?: string; float?: number; stattrak?: boolean };
  /** Time WeaponPaints para stickers: 0, 2=T, 3=CT */
  weaponTeam?: 0 | 2 | 3;
  onClose: () => void;
  onSave: (next: SkinConfigSavePayload) => void | Promise<void>;
};

// Float → CS2 quality label
function floatLabel(f: number) {
  if (f <= 0.07) return { label: "Factory New", short: "FN", color: "#4ade80" };
  if (f <= 0.15) return { label: "Minimal Wear", short: "MW", color: "#86efac" };
  if (f <= 0.38) return { label: "Field-Tested", short: "FT", color: "#facc15" };
  if (f <= 0.45) return { label: "Well-Worn", short: "WW", color: "#f97316" };
  return { label: "Battle-Scarred", short: "BS", color: "#ef4444" };
}

export function SkinConfigModal({ item, initial, weaponTeam = 0, onClose, onSave }: Props) {
  const minF = item?.min_float ?? 0;
  const maxF = item?.max_float ?? 1;
  const hasFloatRange = maxF > minF;

  const [wear, setWear] = useState(0.15);
  const [stattrak, setStatTrak] = useState(false);
  const [tab, setTab] = useState<"quality" | "extras">("quality");
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const stickerRef = useRef<StickerKeychainSectionHandle>(null);

  const weaponDefindex = item ? catalogSkinDefindex(item) : 0;
  const showStickerExtras = Boolean(item && weaponDefindex > 0 && !GLOVES.has(weaponDefindex));

  useEffect(() => {
    if (!item) return;
    const base = initial?.float;
    setWear(
      clamp(base !== undefined && Number.isFinite(base) ? base : clamp(0.15, minF, maxF), minF, maxF)
    );
    setStatTrak(initial?.stattrak ?? false);
    setTab("quality");
  }, [item, initial, minF, maxF]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!item) return null;

  const pct = hasFloatRange ? ((wear - minF) / (maxF - minF)) * 100 : 0;
  const qual = floatLabel(wear);

  const updateFromPct = (clientX: number) => {
    const track = trackRef.current;
    if (!track || !hasFloatRange) return;
    const { left, width } = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - left) / width));
    setWear(clamp(minF + ratio * (maxF - minF), minF, maxF));
  };

  const apply = async () => {
    const payload: SkinConfigSavePayload = {
      float: hasFloatRange ? clamp(wear, minF, maxF) : minF,
      stattrak: item.stattrak ? stattrak : false,
    };
    if (showStickerExtras) {
      payload.stickerExtras = stickerRef.current?.getConfig();
    }
    try {
      await Promise.resolve(onSave(payload));
      onClose();
    } catch {
      /* parent mostra toast; mantém o modal aberto */
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.86)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className={`relative w-full overflow-hidden rounded-2xl ${showStickerExtras ? "max-w-lg" : "max-w-md"}`}
        style={{
          background: "linear-gradient(155deg, #0a0a0a 0%, #171717 45%, #121212 100%)",
          border: "1px solid rgba(255,255,255,0.09)",
          boxShadow: "0 0 60px rgba(0,0,0,0.85)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          className="flex items-center justify-between px-5 py-4"
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-amber-400">{item.weapon.name}</p>
            <h2 className="text-lg font-black tracking-tight text-white">{item.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-zinc-500 transition-all hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        {showStickerExtras && (
          <div className="flex gap-1 border-b border-white/[0.06] px-3 pt-2">
            <button
              type="button"
              onClick={() => setTab("quality")}
              className={`inline-flex min-h-10 items-center justify-center rounded-t-lg px-4 py-2.5 text-xs font-bold uppercase tracking-wide transition ${
                tab === "quality"
                  ? "bg-white/10 text-amber-200"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Qualidade & StatTrak™
            </button>
            <button
              type="button"
              onClick={() => setTab("extras")}
              className={`inline-flex min-h-10 items-center justify-center rounded-t-lg px-4 py-2.5 text-xs font-bold uppercase tracking-wide transition ${
                tab === "extras"
                  ? "bg-white/10 text-amber-200"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Stickers & pingente
            </button>
          </div>
        )}

        <div className="max-h-[min(70vh,560px)] overflow-y-auto">
          {tab === "quality" && (
            <>
              <div
                className="relative flex items-center justify-center px-4 py-6"
                style={{
                  background: "linear-gradient(180deg, rgba(39,39,42,0.55) 0%, rgba(9,9,11,0.92) 100%)",
                }}
              >
                {item.image && (
                  <Image
                    src={item.image}
                    alt={item.name}
                    width={320}
                    height={200}
                    className="object-contain drop-shadow-2xl"
                    style={{ maxHeight: 180 }}
                    unoptimized
                  />
                )}
                <div
                  className="absolute left-3 top-3 rounded px-2 py-1 text-[10px] font-black uppercase tracking-wider"
                  style={{
                    background: `${qual.color}22`,
                    color: qual.color,
                    border: `1px solid ${qual.color}44`,
                  }}
                >
                  {qual.short} — {qual.label}
                </div>
                {stattrak && (
                  <div
                    className="absolute right-3 top-3 rounded px-2 py-1 text-[10px] font-black uppercase"
                    style={{
                      background: "#f9731622",
                      color: "#f97316",
                      border: "1px solid #f9731644",
                    }}
                  >
                    StatTrak™
                  </div>
                )}
              </div>

              <div className="space-y-5 px-5 py-5">
                {hasFloatRange && (
                  <div className="space-y-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <label className="text-xs font-bold uppercase tracking-wide text-zinc-300">
                        Desgaste (Float)
                      </label>
                      <span className="text-sm font-black tabular-nums" style={{ color: qual.color }}>
                        {wear.toFixed(4)}
                      </span>
                    </div>

                    <div className="flex justify-between text-xs font-bold uppercase tracking-wide text-zinc-500">
                      {["FN", "MW", "FT", "WW", "BS"].map((l, i) => {
                        const thresholds = [0.07, 0.15, 0.38, 0.45, 1.0];
                        const pct2 = ((thresholds[i]! - minF) / (maxF - minF)) * 100;
                        if (pct2 < 0 || pct2 > 100) return null;
                        return <span key={l}>{l}</span>;
                      })}
                    </div>

                    <div
                      ref={trackRef}
                      className="relative h-3 cursor-pointer select-none rounded-full"
                      style={{
                        background:
                          "linear-gradient(90deg, #4ade80, #86efac 15%, #facc15 38%, #f97316 45%, #ef4444)",
                      }}
                      onMouseDown={(e) => {
                        dragging.current = true;
                        updateFromPct(e.clientX);
                        const up = () => {
                          dragging.current = false;
                          window.removeEventListener("mouseup", up);
                          window.removeEventListener("mousemove", mv);
                        };
                        const mv = (e2: MouseEvent) => {
                          if (dragging.current) updateFromPct(e2.clientX);
                        };
                        window.addEventListener("mouseup", up);
                        window.addEventListener("mousemove", mv);
                      }}
                      onTouchStart={(e) => {
                        const touch = e.touches[0];
                        if (touch) updateFromPct(touch.clientX);
                      }}
                      onTouchMove={(e) => {
                        const touch = e.touches[0];
                        if (touch) updateFromPct(touch.clientX);
                      }}
                    >
                      <div
                        className="absolute inset-0 rounded-full"
                        style={{
                          background: `linear-gradient(90deg, transparent ${(((minF - minF) / (maxF - minF)) * 100).toFixed(1)}%, transparent ${pct.toFixed(1)}%, rgba(0,0,0,0.6) ${pct.toFixed(1)}%)`,
                        }}
                      />
                      <div
                        className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-lg transition-none"
                        style={{
                          left: `calc(${pct}% - 10px)`,
                          border: `3px solid ${qual.color}`,
                          boxShadow: `0 0 8px ${qual.color}88`,
                        }}
                      />
                    </div>

                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>{minF.toFixed(3)}</span>
                      <span>{maxF.toFixed(3)}</span>
                    </div>
                  </div>
                )}

                {!hasFloatRange && (
                  <p className="text-center text-xs text-zinc-500">Float fixo para esta skin.</p>
                )}

                {item.stattrak && (
                  <div
                    className="flex items-center justify-between rounded-xl p-4"
                    style={{
                      background: "rgba(249,115,22,0.08)",
                      border: "1px solid rgba(249,115,22,0.2)",
                    }}
                  >
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-orange-300">StatTrak™</p>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-400">Contador de vítimas integrado</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStatTrak(!stattrak)}
                      className="relative h-6 w-12 rounded-full transition-all duration-300"
                      style={{ background: stattrak ? "#f97316" : "rgba(255,255,255,0.1)" }}
                    >
                      <div
                        className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-300"
                        style={{ left: stattrak ? "calc(100% - 22px)" : "2px" }}
                      />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {showStickerExtras && (
            <div className={tab === "extras" ? "block" : "hidden"} aria-hidden={tab !== "extras"}>
              <StickerKeychainSection
                ref={stickerRef}
                weaponDefindex={weaponDefindex}
                weaponTeam={weaponTeam}
                compact
              />
            </div>
          )}
        </div>

        <div
          className="flex gap-3 px-5 pb-5 pt-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="btn-panel flex-1 rounded-xl text-sm font-bold text-zinc-400 transition-all hover:text-white"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            CANCELAR
          </button>
          <button
            type="button"
            onClick={() => void apply()}
            className="btn-panel flex-1 rounded-xl text-sm font-black text-white transition-all hover:opacity-90"
            style={{
              background: "linear-gradient(135deg, #f59e0b, #d97706)",
              boxShadow: "0 4px 15px rgba(245,158,11,0.3)",
            }}
          >
            <span aria-hidden>✓</span>
            <span>APLICAR</span>
          </button>
        </div>
      </div>
    </div>
  );
}

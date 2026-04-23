"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { clamp } from "@/lib/loadout-types";

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

type Props = {
  item: SkinCatalogRow | null;
  initial?: { skinId?: string; float?: number; stattrak?: boolean };
  onClose: () => void;
  onSave: (next: { float: number; stattrak: boolean }) => void;
};

// Float → CS2 quality label
function floatLabel(f: number) {
  if (f <= 0.07)  return { label: "Factory New",    short: "FN", color: "#4ade80" };
  if (f <= 0.15)  return { label: "Minimal Wear",   short: "MW", color: "#86efac" };
  if (f <= 0.38)  return { label: "Field-Tested",   short: "FT", color: "#facc15" };
  if (f <= 0.45)  return { label: "Well-Worn",      short: "WW", color: "#f97316" };
  return           { label: "Battle-Scarred",        short: "BS", color: "#ef4444" };
}

export function SkinConfigModal({ item, initial, onClose, onSave }: Props) {
  const minF = item?.min_float ?? 0;
  const maxF = item?.max_float ?? 1;

  const [wear, setWear]       = useState(0.15);
  const [stattrak, setStatTrak] = useState(false);
  const trackRef              = useRef<HTMLDivElement>(null);
  const dragging              = useRef(false);

  useEffect(() => {
    if (!item) return;
    const base = initial?.float;
    setWear(clamp(
      base !== undefined && Number.isFinite(base) ? base : clamp(0.15, minF, maxF),
      minF, maxF
    ));
    setStatTrak(initial?.stattrak ?? false);
  }, [item, initial, minF, maxF]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!item) return null;

  const pct  = ((wear - minF) / (maxF - minF)) * 100;
  const qual = floatLabel(wear);

  const updateFromPct = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const { left, width } = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - left) / width));
    setWear(clamp(minF + ratio * (maxF - minF), minF, maxF));
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(2,6,23,0.85)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: "linear-gradient(145deg, #0f172a, #1e293b)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 0 60px rgba(0,0,0,0.8)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-[10px] font-bold text-amber-400 uppercase tracking-[0.15em]">{item.weapon.name}</p>
            <h2 className="text-lg font-black text-white tracking-tight">{item.name}</h2>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all text-lg">
            ✕
          </button>
        </div>

        {/* Skin image */}
        <div className="relative flex items-center justify-center py-6 px-4"
          style={{ background: "linear-gradient(180deg, rgba(30,41,59,0.6) 0%, rgba(15,23,42,0.8) 100%)" }}>
          {item.image && (
            <Image src={item.image} alt={item.name} width={320} height={200}
              className="object-contain drop-shadow-2xl" style={{ maxHeight: 180 }} unoptimized />
          )}
          {/* Quality badge */}
          <div className="absolute top-3 left-3 px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider"
            style={{ background: `${qual.color}22`, color: qual.color, border: `1px solid ${qual.color}44` }}>
            {qual.short} — {qual.label}
          </div>
          {stattrak && (
            <div className="absolute top-3 right-3 px-2 py-1 rounded text-[10px] font-black uppercase"
              style={{ background: "#f9731622", color: "#f97316", border: "1px solid #f9731644" }}>
              StatTrak™
            </div>
          )}
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-5">
          {/* Float slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                Desgaste (Float)
              </label>
              <span className="text-sm font-black tabular-nums" style={{ color: qual.color }}>
                {wear.toFixed(4)}
              </span>
            </div>

            {/* Float range labels */}
            <div className="flex justify-between text-[8px] font-bold text-slate-500 uppercase tracking-wide">
              {["FN","MW","FT","WW","BS"].map((l, i) => {
                const thresholds = [0.07, 0.15, 0.38, 0.45, 1.0];
                const pct2 = ((thresholds[i]! - minF) / (maxF - minF)) * 100;
                if (pct2 < 0 || pct2 > 100) return null;
                return <span key={l}>{l}</span>;
              })}
            </div>

            {/* Custom slider track */}
            <div
              ref={trackRef}
              className="relative h-3 rounded-full cursor-pointer select-none"
              style={{ background: "linear-gradient(90deg, #4ade80, #86efac 15%, #facc15 38%, #f97316 45%, #ef4444)" }}
              onMouseDown={(e) => {
                dragging.current = true;
                updateFromPct(e.clientX);
                const up = () => { dragging.current = false; window.removeEventListener("mouseup", up); window.removeEventListener("mousemove", mv); };
                const mv = (e2: MouseEvent) => { if (dragging.current) updateFromPct(e2.clientX); };
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
              {/* Dark overlay to show available range */}
              <div className="absolute inset-0 rounded-full"
                style={{ background: `linear-gradient(90deg, transparent ${(((minF - minF) / (maxF - minF)) * 100).toFixed(1)}%, transparent ${pct.toFixed(1)}%, rgba(0,0,0,0.6) ${pct.toFixed(1)}%)` }} />
              {/* Thumb */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white shadow-lg transition-none pointer-events-none"
                style={{ left: `calc(${pct}% - 10px)`, border: `3px solid ${qual.color}`, boxShadow: `0 0 8px ${qual.color}88` }}
              />
            </div>

            <div className="flex justify-between text-[9px] text-slate-500">
              <span>{minF.toFixed(3)}</span>
              <span>{maxF.toFixed(3)}</span>
            </div>
          </div>

          {/* StatTrak */}
          {item.stattrak && (
            <div className="flex items-center justify-between p-4 rounded-xl"
              style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)" }}>
              <div>
                <p className="text-xs font-bold text-orange-300 uppercase tracking-wide">StatTrak™</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Contador de vítimas integrado</p>
              </div>
              <button
                onClick={() => setStatTrak(!stattrak)}
                className="relative w-12 h-6 rounded-full transition-all duration-300"
                style={{ background: stattrak ? "#f97316" : "rgba(255,255,255,0.1)" }}
              >
                <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300"
                  style={{ left: stattrak ? "calc(100% - 22px)" : "2px" }} />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-slate-400 hover:text-white transition-all"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            CANCELAR
          </button>
          <button
            onClick={() => { onSave({ float: clamp(wear, minF, maxF), stattrak: item.stattrak ? stattrak : false }); onClose(); }}
            className="flex-1 py-3 rounded-xl text-sm font-black text-white transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", boxShadow: "0 4px 15px rgba(245,158,11,0.3)" }}
          >
            ✓ APLICAR
          </button>
        </div>
      </div>
    </div>
  );
}

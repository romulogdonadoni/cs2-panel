"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";

// ─── Types ────────────────────────────────────────────────────────────────────

type CatalogItem = {
  id: string;
  name: string;
  image: string;
  def_index: string;
  rarity?: { name: string; color: string };
};

export type StickerSlotConfig = {
  stickers: (number | null)[]; // 5 slots
  stickerWear: number[];       // 5 slots (0.0 a 1.0)
  keychain: number | null;
  keychainSeed: number; // posição/seed do pingente
};

type Props = {
  weaponName: string;
  weaponDefindex: number;
  weaponTeam?: 0 | 1 | 2;
  onClose: () => void;
  onSave: (cfg: StickerSlotConfig) => Promise<void>;
};

const RARITY_COLOR: Record<string, string> = {
  "Consumer Grade": "#b0c3d9", "Base Grade": "#b0c3d9",
  "Industrial Grade": "#5e98d9", "High Grade": "#4b69ff",
  "Remarkable": "#8847ff", "Exotic": "#d32ee6",
  "Mil-Spec Grade": "#4b69ff", "Restricted": "#8847ff",
  "Classified": "#d32ee6", "Covert": "#eb4b4b",
  "Contraband": "#e4ae39", "Extraordinary": "#e4ae39",
};

// ─── Picker modal (inner) ─────────────────────────────────────────────────────

function ItemPicker({
  type, onPick, onClose,
}: { type: "sticker" | "keychain"; onPick: (item: CatalogItem) => void; onClose: () => void }) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const LIMIT = 48;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q: string, off: number) => {
    setLoading(true);
    try {
      const endpoint = type === "sticker" ? "/api/catalog/stickers" : "/api/catalog/keychains";
      const p = new URLSearchParams({ q, offset: String(off), limit: String(LIMIT) });
      const d = await fetch(`${endpoint}?${p}`).then(r => r.json());
      off === 0 ? setItems(d.items ?? []) : setItems(prev => [...prev, ...(d.items ?? [])]);
      setTotal(d.total ?? 0);
    } finally { setLoading(false); }
  }, [type]);

  useEffect(() => { load("", 0); }, [load]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { setOffset(0); load(query, 0); }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query, load]);

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)" }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <span className="text-base">{type === "sticker" ? "🎨" : "🔮"}</span>
          <p className="text-sm font-black text-white uppercase tracking-wider">
            Selecionar {type === "sticker" ? "Sticker" : "Pingente"}
          </p>
          <div className="flex-1 relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔍</span>
            <input autoFocus type="text" placeholder="Buscar…" value={query} onChange={e => setQuery(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 text-xs text-white rounded-lg outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 text-xs">✕</button>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {items.map(item => {
              const rc = RARITY_COLOR[item.rarity?.name ?? ""] ?? item.rarity?.color ?? "#b0c3d9";
              return (
                <button key={item.id}
                  onClick={() => { onPick(item); onClose(); }}
                  title={item.name}
                  className="group relative rounded-xl overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg text-left"
                  style={{ background: "rgba(30,41,59,0.8)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="absolute top-0 inset-x-0 h-[2px]" style={{ background: `linear-gradient(90deg,${rc}00,${rc},${rc}00)` }} />
                  <div className="aspect-square p-1.5 flex items-center justify-center">
                    <Image src={item.image} alt={item.name} width={64} height={64}
                      className="object-contain w-full h-full group-hover:scale-110 transition-transform" unoptimized />
                  </div>
                  <div className="px-1.5 pb-1.5">
                    <p className="text-[8px] text-white font-bold truncate leading-tight">{item.name.replace(/^.*\|\s*/, "")}</p>
                  </div>
                </button>
              );
            })}
            {loading && Array.from({ length: 12 }).map((_, i) =>
              <div key={i} className="rounded-xl animate-pulse aspect-square" style={{ background: "rgba(255,255,255,0.04)" }} />
            )}
          </div>
          {items.length < total && (
            <div className="flex justify-center mt-4">
              <button onClick={() => { const n = offset + LIMIT; setOffset(n); load(query, n); }} disabled={loading}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:text-white disabled:opacity-50"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                {loading ? "Carregando…" : `Mais (${total - items.length})`}
              </button>
            </div>
          )}
          {!loading && items.length === 0 && (
            <p className="text-center text-slate-500 text-xs mt-8">Nenhum resultado</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function StickerKeychainModal({ weaponName, weaponDefindex, weaponTeam = 0, onClose, onSave }: Props) {
  const [stickers, setStickers] = useState<(number | null)[]>([null, null, null, null, null]);
  const [stickerWear, setStickerWear] = useState<number[]>([0, 0, 0, 0, 0]);
  const [keychain, setKeychain] = useState<number | null>(null);
  const [keychainSeed, setKeychainSeed] = useState<number>(0);
  const [catalog, setCatalog] = useState<Record<number, CatalogItem>>({});
  const [picker, setPicker] = useState<{ type: "sticker" | "keychain"; slot: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Carrega estado atual da arma
  useEffect(() => {
    setLoading(true);
    fetch(`/api/skins/stickers?weapon_defindex=${weaponDefindex}&weapon_team=${weaponTeam}`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.stickers)) {
          const ids = d.stickers.map((s: any) => s?.id ?? null);
          const wears = d.stickers.map((s: any) => s?.wear ?? 0);
          setStickers(ids);
          setStickerWear(wears);
          
          // Popula catálogo com os itens já equipados
          d.stickers.forEach((s: any) => {
            if (s?.id && s.name && s.image) {
              setCatalog(prev => ({ ...prev, [s.id]: { id: String(s.id), name: s.name, image: s.image, def_index: String(s.id), rarity: s.rarity } }));
            }
          });
        }
        
        if (d.keychain) {
          const kc = d.keychain;
          setKeychain(kc.id);
          setKeychainSeed(kc.seed ?? 0);
          if (kc.id && kc.name && kc.image) {
            setCatalog(prev => ({ ...prev, [kc.id]: { id: String(kc.id), name: kc.name, image: kc.image, def_index: String(kc.id), rarity: kc.rarity } }));
          }
        } else {
          setKeychain(null);
          setKeychainSeed(0);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [weaponDefindex, weaponTeam]);

  // Quando um item é selecionado no picker, carrega metadados para exibir
  const handlePick = useCallback((item: CatalogItem, type: "sticker" | "keychain", slot: number) => {
    const id = parseInt(item.def_index, 10);
    setCatalog(prev => ({ ...prev, [id]: item }));
    if (type === "keychain") {
      setKeychain(id);
    } else {
      setStickers(prev => { const n = [...prev]; n[slot] = id; return n; });
    }
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try { await onSave({ stickers, stickerWear, keychain, keychainSeed }); onClose(); }
    catch { /* toast in parent */ }
    finally { setSaving(false); }
  };

  const hasAny = stickers.some(Boolean) || keychain;

  return (
    <>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)" }}
        onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="w-full max-w-lg rounded-2xl overflow-hidden"
          style={{ background: "linear-gradient(180deg,#0f172a,#060d1a)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 32px 80px rgba(0,0,0,0.6)" }}>

          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Personalizar</p>
              <h2 className="text-sm font-black text-white">{weaponName}</h2>
            </div>
            <button onClick={onClose} className="ml-auto w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-white/10">✕</button>
          </div>

          <div className="p-5 space-y-5">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* Sticker slots */}
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2">🎨 Stickers (5 slots)</p>
                  <div className="grid grid-cols-5 gap-2">
                    {[0, 1, 2, 3, 4].map(slot => {
                      const id = stickers[slot];
                      const item = id ? catalog[id] : null;
                      return (
                        <div key={slot} className="relative group">
                          <button
                            onClick={() => setPicker({ type: "sticker", slot })}
                            className="w-full aspect-square rounded-xl flex items-center justify-center transition-all hover:-translate-y-0.5"
                            style={{ background: id ? "rgba(30,41,59,0.9)" : "rgba(255,255,255,0.03)", border: `1px solid ${id ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.08)"}` }}>
                            {item ? (
                              <Image src={item.image} alt={item.name} width={48} height={48}
                                className="object-contain w-3/4 h-3/4" unoptimized />
                            ) : (
                              <span className="text-slate-600 text-xs font-bold">+</span>
                            )}
                          </button>
                          {/* Slot label */}
                          <p className="text-center text-[8px] text-slate-600 mt-0.5">{slot + 1}</p>
                          
                          {/* Wear slider */}
                          {id && (
                            <div className="mt-1 px-1">
                              <input
                                type="range" min="0" max="1" step="0.01"
                                value={stickerWear[slot]}
                                onChange={e => setStickerWear(prev => { const n = [...prev]; n[slot] = parseFloat(e.target.value); return n; })}
                                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-500"
                                title={`Desgaste: ${(stickerWear[slot] * 100).toFixed(0)}%`}
                              />
                            </div>
                          )}

                          {/* Remove button */}
                          {id && (
                            <button
                              onClick={() => {
                                setStickers(prev => { const n = [...prev]; n[slot] = null; return n; });
                                setStickerWear(prev => { const n = [...prev]; n[slot] = 0; return n; });
                              }}
                              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                              ✕
                            </button>
                          )}
                          {/* Tooltip */}
                          {item && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded-lg text-[9px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20"
                              style={{ background: "rgba(0,0,0,0.9)", border: "1px solid rgba(255,255,255,0.1)" }}>
                              {item.name}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Keychain / Pingente */}
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2">🔮 Pingente (Keychain)</p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setPicker({ type: "keychain", slot: 0 })}
                      className="group w-16 h-16 rounded-xl flex items-center justify-center transition-all hover:-translate-y-0.5"
                      style={{ background: keychain ? "rgba(30,41,59,0.9)" : "rgba(255,255,255,0.03)", border: `1px solid ${keychain ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.08)"}` }}>
                      {keychain && catalog[keychain] ? (
                        <Image src={catalog[keychain]!.image} alt={catalog[keychain]!.name} width={48} height={48}
                          className="object-contain w-3/4 h-3/4" unoptimized />
                      ) : (
                        <span className="text-slate-600 text-lg">+</span>
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      {keychain && catalog[keychain] ? (
                        <div>
                          <p className="text-xs font-bold text-white truncate">{catalog[keychain]!.name}</p>
                          <p className="text-[9px] text-slate-500">def_index: {keychain}</p>
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-500 italic">Nenhum pingente — clique para adicionar</p>
                      )}
                    </div>
                    {keychain && (
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between items-center">
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Posição (Seed)</p>
                          <span className="text-[10px] text-amber-400 font-mono">{keychainSeed}</span>
                        </div>
                        <input
                          type="range" min="0" max="1000" step="1"
                          value={keychainSeed}
                          onChange={e => setKeychainSeed(parseInt(e.target.value, 10))}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                      </div>
                    )}
                    {keychain && (
                      <button onClick={() => setKeychain(null)}
                        className="w-6 h-6 rounded-full bg-red-500/70 hover:bg-red-500 text-white text-[9px] flex items-center justify-center">✕</button>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="rounded-xl p-3 text-[9px] text-slate-500"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <p>💡 <strong className="text-slate-400">Personalização</strong>: Ajuste o desgaste dos stickers individualmente. O pingente pode ser posicionado via Seed.</p>
                  <p className="mt-0.5">Use <code className="text-amber-400">!ws</code> ou <code className="text-amber-400">!wp</code> + <code className="text-amber-400">!kill</code> no jogo para aplicar.</p>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-colors"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    Cancelar
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    className="flex-1 py-2.5 rounded-xl text-xs font-black text-slate-900 transition-all hover:scale-[1.02] disabled:opacity-60"
                    style={{ background: hasAny ? "linear-gradient(135deg,#f59e0b,#d97706)" : "rgba(255,255,255,0.06)" }}>
                    {saving ? "Salvando…" : hasAny ? "✓ Salvar" : "Salvar (limpar tudo)"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Picker de stickers/keychains */}
      {picker && (
        <ItemPicker
          type={picker.type}
          onPick={item => handlePick(item, picker.type, picker.slot)}
          onClose={() => setPicker(null)}
        />
      )}
    </>
  );
}

"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
} from "react";
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
  stickerWear: number[]; // 5 slots (0.0 a 1.0)
  keychain: number | null;
  keychainSeed: number;
};

export type StickerKeychainSectionHandle = {
  getConfig: () => StickerSlotConfig;
};

type Props = {
  weaponName: string;
  weaponDefindex: number;
  /** Alinhado a WeaponPaints / API: 0 = ambos, 2 = T, 3 = CT */
  weaponTeam?: 0 | 2 | 3;
  onClose: () => void;
  onSave: (cfg: StickerSlotConfig) => Promise<void>;
};

const RARITY_COLOR: Record<string, string> = {
  "Consumer Grade": "#b0c3d9",
  "Base Grade": "#b0c3d9",
  "Industrial Grade": "#5e98d9",
  "High Grade": "#4b69ff",
  Remarkable: "#8847ff",
  Exotic: "#d32ee6",
  "Mil-Spec Grade": "#4b69ff",
  Restricted: "#8847ff",
  Classified: "#d32ee6",
  Covert: "#eb4b4b",
  Contraband: "#e4ae39",
  Extraordinary: "#e4ae39",
};

// ─── Picker modal (inner) ─────────────────────────────────────────────────────

function ItemPicker({
  type,
  onPick,
  onClose,
}: {
  type: "sticker" | "keychain";
  onPick: (item: CatalogItem) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const LIMIT = 48;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (q: string, off: number) => {
      setLoading(true);
      try {
        const endpoint = type === "sticker" ? "/api/catalog/stickers" : "/api/catalog/keychains";
        const p = new URLSearchParams({ q, offset: String(off), limit: String(LIMIT) });
        const d = await fetch(`${endpoint}?${p}`).then((r) => r.json());
        off === 0 ? setItems(d.items ?? []) : setItems((prev) => [...prev, ...(d.items ?? [])]);
        setTotal(d.total ?? 0);
      } finally {
        setLoading(false);
      }
    },
    [type]
  );

  useEffect(() => {
    load("", 0);
  }, [load]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setOffset(0);
      load(query, 0);
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, load]);

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl"
      >
        <div
          className="flex items-center gap-3 border-b border-white/[0.08] px-5 py-4"
        >
          <span className="text-base">{type === "sticker" ? "🎨" : "🔮"}</span>
          <p className="text-sm font-black uppercase tracking-wider text-white">
            Selecionar {type === "sticker" ? "Sticker" : "Pingente"}
          </p>
          <div className="relative flex-1">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500">🔍</span>
            <input
              autoFocus
              type="text"
              placeholder="Buscar…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg py-1.5 pl-7 pr-3 text-xs text-white outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-xs text-zinc-500 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(108px,1fr))] gap-3 sm:gap-4">
            {items.map((item) => {
              const rc = RARITY_COLOR[item.rarity?.name ?? ""] ?? item.rarity?.color ?? "#b0c3d9";
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onPick(item);
                    onClose();
                  }}
                  title={item.name}
                  className="group relative overflow-hidden rounded-xl text-left transition-all hover:-translate-y-0.5 hover:shadow-lg"
                  style={{ background: "rgba(24,24,27,0.92)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <div
                    className="absolute inset-x-0 top-0 h-[2px]"
                    style={{ background: `linear-gradient(90deg,${rc}00,${rc},${rc}00)` }}
                  />
                  <div className="flex aspect-square items-center justify-center p-1.5">
                    <Image
                      src={item.image}
                      alt={item.name}
                      width={64}
                      height={64}
                      className="h-full w-full object-contain transition-transform group-hover:scale-110"
                      unoptimized
                    />
                  </div>
                  <div className="px-1.5 pb-2">
                    <p className="truncate text-xs font-bold leading-snug text-white">
                      {item.name.replace(/^.*\|\s*/, "")}
                    </p>
                  </div>
                </button>
              );
            })}
            {loading &&
              Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square animate-pulse rounded-xl"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                />
              ))}
          </div>
          {items.length < total && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  const n = offset + LIMIT;
                  setOffset(n);
                  load(query, n);
                }}
                disabled={loading}
                className="rounded-lg px-4 py-1.5 text-xs font-bold text-zinc-300 hover:text-white disabled:opacity-50"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                {loading ? "Carregando…" : `Mais (${total - items.length})`}
              </button>
            </div>
          )}
          {!loading && items.length === 0 && (
            <p className="mt-8 text-center text-xs text-zinc-500">Nenhum resultado</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Embeddable section (float modal + standalone modal) ─────────────────────

type SectionProps = {
  weaponDefindex: number;
  weaponTeam: 0 | 2 | 3;
  /** Compact layout for use inside SkinConfigModal */
  compact?: boolean;
};

export const StickerKeychainSection = forwardRef<StickerKeychainSectionHandle, SectionProps>(
  function StickerKeychainSection({ weaponDefindex, weaponTeam, compact }, ref) {
    const [stickers, setStickers] = useState<(number | null)[]>([null, null, null, null, null]);
    const [stickerWear, setStickerWear] = useState<number[]>([0, 0, 0, 0, 0]);
    const [keychain, setKeychain] = useState<number | null>(null);
    const [keychainSeed, setKeychainSeed] = useState<number>(0);
    const [catalog, setCatalog] = useState<Record<number, CatalogItem>>({});
    const [picker, setPicker] = useState<{ type: "sticker" | "keychain"; slot: number } | null>(
      null
    );
    const [loading, setLoading] = useState(true);

    useImperativeHandle(
      ref,
      () => ({
        getConfig: (): StickerSlotConfig => ({
          stickers,
          stickerWear,
          keychain,
          keychainSeed,
        }),
      }),
      [stickers, stickerWear, keychain, keychainSeed]
    );

    useEffect(() => {
      setLoading(true);
      fetch(`/api/skins/stickers?weapon_defindex=${weaponDefindex}&weapon_team=${weaponTeam}`)
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d.stickers)) {
            const ids = d.stickers.map((s: { id?: number }) => s?.id ?? null);
            const wears = d.stickers.map((s: { wear?: number }) => s?.wear ?? 0);
            setStickers(ids);
            setStickerWear(wears);
            d.stickers.forEach((s: { id?: number; name?: string; image?: string; rarity?: unknown }) => {
              const sid = s?.id;
              const sname = s?.name;
              const simage = s?.image;
              if (sid != null && sname && simage) {
                const row: CatalogItem = {
                  id: String(sid),
                  name: sname,
                  image: simage,
                  def_index: String(sid),
                  rarity: s.rarity as CatalogItem["rarity"],
                };
                setCatalog((prev) => ({ ...prev, [sid]: row }));
              }
            });
          }

          if (d.keychain) {
            const kc = d.keychain as { id: number; name?: string; image?: string; seed?: number; rarity?: unknown };
            setKeychain(kc.id);
            setKeychainSeed(kc.seed ?? 0);
            const kn = kc.name;
            const ki = kc.image;
            if (kc.id && kn && ki) {
              const row: CatalogItem = {
                id: String(kc.id),
                name: kn,
                image: ki,
                def_index: String(kc.id),
                rarity: kc.rarity as CatalogItem["rarity"],
              };
              setCatalog((prev) => ({ ...prev, [kc.id]: row }));
            }
          } else {
            setKeychain(null);
            setKeychainSeed(0);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [weaponDefindex, weaponTeam]);

    const handlePick = useCallback((item: CatalogItem, type: "sticker" | "keychain", slot: number) => {
      const id = parseInt(item.def_index, 10);
      setCatalog((prev) => ({ ...prev, [id]: item }));
      if (type === "keychain") {
        setKeychain(id);
      } else {
        setStickers((prev) => {
          const n = [...prev];
          n[slot] = id;
          return n;
        });
      }
    }, []);

    const pad = compact ? "px-4 py-4 sm:px-5 sm:pb-5" : "p-5";
    const slotGap = compact ? "gap-2.5 sm:gap-3" : "gap-3";

    return (
      <>
        <div className={`space-y-4 ${pad}`}>
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
            </div>
          ) : (
            <>
              <div>
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  🎨 Stickers (5 slots)
                </p>
                <div className={`grid grid-cols-5 ${slotGap}`}>
                  {[0, 1, 2, 3, 4].map((slot) => {
                    const id = stickers[slot];
                    const st = id ? catalog[id] : null;
                    return (
                      <div key={slot} className="group relative">
                        <button
                          type="button"
                          onClick={() => setPicker({ type: "sticker", slot })}
                          className="flex aspect-square w-full items-center justify-center rounded-xl transition-all hover:-translate-y-0.5"
                          style={{
                            background: id ? "rgba(24,24,27,0.95)" : "rgba(255,255,255,0.04)",
                            border: `1px solid ${id ? "rgba(245,158,11,0.45)" : "rgba(255,255,255,0.1)"}`,
                          }}
                        >
                          {st ? (
                            <Image
                              src={st.image}
                              alt={st.name}
                              width={48}
                              height={48}
                              className="h-3/4 w-3/4 object-contain"
                              unoptimized
                            />
                          ) : (
                            <span className="text-lg font-bold leading-none text-zinc-500">+</span>
                          )}
                        </button>
                        <p className="mt-1.5 text-center text-xs tabular-nums text-zinc-500">{slot + 1}</p>
                        {id && (
                          <div className="mt-1 px-0.5">
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.01"
                              value={stickerWear[slot]}
                              onChange={(e) =>
                                setStickerWear((prev) => {
                                  const n = [...prev];
                                  n[slot] = parseFloat(e.target.value);
                                  return n;
                                })
                              }
                              className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-violet-500"
                              title={`Desgaste: ${(stickerWear[slot] * 100).toFixed(0)}%`}
                            />
                          </div>
                        )}
                        {id && (
                          <button
                            type="button"
                            onClick={() => {
                              setStickers((prev) => {
                                const n = [...prev];
                                n[slot] = null;
                                return n;
                              });
                              setStickerWear((prev) => {
                                const n = [...prev];
                                n[slot] = 0;
                                return n;
                              });
                            }}
                            className="absolute -right-1 -top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            ✕
                          </button>
                        )}
                        {st && (
                          <div
                            className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 whitespace-nowrap rounded-lg px-2 py-1 text-[9px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                            style={{ background: "rgba(0,0,0,0.9)", border: "1px solid rgba(255,255,255,0.1)" }}
                          >
                            {st.name}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  🔮 Pingente (keychain)
                </p>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setPicker({ type: "keychain", slot: 0 })}
                    className="group flex h-14 w-14 shrink-0 items-center justify-center rounded-xl transition-all hover:-translate-y-0.5 sm:h-16 sm:w-16"
                    style={{
                      background: keychain ? "rgba(24,24,27,0.95)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${keychain ? "rgba(245,158,11,0.45)" : "rgba(255,255,255,0.1)"}`,
                    }}
                  >
                    {keychain && catalog[keychain] ? (
                      <Image
                        src={catalog[keychain]!.image}
                        alt={catalog[keychain]!.name}
                        width={48}
                        height={48}
                        className="h-3/4 w-3/4 object-contain"
                        unoptimized
                      />
                    ) : (
                      <span className="text-xl font-bold leading-none text-zinc-500">+</span>
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    {keychain && catalog[keychain] ? (
                      <div>
                        <p className="truncate text-xs font-bold text-white">{catalog[keychain]!.name}</p>
                        <p className="text-xs text-zinc-500">def_index: {keychain}</p>
                      </div>
                    ) : (
                      <p className="text-[10px] italic text-zinc-500">Nenhum pingente — clique para adicionar</p>
                    )}
                  </div>
                  {keychain && (
                    <div className="min-w-[120px] flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Seed</p>
                        <span className="font-mono text-[10px] text-amber-400">{keychainSeed}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1000"
                        step="1"
                        value={keychainSeed}
                        onChange={(e) => setKeychainSeed(parseInt(e.target.value, 10))}
                        className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-amber-500"
                      />
                    </div>
                  )}
                  {keychain && (
                    <button
                      type="button"
                      onClick={() => setKeychain(null)}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500/70 text-[9px] text-white hover:bg-red-500"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <div
                className="rounded-xl p-3 text-xs text-zinc-400"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
              >
                <p>
                  💡 Ajuste o desgaste de cada sticker e a posição do pingente. Após aplicar a skin, as alterações
                  gravam-se na mesma operação. Use <code className="text-amber-400">!wp</code> no jogo.
                </p>
              </div>
            </>
          )}
        </div>

        {picker && (
          <ItemPicker
            type={picker.type}
            onPick={(item) => handlePick(item, picker.type, picker.slot)}
            onClose={() => setPicker(null)}
          />
        )}
      </>
    );
  }
);

// ─── Standalone modal ─────────────────────────────────────────────────────────

export function StickerKeychainModal({ weaponName, weaponDefindex, weaponTeam = 0, onClose, onSave }: Props) {
  const sectionRef = useRef<StickerKeychainSectionHandle>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const cfg = sectionRef.current?.getConfig();
    if (!cfg) return;
    setSaving(true);
    try {
      await onSave(cfg);
      onClose();
    } catch {
      /* parent toast */
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)" }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl"
          style={{
            background: "linear-gradient(180deg, #0a0a0a 0%, #0c0c0c 50%, #090909 100%)",
            boxShadow: "0 32px 80px rgba(0,0,0,0.75)",
          }}
        >
          <div
            className="flex items-center gap-3 px-5 py-4"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Personalizar</p>
              <h2 className="text-sm font-black text-white">{weaponName}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:bg-white/10"
            >
              ✕
            </button>
          </div>

          <StickerKeychainSection
            ref={sectionRef}
            weaponDefindex={weaponDefindex}
            weaponTeam={weaponTeam}
          />

          <div className="flex gap-2 px-5 pb-5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl py-2.5 text-xs font-bold text-zinc-400 transition-colors hover:text-white"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="flex-1 rounded-xl py-2.5 text-xs font-black text-slate-900 transition-all hover:scale-[1.02] disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}
            >
              {saving ? "Salvando…" : "✓ Salvar"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

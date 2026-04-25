import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { KNIFE_CLASSNAME_TO_DEFINDEX } from "@/lib/knife-classnames";
import type { WpGloveRow } from "@/lib/weaponpaints-db";
import { clamp } from "@/lib/loadout-types";
import {
  type Skin,
  type Saved,
  type Agent,
  type Music,
  type Pin,
  KNIVES,
  GLOVES,
  CT_WEAPONS,
  T_WEAPONS,
  RARITY,
  catalogSkinDefindex,
} from "../types";

const LIMIT = 5000;
const key = (def: number, paint: number) => `${def}:${paint}`;

function normalizeSavedRow(raw: Saved): Saved {
  return {
    weapon_defindex: Number(raw.weapon_defindex),
    weapon_paint_id: Number(raw.weapon_paint_id),
    weapon_wear: Number(raw.weapon_wear),
    weapon_stattrak: (Number(raw.weapon_stattrak) ? 1 : 0) as 0 | 1,
    weapon_team: Number(raw.weapon_team) as 0 | 2 | 3,
  };
}

function purgeSavedForWeaponTeam(dest: Record<string, Saved>, def: number, tNum: 0 | 2 | 3) {
  const isKnife = KNIVES.has(def);
  const isGlove = GLOVES.has(def);
  for (const kk of Object.keys(dest)) {
    const e = dest[kk];
    const eDef = Number(e.weapon_defindex);
    if (isKnife) {
      if (!KNIVES.has(eDef)) continue;
    } else if (isGlove) {
      if (!GLOVES.has(eDef)) continue;
    } else if (eDef !== def) {
      continue;
    }
    if (tNum === 0) {
      if (e.weapon_team === 2 || e.weapon_team === 3) delete dest[kk];
    } else if (e.weapon_team === tNum) {
      delete dest[kk];
    }
  }
}

export function useSkinsData(cat: string, query: string, team: "all" | "ct" | "t") {
  const [skins, setSkins] = useState<Skin[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [saved, setSaved] = useState<Record<string, Saved>>({});
  const [allWeapons, setAllWeapons] = useState<Skin[]>([]);
  const [activeByDef, setActive] = useState<Record<number, Record<number, number>>>({});
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentTotal, setAgentTotal] = useState(0);
  const [agentOffset, setAgentOffset] = useState(0);
  const [agentCt, setAgentCt] = useState<Agent | null>(null);
  const [agentT, setAgentT] = useState<Agent | null>(null);
  const [agentSide, setAgentSide] = useState<"ct" | "t">("ct");
  const [savingAgent, setSavingAgent] = useState<string | null>(null);

  const [musics, setMusics] = useState<Music[]>([]);
  const [pins, setPins] = useState<Pin[]>([]);
  const [musicCt, setMusicCt] = useState<Music | null>(null);
  const [musicT, setMusicT] = useState<Music | null>(null);
  const [pinCt, setPinCt] = useState<Pin | null>(null);
  const [pinT, setPinT] = useState<Pin | null>(null);
  const [savingMusic, setSavingMusic] = useState<number | null>(null);
  const [savingPin, setSavingPin] = useState<number | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const syncInventory = useCallback(async () => {
    try {
      const [d, md, pd] = await Promise.all([
        fetch("/api/skins").then((r) => r.json()),
        fetch("/api/skins/music").then((r) => r.json()),
        fetch("/api/skins/pins").then((r) => r.json()),
      ]);
      if (d.error) return;

      if (Array.isArray(d.skins) || Array.isArray(d.gloves) || Array.isArray(d.knives)) {
        const m: Record<string, Saved> = {};
        const bd: Record<number, Record<number, number>> = {};
        const add = (raw: Saved) => {
          const s = normalizeSavedRow(raw);
          m[key(s.weapon_defindex, s.weapon_paint_id)] = s;
          if (!bd[s.weapon_defindex]) bd[s.weapon_defindex] = {};
          if (s.weapon_team === 0) {
            bd[s.weapon_defindex][2] = s.weapon_paint_id;
            bd[s.weapon_defindex][3] = s.weapon_paint_id;
          } else {
            bd[s.weapon_defindex][s.weapon_team] = s.weapon_paint_id;
          }
        };
        for (const raw of (d.skins ?? []) as Saved[]) add(raw);
        for (const g of (d.gloves ?? []) as WpGloveRow[]) {
          add({
            weapon_defindex: Number(g.weapon_defindex),
            weapon_paint_id: Number(g.weapon_paint_id),
            weapon_wear: Number(g.weapon_wear),
            weapon_stattrak: 0,
            weapon_team: Number(g.weapon_team) as 0 | 2 | 3,
          });
        }
        for (const kn of (d.knives ?? []) as { knife: string; weapon_team: number }[]) {
          const defKn = KNIFE_CLASSNAME_TO_DEFINDEX[kn.knife];
          if (defKn === undefined || !KNIVES.has(defKn)) continue;
          const hasAny = Object.values(m).some((x) => Number(x.weapon_defindex) === defKn);
          if (!hasAny) {
            add({
              weapon_defindex: defKn,
              weapon_paint_id: 0,
              weapon_wear: 0.000001,
              weapon_stattrak: 0,
              weapon_team: Number(kn.weapon_team) as 0 | 2 | 3,
            });
          }
        }
        setSaved(m);
        setActive(bd);
      }

      const ag = d.agents as { agent_ct: string | null; agent_t: string | null } | null | undefined;
      if (ag && (ag.agent_ct || ag.agent_t)) {
        try {
          const cr = await fetch("/api/catalog/agents?team=all&limit=10000&q=");
          const cd = await cr.json();
          const items = (cd.items ?? []) as Agent[];
          const byPath = (p: string | null) =>
            p ? (items.find((a) => a.model_player === p) ?? null) : null;
          const fallback = (p: string | null): Agent | null =>
            p
              ? {
                  id: p,
                  name: p.split("/").pop() ?? p,
                  image: "",
                  def_index: "",
                  model_player: p,
                  team: { id: "", name: "" },
                  rarity: { name: "", color: "" },
                }
              : null;
          setAgentCt(byPath(ag.agent_ct) ?? fallback(ag.agent_ct));
          setAgentT(byPath(ag.agent_t) ?? fallback(ag.agent_t));
        } catch {
          /* ignore */
        }
      } else {
        setAgentCt(null);
        setAgentT(null);
      }

      setMusicCt(null);
      setMusicT(null);
      setPinCt(null);
      setPinT(null);
      if (md.music) {
        for (const row of md.music as Music[]) {
          const t = Number((row as { team?: number }).team);
          if (t === 2) setMusicT(row);
          if (t === 3) setMusicCt(row);
        }
      }
      if (pd.pins) {
        for (const row of pd.pins as Pin[]) {
          const t = Number((row as { team?: number }).team);
          if (t === 2) setPinT(row);
          if (t === 3) setPinCt(row);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void syncInventory();
    fetch("/api/catalog/skins?filter=all&limit=10000")
      .then((r) => r.json())
      .then((d) => {
        if (d.items) setAllWeapons(d.items);
      })
      .catch(() => {});
  }, [syncInventory]);

  const fetchAgents = useCallback(
    async (q: string, off: number, catalogFilter: "all" | "ct" | "t" = "all") => {
    setLoading(true);
    try {
      const teamParam =
        catalogFilter === "ct"
          ? "counter-terrorists"
          : catalogFilter === "t"
            ? "terrorists"
            : "all";
      const p = new URLSearchParams({ team: teamParam, q, offset: String(off), limit: String(LIMIT) });
      const d = await fetch(`/api/catalog/agents?${p}`).then((r) => r.json());
      off === 0 ? setAgents(d.items ?? []) : setAgents((prev: Agent[]) => [...prev, ...(d.items ?? [])]);
      setAgentTotal(d.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveAgent = async (agent: Agent, side: "ct" | "t") => {
    setSavingAgent(agent.id);
    const modelPath = agent.model_player;
    if (!modelPath) {
      showToast(`Agente sem model path — não suportado pelo WeaponPaints`, false);
      return;
    }
    const isCt = agent.team?.id?.includes("counter");
    if (side === "ct" && !isCt) {
      showToast(`Não é possível equipar um agente TR na equipe CT.`, false);
      return;
    }
    if (side === "t" && isCt) {
      showToast(`Não é possível equipar um agente CT na equipe TR.`, false);
      return;
    }
    try {
      let formattedPath = modelPath.replace(/^(agents|characters)\/models\//, "");
      formattedPath = formattedPath.replace(/\.vmdl$/, "");
      const body = side === "ct" ? { agent_ct: formattedPath } : { agent_t: formattedPath };
      const r = await fetch("/api/skins/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error();
      if (side === "ct") setAgentCt(agent);
      else setAgentT(agent);
      showToast(`Agente ${agent.name.split("|")[0]?.trim()} (${side.toUpperCase()}) salvo! !wp no jogo.`, true);
      await syncInventory();
    } catch {
      showToast("Falha ao salvar agente", false);
    } finally {
      setSavingAgent(null);
    }
  };

  const removeAgent = async (side: "ct" | "t") => {
    try {
      await fetch("/api/skins/agents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ side }),
      });
      if (side === "ct") setAgentCt(null);
      else setAgentT(null);
      showToast(`Agente ${side.toUpperCase()} removido`, true);
      await syncInventory();
    } catch {
      showToast("Falha", false);
    }
  };

  const fetchMusic = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const d = await fetch(`/api/catalog/music?q=${encodeURIComponent(q)}`).then((r) => r.json());
      const raw = (d.items ?? []) as {
        id?: string;
        def_index?: string;
        name?: string;
        image?: string;
      }[];
      const normalized: Music[] = raw.map((row) => {
        const nid =
          row.def_index != null && row.def_index !== ""
            ? Number(row.def_index)
            : parseInt(String(row.id ?? "").replace(/[^\d]/g, ""), 10) || 0;
        return {
          id: nid,
          name: row.name ?? `Kit ${nid}`,
          image: row.image ?? "",
        };
      });
      setMusics(normalized);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPins = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const d = await fetch(`/api/catalog/pins?q=${encodeURIComponent(q)}`).then((r) => r.json());
      setPins(d.items ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveMusic = async (m: Music, slotSide?: "ct" | "t") => {
    const musicId = Number(m.id);
    if (!Number.isFinite(musicId) || musicId <= 0) {
      showToast("ID de música inválido", false);
      return;
    }
    setSavingMusic(musicId);
    try {
      const tNum =
        slotSide === "ct" ? 3 : slotSide === "t" ? 2 : team === "all" ? 0 : team === "ct" ? 3 : 2;
      const r = await fetch("/api/skins/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ music_id: musicId, weapon_team: tNum }),
      });
      if (!r.ok) throw new Error();
      const enriched: Music = {
        ...m,
        id: musicId,
        image: m.image ?? "",
        name: m.name,
      };
      if (tNum === 0 || tNum === 3) setMusicCt(enriched);
      if (tNum === 0 || tNum === 2) setMusicT(enriched);
      showToast(`Música ${m.name} salva! !wp no jogo.`, true);
      await syncInventory();
    } catch {
      showToast("Falha ao salvar música", false);
    } finally {
      setSavingMusic(null);
    }
  };

  const savePin = async (p: Pin, slotSide?: "ct" | "t") => {
    setSavingPin(p.id);
    try {
      const tNum =
        slotSide === "ct" ? 3 : slotSide === "t" ? 2 : team === "all" ? 0 : team === "ct" ? 3 : 2;
      const r = await fetch("/api/skins/pins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin_id: p.id, weapon_team: tNum }),
      });
      if (!r.ok) throw new Error();
      if (tNum === 0 || tNum === 3) setPinCt(p);
      if (tNum === 0 || tNum === 2) setPinT(p);
      showToast(`Pin ${p.name} salvo! !wp no jogo.`, true);
      await syncInventory();
    } catch {
      showToast("Falha ao salvar pin", false);
    } finally {
      setSavingPin(null);
    }
  };

  const fetch_ = useCallback(
    async (f: string, q: string, off: number) => {
      if (f === "agents") {
        fetchAgents(q, off);
        return;
      }
      if (f === "music") {
        fetchMusic(q);
        return;
      }
      if (f === "pins") {
        fetchPins(q);
        return;
      }
      setLoading(true);
      try {
        const p = new URLSearchParams({ filter: f, q, offset: String(off), limit: String(LIMIT) });
        const d = await fetch(`/api/catalog/skins?${p}`).then((r) => r.json());
        off === 0 ? setSkins(d.items ?? []) : setSkins((prev) => [...prev, ...(d.items ?? [])]);
        setTotal(d.total ?? 0);
      } finally {
        setLoading(false);
      }
    },
    [fetchAgents, fetchMusic, fetchPins]
  );

  useEffect(() => {
    setOffset(0);
    setSkins([]);
    fetch_(cat, query, 0);
  }, [cat]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setOffset(0);
      setSkins([]);
      fetch_(cat, query, 0);
    }, 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const getDefindex = (s: Skin) => catalogSkinDefindex(s);
  const rarityColor = (s: Skin) => RARITY[s.rarity?.name ?? ""] ?? s.rarity?.color ?? "#b0c3d9";

  const visibleSkins = useMemo(() => {
    return skins.filter((s) => {
      if (team === "ct")
        return CT_WEAPONS.has(s.weapon.id) || GLOVES.has(getDefindex(s)) || KNIVES.has(getDefindex(s));
      if (team === "t")
        return T_WEAPONS.has(s.weapon.id) || GLOVES.has(getDefindex(s)) || KNIVES.has(getDefindex(s));
      return true;
    });
  }, [skins, team]);

  const groups = useMemo(() => {
    return visibleSkins.reduce(
      (acc, s) => {
        const n = s.weapon.name;
        if (!acc[n]) acc[n] = [];
        acc[n]!.push(s);
        return acc;
      },
      {} as Record<string, Skin[]>
    );
  }, [visibleSkins]);
  const groupNames = useMemo(() => Object.keys(groups).sort(), [groups]);

  const configuredInCatalog = useMemo(() => {
    if (["loadout", "agents", "music", "pins"].includes(cat)) return 0;
    return visibleSkins.filter((s) => {
      const def = getDefindex(s);
      const paint = parseInt(String(s.paint_index ?? "0"), 10);
      const k = key(def, paint);
      const sav = saved[k];
      if (!sav) return false;
      if (team === "all") return true;
      if (team === "ct") return sav.weapon_team === 3 || sav.weapon_team === 0;
      return sav.weapon_team === 2 || sav.weapon_team === 0;
    }).length;
  }, [visibleSkins, saved, team, cat]);

  const handleSave = async (
    skin: Skin,
    opts: { float: number; stattrak: boolean },
    forcedTeam?: number
  ) => {
    const def = getDefindex(skin);
    if (!def) {
      showToast(`Erro: Defindex não encontrado para ${skin.weapon.name}`, false);
      return;
    }
    const paint = parseInt(String(skin.paint_index ?? "0"), 10);
    const k = key(def, paint);
    setBusyKey(k);
    try {
      const tNum =
        forcedTeam !== undefined
          ? (forcedTeam as 0 | 2 | 3)
          : team === "all"
            ? 0
            : team === "ct"
              ? 3
              : 2;
      const wear = clamp(opts.float, skin.min_float, skin.max_float);
      const r = await fetch("/api/skins/weapon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weapon_defindex: def,
          weapon_paint_id: paint,
          weapon_wear: wear,
          weapon_stattrak: opts.stattrak,
          weapon_team: tNum,
        }),
      });
      if (!r.ok) throw new Error();
      const ns: Saved = {
        weapon_defindex: def,
        weapon_paint_id: paint,
        weapon_wear: wear,
        weapon_stattrak: opts.stattrak ? 1 : 0,
        weapon_team: tNum,
      };
      setSaved((p) => {
        const n = { ...p };
        purgeSavedForWeaponTeam(n, def, tNum);
        n[k] = ns;
        return n;
      });
      setActive((p) => {
        const n = { ...p };
        if (!n[def]) n[def] = {};
        if (tNum === 0) {
          n[def][2] = paint;
          n[def][3] = paint;
        } else {
          n[def][tNum] = paint;
        }
        return n;
      });
      showToast(`★ ${skin.name} salva! Digite !wp no jogo.`, true);
      setAllWeapons((prev) => (prev.find((x) => x.id === skin.id) ? prev : [...prev, skin]));
      await syncInventory();
    } catch {
      showToast("Falha ao salvar", false);
    } finally {
      setBusyKey(null);
    }
  };

  const handleRemove = async (def: number, paint: number, forcedTeam?: number) => {
    const k = key(def, paint);
    setBusyKey(k);
    try {
      const tNum =
        forcedTeam !== undefined
          ? (forcedTeam as 0 | 2 | 3)
          : team === "all"
            ? 0
            : team === "ct"
              ? 3
              : 2;
      await fetch("/api/skins/weapon", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weapon_defindex: def, weapon_team: tNum }),
      });
      setSaved((p) => {
        const n = { ...p };
        if (tNum === 0) {
          for (const kk of Object.keys(n)) {
            if (Number(n[kk].weapon_defindex) === def) delete n[kk];
          }
        } else {
          delete n[k];
        }
        return n;
      });
      setActive((p) => {
        const n = { ...p };
        if (!n[def]) return n;
        if (tNum === 0) {
          delete n[def][2];
          delete n[def][3];
          delete n[def][0];
        } else {
          delete n[def][tNum];
        }
        return n;
      });
      showToast("Skin removida", true);
      await syncInventory();
    } catch {
      showToast("Falha", false);
    } finally {
      setBusyKey(null);
    }
  };

  return {
    skins,
    total,
    offset,
    setOffset,
    loading,
    busyKey,
    saved,
    allWeapons,
    activeByDef,
    toast,
    agents,
    agentTotal,
    agentOffset,
    setAgentOffset,
    agentCt,
    agentT,
    agentSide,
    setAgentSide,
    savingAgent,
    musics,
    pins,
    musicCt,
    musicT,
    pinCt,
    pinT,
    savingMusic,
    savingPin,
    LIMIT,
    showToast,
    syncInventory,
    fetchAgents,
    saveAgent,
    removeAgent,
    saveMusic,
    savePin,
    fetch_,
    getDefindex,
    rarityColor,
    visibleSkins,
    groups,
    groupNames,
    configuredInCatalog,
    handleSave,
    handleRemove,
    key,
  };
}

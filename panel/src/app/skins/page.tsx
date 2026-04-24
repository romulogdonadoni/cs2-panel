"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { SkinConfigModal, type SkinCatalogRow } from "@/components/skin-config-modal";
import { StickerKeychainModal } from "@/components/sticker-keychain-modal";
import { RemoteInventoryImage } from "@/components/remote-inventory-image";
import { clamp } from "@/lib/loadout-types";

// ── defindex map ───────────────────────────────────────────────────────────────
const DEFINDEX: Record<string, number> = {
  "ak47":7, "m4a1_s":60, "m4a4":16, "awp":9,
  "deagle":1, "usp_s":61, "glock":2, "p250":36,
  "fiveseven":3, "tec9":30, "hkp2000":32, "cz75a":63,
  "revolver":64, "elite":4, "mp9":34, "mac10":17,
  "mp7":33, "ump45":24, "bizon":26, "p90":19,
  "mp5sd":23, "famas":10, "sg556":39, "aug":8,
  "galil":13, "m249":14, "negev":28, "nova":35,
  "mag7":27, "sawedoff":29, "xm1014":25, "ssg08":40,
  "g3sg1":11, "scar20":38,
  "bayonet":500, "knife_flip":505, "knife_gut":506,
  "knife_karambit":507, "knife_m9_bayonet":508,
  "knife_tactical":509, "knife_falchion":512,
  "knife_survival_bowie":514, "knife_butterfly":515,
  "knife_push":516, "knife_cord":517, "knife_canis":518,
  "knife_ursus":519, "knife_gypsy_jackknife":520,
  "knife_outdoor":521, "knife_stiletto":522,
  "knife_widowmaker":523, "knife_skeleton":525,
  "knife_kukri":526, "knife_classic":503, "knife_css":503,
  "leather_handwraps":5032, "sport_gloves":5030,
  "motorcycle_gloves":5033, "specialist_gloves":5034,
  "driver_gloves":5031, "hydra_gloves":5035,
  "brokenfang_gloves":4725, "bloodhound_gloves":5027,
};

const GLOVES = new Set([4725, 5027, 5030, 5031, 5032, 5033, 5034, 5035]);
const KNIVES = new Set([500,503,505,506,507,508,509,512,514,515,516,517,518,519,520,521,522,523,525,526]);

// CT-only / T-only weapons for team filter
const CT_WEAPONS = new Set(["weapon_m4a1_silencer","weapon_m4a1","weapon_famas","weapon_mp9","weapon_mag7","weapon_scar20","weapon_hkp2000","weapon_usp_silencer","weapon_p2000"]);
const T_WEAPONS  = new Set(["weapon_ak47","weapon_galil","weapon_mac10","weapon_tec9","weapon_g3sg1","weapon_glock","weapon_sg556"]);

const RARITY: Record<string,string> = {
  "Consumer Grade":"#b0c3d9","Industrial Grade":"#5e98d9","Mil-Spec Grade":"#4b69ff",
  "Restricted":"#8847ff","Classified":"#d32ee6","Covert":"#eb4b4b","Extraordinary":"#e4ae39",
  "Consumidor":"#b0c3d9","Restrito":"#8847ff","Classificado":"#d32ee6","Secreto":"#eb4b4b","Extraordinário":"#e4ae39",
};

const CATEGORIES = [
  {id:"loadout",label:"Loadout",icon:"◈"},{id:"knife",label:"Facas",icon:"🗡"},
  {id:"gloves",label:"Luvas",icon:"🧤"},{id:"agents",label:"Agentes",icon:"🧑"},
  {id:"rifle",label:"Rifles",icon:"🎯"},{id:"sniper",label:"Sniper",icon:"🔭"},
  {id:"pistol",label:"Pistolas",icon:"🔫"},{id:"smg",label:"SMG",icon:"⚡"},
  {id:"shotgun",label:"Shotgun",icon:"💥"},{id:"heavy",label:"Pesado",icon:"🛡"},
  {id:"music",label:"Músicas",icon:"🎵"},{id:"pins",label:"Pins",icon:"🏅"},
];

type Music = { id: number; name: string; image: string; team?: 0 | 2 | 3 };
type Pin = { id: number; name: string; image: string; team?: 0 | 2 | 3 };

type Agent = { id:string; name:string; image:string; def_index:string; model_player:string|null; team:{id:string;name:string}; rarity:{name:string;color:string}; };

type Skin = SkinCatalogRow & { paint_index:string; weapon:{id:string;name:string;weapon_id?:number}; rarity:{name:string;color:string}; };
type Saved = { weapon_defindex:number; weapon_paint_id:number; weapon_wear:number; weapon_stattrak:0|1; weapon_team:0 | 2 | 3; };

const key = (def:number, paint:number) => `${def}:${paint}`;

export default function SkinsPage() {
  const [skins,setSkins]         = useState<Skin[]>([]);
  const [total,setTotal]         = useState(0);
  const [cat,setCat]             = useState("loadout");
  const [team,setTeam]           = useState<"all"|"ct"|"t">("all");
  const [query,setQuery]         = useState("");
  const [offset,setOffset]       = useState(0);
  const [loading,setLoading]     = useState(false);
  const [busyKey,setBusyKey]     = useState<string|null>(null);
  const [saved,setSaved]         = useState<Record<string,Saved>>({});
  const [activeByDef,setActive]  = useState<Record<number, Record<number, number>>>({}); // defindex -> { team: paint }
  const [selected,setSelected]   = useState<Skin|null>(null);
  const [toast,setToast]         = useState<{msg:string;ok:boolean}|null>(null);
  const [collapsed,setCollapsed] = useState<Record<string,boolean>>({});
  // Agents
  const [agents,setAgents]       = useState<Agent[]>([]);
  const [agentTotal,setAgentTotal] = useState(0);
  const [agentOffset,setAgentOffset] = useState(0);
  const [agentCt,setAgentCt]     = useState<Agent|null>(null);
  const [agentT,setAgentT]       = useState<Agent|null>(null);
  const [agentSide,setAgentSide] = useState<"ct"|"t">("ct");
  const [savingAgent,setSavingAgent] = useState<string|null>(null);
  // Stickers/Keychain
  const [stickerTarget,setStickerTarget] = useState<{defindex:number;name:string}|null>(null);
  // Music & Pins
  const [musics, setMusics] = useState<Music[]>([]);
  const [pins, setPins] = useState<Pin[]>([]);
  const [musicCt, setMusicCt] = useState<Music | null>(null);
  const [musicT, setMusicT] = useState<Music | null>(null);
  const [pinCt, setPinCt] = useState<Pin | null>(null);
  const [pinT, setPinT] = useState<Pin | null>(null);
  const [savingMusic, setSavingMusic] = useState<number | null>(null);
  const [savingPin, setSavingPin] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const LIMIT = 5000;

  useEffect(()=>{
    fetch("/api/skins").then(r=>r.json()).then(d=>{
      if(!d.skins) return;
      const m:Record<string,Saved>={}, bd:Record<number, Record<number, number>>={};
      for(const s of d.skins as Saved[]){
        m[key(s.weapon_defindex,s.weapon_paint_id)]=s;
        if(!bd[s.weapon_defindex]) bd[s.weapon_defindex] = {};
        bd[s.weapon_defindex][s.weapon_team] = s.weapon_paint_id;
      }
      setSaved(m); setActive(bd);
      // Carrega agentes salvos
      if(d.agents){ /* agentCt/T são def_index como string */ }
    }).catch(()=>{});

    // Carrega músicas e pins salvos
    fetch("/api/skins/music").then(r=>r.json()).then(d=>{
      if(d.music){
        d.music.forEach((m:any)=>{
          if(m.team===2) setMusicT(m);
          if(m.team===3) setMusicCt(m);
        });
      }
    }).catch(()=>{});

    fetch("/api/skins/pins").then(r=>r.json()).then(d=>{
      if(d.pins){
        d.pins.forEach((p:any)=>{
          if(p.team===2) setPinT(p);
          if(p.team===3) setPinCt(p);
        });
      }
    }).catch(()=>{});
  },[]);

  // Fetch agent catalog when agents tab is active
  const fetchAgents = useCallback(async(q:string,off:number)=>{
    setLoading(true);
    try{
      const p=new URLSearchParams({team:"all",q,offset:String(off),limit:String(LIMIT)});
      const d=await fetch(`/api/catalog/agents?${p}`).then(r=>r.json());
      off===0?setAgents(d.items??[]):setAgents((prev:Agent[])=>[...prev,...(d.items??[])]);
      setAgentTotal(d.total??0);
    }finally{setLoading(false);}
  },[]);

  const saveAgent = async(agent:Agent, side:"ct"|"t")=>{
    setSavingAgent(agent.id);
    // WeaponPaints usa o model_player path, NÃO o def_index
    const modelPath = agent.model_player;
    if(!modelPath){
      showToast(`Agente sem model path — não suportado pelo WeaponPaints`,false);
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
    try{
      let formattedPath = modelPath.replace(/^(agents|characters)\/models\//, "");
      formattedPath = formattedPath.replace(/\.vmdl$/, "");
      const body = side==="ct" ? {agent_ct:formattedPath} : {agent_t:formattedPath};
      const r=await fetch("/api/skins/agents",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      if(!r.ok) throw new Error();
      if(side==="ct") setAgentCt(agent); else setAgentT(agent);
      showToast(`Agente ${agent.name.split("|")[0]?.trim()} (${side.toUpperCase()}) salvo! !wp no jogo.`,true);
    }catch{showToast("Falha ao salvar agente",false);}
    finally{setSavingAgent(null);}
  };

  const removeAgent = async(side:"ct"|"t")=>{
    try{
      await fetch("/api/skins/agents",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({side})});
      if(side==="ct") setAgentCt(null); else setAgentT(null);
      showToast(`Agente ${side.toUpperCase()} removido`,true);
    }catch{showToast("Falha",false);}
  };

  const fetchMusic = useCallback(async(q:string)=>{
    setLoading(true);
    try{
      const d = await fetch(`/api/catalog/music?q=${q}`).then(r=>r.json());
      setMusics(d.items ?? []);
    }finally{setLoading(false);}
  },[]);

  const fetchPins = useCallback(async(q:string)=>{
    setLoading(true);
    try{
      const d = await fetch(`/api/catalog/pins?q=${q}`).then(r=>r.json());
      setPins(d.items ?? []);
    }finally{setLoading(false);}
  },[]);

  const saveMusic = async(m:Music)=>{
    setSavingMusic(m.id);
    try{
      const tNum = team === "all" ? 0 : (team === "ct" ? 3 : 2);
      const r = await fetch("/api/skins/music",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({music_id:m.id, weapon_team:tNum})});
      if(!r.ok) throw new Error();
      if(tNum===0||tNum===3) setMusicCt(m);
      if(tNum===0||tNum===2) setMusicT(m);
      showToast(`Música ${m.name} salva! !wp no jogo.`,true);
    }catch{showToast("Falha ao salvar música",false);}
    finally{setSavingMusic(null);}
  };

  const savePin = async(p:Pin)=>{
    setSavingPin(p.id);
    try{
      const tNum = team === "all" ? 0 : (team === "ct" ? 3 : 2);
      const r = await fetch("/api/skins/pins",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pin_id:p.id, weapon_team:tNum})});
      if(!r.ok) throw new Error();
      if(tNum===0||tNum===3) setPinCt(p);
      if(tNum===0||tNum===2) setPinT(p);
      showToast(`Pin ${p.name} salvo! !wp no jogo.`,true);
    }catch{showToast("Falha ao salvar pin",false);}
    finally{setSavingPin(null);}
  };

  const fetch_ = useCallback(async(f:string,q:string,off:number)=>{
    if(f==="agents"){ fetchAgents(q,off); return; }
    if(f==="music"){ fetchMusic(q); return; }
    if(f==="pins"){ fetchPins(q); return; }
    setLoading(true);
    try{
      const p=new URLSearchParams({filter:f,q,offset:String(off),limit:String(LIMIT)});
      const d=await fetch(`/api/catalog/skins?${p}`).then(r=>r.json());
      off===0?setSkins(d.items??[]):setSkins(prev=>[...prev,...(d.items??[])]);
      setTotal(d.total??0);
    }finally{setLoading(false);}
  },[fetchAgents, fetchMusic, fetchPins]);

  useEffect(()=>{ setOffset(0);setSkins([]);fetch_(cat,query,0); },[cat]); // eslint-disable-line

  useEffect(()=>{
    if(timer.current) clearTimeout(timer.current);
    timer.current=setTimeout(()=>{ setOffset(0);setSkins([]);fetch_(cat,query,0); },350);
    return ()=>{ if(timer.current) clearTimeout(timer.current); };
  },[query]); // eslint-disable-line

  const getDefindex=(s:Skin)=>DEFINDEX[s.weapon.id]??s.weapon.weapon_id??0;
  const rarityColor=(s:Skin)=>RARITY[s.rarity?.name]??s.rarity?.color??"#b0c3d9";

  // team filter on client side
  const visibleSkins = skins.filter(s=>{
    if(team==="ct") return CT_WEAPONS.has(s.weapon.id)||GLOVES.has(getDefindex(s))||KNIVES.has(getDefindex(s));
    if(team==="t")  return T_WEAPONS.has(s.weapon.id)||GLOVES.has(getDefindex(s))||KNIVES.has(getDefindex(s));
    return true;
  });

  // group by weapon name
  const groups = visibleSkins.reduce((acc,s)=>{
    const n=s.weapon.name;
    if(!acc[n]) acc[n]=[];
    acc[n]!.push(s);
    return acc;
  },{} as Record<string,Skin[]>);
  const groupNames=Object.keys(groups).sort();

  const configuredInCatalog = useMemo(() => {
    if (["loadout", "agents", "music", "pins"].includes(cat)) return 0;
    return visibleSkins.filter((s) => {
      const def = getDefindex(s);
      const paint = parseInt(s.paint_index ?? "0", 10);
      const k = key(def, paint);
      const sav = saved[k];
      if (!sav) return false;
      if (team === "all") return true;
      if (team === "ct") return sav.weapon_team === 3 || sav.weapon_team === 0;
      return sav.weapon_team === 2 || sav.weapon_team === 0;
    }).length;
  }, [visibleSkins, saved, team, cat]);

  const handleSave=async(skin:Skin,opts:{float:number;stattrak:boolean})=>{
    const def=getDefindex(skin); 
    if(!def){
      console.error("Defindex not found for", skin.weapon.id);
      showToast(`Erro: Defindex não encontrado para ${skin.weapon.name}`, false);
      return;
    }
    const paint=parseInt(skin.paint_index??"0",10);
    const k=key(def,paint); setBusyKey(k);
    try{
      const tNum = team === "all" ? 0 : (team === "ct" ? 3 : 2);
      const r=await fetch("/api/skins/weapon",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({weapon_defindex:def,weapon_paint_id:paint,
          weapon_wear:clamp(opts.float,skin.min_float,skin.max_float),weapon_stattrak:opts.stattrak,weapon_team:tNum})});
      if(!r.ok) throw new Error();
      const ns:Saved={weapon_defindex:def,weapon_paint_id:paint,weapon_wear:opts.float,weapon_stattrak:opts.stattrak?1:0,weapon_team:tNum};
      setSaved(p=>{const n={...p}; n[k]=ns; return n;});
      setActive(p=>{
        const n={...p};
        if(!n[def]) n[def]={};
        n[def][tNum] = paint;
        return n;
      });
      showToast(`★ ${skin.name} salva! Digite !wp no jogo.`,true);
    }catch{showToast("Falha ao salvar",false);}
    finally{setBusyKey(null);}
  };

  const handleRemove=async(def:number,paint:number)=>{
    const k=key(def,paint); setBusyKey(k);
    try{
      const tNum = team === "all" ? 0 : (team === "ct" ? 3 : 2);
      await fetch("/api/skins/weapon",{method:"DELETE",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({weapon_defindex:def,weapon_team:tNum})});
      setSaved(p=>{const n={...p};delete n[k];return n;});
      setActive(p=>{
        const n={...p};
        if(n[def]) delete n[def][tNum];
        return n;
      });
      showToast("Skin removida",true);
    }catch{showToast("Falha",false);}
    finally{setBusyKey(null);}
  };

  const showToast=(msg:string,ok:boolean)=>{ setToast({msg,ok}); setTimeout(()=>setToast(null),4000); };

  const savedList = Object.values(saved);

  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 border-b border-white/5 bg-slate-950/95 shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        <div className="max-w-[1700px] mx-auto px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Link
              href="/"
              className="mt-0.5 shrink-0 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-bold text-slate-300 transition hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-white"
            >
              {"<"} Voltar
            </Link>
            <div>
              <h1 className="text-2xl font-black italic tracking-tight text-white">
                MINHA <span className="text-amber-500">LOADOUT</span>
              </h1>
              <p className="mt-0.5 text-sm text-amber-100/80">
                Salve skins e use{" "}
                <code className="rounded bg-white/10 px-1.5 py-0.5 text-amber-200">!wp</code> +{" "}
                <code className="rounded bg-white/10 px-1.5 py-0.5 text-amber-200">!kill</code> no jogo
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex overflow-hidden rounded-xl border border-white/10 p-0.5">
              {(["all", "ct", "t"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTeam(t)}
                  className={`rounded-lg px-3.5 py-2 text-xs font-bold uppercase transition-all ${
                    team === t
                      ? t === "all"
                        ? "bg-white text-slate-900 shadow-sm"
                        : t === "ct"
                          ? "bg-blue-500 text-white shadow-md shadow-blue-500/20"
                          : "bg-amber-500 text-slate-900 shadow-md shadow-amber-500/20"
                      : "text-slate-500 hover:text-slate-200"
                  }`}
                >
                  {t === "all" ? "All" : t === "ct" ? "CT" : "T"}
                </button>
              ))}
            </div>
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
              <input
                type="search"
                placeholder="Buscar.."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-4 text-sm text-white placeholder:text-slate-600 outline-none ring-0 transition focus:border-amber-500/40 focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          </div>
        </div>
        <div className="max-w-[1700px] mx-auto px-4 pb-3 flex gap-1.5 overflow-x-auto [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent]">
          {CATEGORIES.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setCat(f.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider transition-all ${
                cat === f.id
                  ? "border-2 border-amber-500 bg-amber-500/10 text-amber-200 shadow-sm shadow-amber-500/10"
                  : "border border-white/10 bg-white/[0.04] text-slate-500 hover:border-white/20 hover:text-slate-200"
              }`}
            >
              <span className="opacity-90" aria-hidden>
                {f.icon}
              </span>{" "}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main layout ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 max-w-[1700px] mx-auto w-full px-4 py-4 gap-4">

        {/* ── Main content area ────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 pb-20">
          
          {cat === "loadout" && (
            <div className="space-y-4">
              <div className="mb-4 flex items-end justify-between gap-4">
                <h2 className="text-lg font-bold text-white">Loadout ativo</h2>
                <p className="text-right">
                  <span className="text-2xl font-black tabular-nums text-amber-400">{savedList.length}</span>
                  <span className="ml-2 text-sm text-slate-500">peças</span>
                </p>
              </div>
              
              {savedList.length === 0 ? (
                <div className="rounded-xl p-8 text-center" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)"}}>
                  <p className="text-sm text-slate-500">Nenhuma skin configurada no momento.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {savedList.map(s => {
                    const skin=skins.find(sk=>getDefindex(sk)===s.weapon_defindex&&parseInt(sk.paint_index??"0",10)===s.weapon_paint_id);
                    const label=skin?skin.name:`Defindex ${s.weapon_defindex}`;
                    const weapLabel=skin?skin.weapon.name:(KNIVES.has(s.weapon_defindex)?"Faca":GLOVES.has(s.weapon_defindex)?"Luva":"Arma");
                    return (
                      <div key={key(s.weapon_defindex,s.weapon_paint_id)}
                        className="group relative flex flex-col items-center gap-3 p-4 rounded-xl cursor-pointer transition-all hover:-translate-y-1"
                        style={{background:"rgba(15,23,42,0.8)",border:"1px solid rgba(255,255,255,0.06)"}}>
                        <div className="h-24 w-full overflow-hidden rounded-lg">
                          <RemoteInventoryImage
                            src={skin?.image}
                            alt={label}
                            className="h-full w-full object-contain"
                            fallbackChar="🎯"
                          />
                        </div>
                        <div className="text-center w-full min-w-0 mt-2">
                          <p className="text-[10px] text-slate-500 uppercase font-bold truncate">{weapLabel}</p>
                          <p className="text-xs text-white font-bold truncate">{label}</p>
                          <p className="text-[9px] text-slate-600 mt-1">{s.weapon_wear.toFixed(3)}{s.weapon_stattrak?" • ST":""}</p>
                        </div>
                        <button onClick={()=>handleRemove(s.weapon_defindex,s.weapon_paint_id)}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full bg-red-500/80 hover:bg-red-500 text-white text-[10px] flex items-center justify-center shrink-0 transition-all">✕</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {cat !== "loadout" && !["agents", "music", "pins"].includes(cat) && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3.5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Catálogo (filtro atual)</p>
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
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Já no teu loadout</p>
                <p>
                  <span className="text-2xl font-black tabular-nums text-amber-400">{savedList.length}</span>
                  <span className="ml-2 text-sm text-slate-400">guardadas</span>
                </p>
              </div>
            </div>
          )}

          {/* ── Agents UI ─────────────────────────────────────────────────── */}
          {cat==="agents"&&(
            <div className="space-y-5">
              {/* Current agents */}
              <div className="grid grid-cols-2 gap-3">
                {(["ct","t"] as const).map(side=>{
                  const ag=side==="ct"?agentCt:agentT;
                  const isActive=agentSide===side;
                  return (
                    <div key={side}
                      className="relative p-3 rounded-xl cursor-pointer transition-all"
                      style={{background:isActive?(side==="ct"?"rgba(59,130,246,0.15)":"rgba(245,158,11,0.15)"):"rgba(255,255,255,0.03)",border:`1px solid ${isActive?(side==="ct"?"rgba(59,130,246,0.4)":"rgba(245,158,11,0.4)"):"rgba(255,255,255,0.08)"}`}}
                      onClick={()=>setAgentSide(side)}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded uppercase"
                          style={{background:side==="ct"?"rgba(59,130,246,0.2)":"rgba(245,158,11,0.2)",color:side==="ct"?"#60a5fa":"#f59e0b"}}>
                          {side.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-slate-400">{side==="ct"?"Counter-Terrorist":"Terrorist"}</span>
                        {isActive&&<span className="ml-auto text-[9px] text-slate-400 italic">selecionando…</span>}
                      </div>
                      {ag?(
                        <div className="flex items-center gap-2">
                          <div className="h-10 w-10 overflow-hidden rounded">
                            <RemoteInventoryImage src={ag.image} alt={ag.name} className="h-full w-full object-contain" fallbackChar="👤" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate">{ag.name.split("|")[0]?.trim()}</p>
                            <p className="text-[9px] text-slate-400 truncate">{ag.name.split("|")[1]?.trim()}</p>
                          </div>
                          <button onClick={e=>{e.stopPropagation();removeAgent(side);}}
                            className="w-5 h-5 rounded-full bg-red-500/70 hover:bg-red-500 text-white text-[9px] flex items-center justify-center">✕</button>
                        </div>
                      ):(
                        <p className="text-[10px] text-slate-500 italic">Nenhum agente — clique para selecionar</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Agent grid filter */}
              <div className="flex items-center gap-3">
                <p className="text-xs text-slate-400">Selecionando para: <span className="font-black" style={{color:agentSide==="ct"?"#60a5fa":"#f59e0b"}}>{agentSide.toUpperCase()}</span></p>
                <div className="ml-auto flex gap-2">
                  {(["ct","t","all"] as const).map(s=>(
                    <button key={s} onClick={()=>{
                      const sq=query; setQuery(""); setTimeout(()=>setQuery(sq),0);
                      const p=new URLSearchParams({team:s==="ct"?"counter-terrorists":s==="t"?"terrorists":"all",q:query,offset:"0",limit:String(LIMIT)});
                      setLoading(true);
                      fetch(`/api/catalog/agents?${p}`).then(r=>r.json()).then(d=>{setAgents(d.items??[]);setAgentTotal(d.total??0);}).finally(()=>setLoading(false));
                    }}
                      className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase"
                      style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.5)"}}>
                      {s==="all"?"Todos":s.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Agent grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {agents.map((agent:Agent)=>{
                  const isSelected=(agentSide==="ct"?agentCt?.id:agentT?.id)===agent.id;
                  const isBusy=savingAgent===agent.id;
                  const isCt=agent.team?.id?.includes("counter");
                  const rc=RARITY[agent.rarity?.name]??agent.rarity?.color??"#8847ff";
                  return (
                    <motion.div key={agent.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:0.12}}>
                      <div
                        className="group relative rounded-xl overflow-hidden cursor-pointer transition-all hover:-translate-y-0.5"
                        style={{background:"rgba(15,23,42,0.8)",border:`1px solid ${isSelected?`${rc}55`:"rgba(255,255,255,0.06)"}`,boxShadow:isSelected?`0 0 16px ${rc}22`:undefined}}
                        onClick={()=>!isBusy&&saveAgent(agent,agentSide)}>
                        <div className="absolute top-0 inset-x-0 h-[2px]" style={{background:`linear-gradient(90deg,${rc}00,${rc},${rc}00)`}}/>
                        {isSelected&&<div className="absolute top-1.5 right-1.5 z-10 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center"><span className="text-[7px] text-slate-900 font-black">✓</span></div>}
                        <div className="absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 rounded text-[7px] font-black uppercase"
                          style={{background:isCt?"rgba(59,130,246,0.3)":"rgba(245,158,11,0.3)",color:isCt?"#93c5fd":"#fcd34d"}}>
                          {isCt?"CT":"T"}
                        </div>
                        <div className="aspect-square overflow-hidden bg-gradient-to-b from-slate-800/40 to-slate-900/20 group-hover:opacity-100">
                          <RemoteInventoryImage
                            src={agent.image}
                            alt={agent.name}
                            className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.04]"
                            fallbackChar="👤"
                          />
                        </div>
                        <div className="p-2">
                          <p className="text-[9px] font-bold text-white truncate">{agent.name.split("|")[0]?.trim()}</p>
                          <p className="text-[8px] text-slate-400 truncate">{agent.name.split("|")[1]?.trim()}</p>
                          <span className="text-[7px] font-bold px-1 py-0.5 rounded uppercase mt-1 inline-block" style={{color:rc,background:`${rc}18`}}>{agent.rarity?.name}</span>
                        </div>
                        {isBusy&&<div className="absolute inset-0 bg-black/60 flex items-center justify-center"><div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"/></div>}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              {agents.length<agentTotal&&(
                <div className="flex justify-center">
                  <button onClick={()=>{const n=agentOffset+LIMIT;setAgentOffset(n);fetchAgents(query,n);}} disabled={loading}
                    className="px-6 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white disabled:opacity-50"
                    style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)"}}>
                    {loading?"Carregando…":`Carregar mais (${agentTotal-agents.length})`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Music UI ─────────────────────────────────────────────────── */}
          {cat==="music"&&(
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {(["ct","t"] as const).map(side=>{
                  const m=side==="ct"?musicCt:musicT;
                  const isActive=(team==="all") || (team===side);
                  return (
                    <div key={side} className="p-3 rounded-xl" style={{background:"rgba(255,255,255,0.03)",border:isActive?"1px solid rgba(59,130,246,0.4)":"1px solid rgba(255,255,255,0.08)"}}>
                      <p className="text-[10px] font-black text-slate-500 uppercase mb-2">{side==="ct"?"Contra-Terrorista":"Terrorista"}</p>
                      {m?(
                        <div className="flex items-center gap-2">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded">
                            <RemoteInventoryImage src={m.image} alt={m.name} className="h-full w-full object-cover" fallbackChar="🎵" />
                          </div>
                          <p className="text-xs font-bold text-white truncate">{m.name}</p>
                        </div>
                      ):<p className="text-[10px] text-slate-500 italic">Padrão</p>}
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {musics.map(m=>(
                  <div key={m.id} onClick={()=>saveMusic(m)} className="group relative rounded-xl p-2 cursor-pointer transition-all hover:bg-white/5" style={{background:"rgba(15,23,42,0.8)",border:"1px solid rgba(255,255,255,0.06)"}}>
                    <div className="mb-2 overflow-hidden rounded-lg">
                      <RemoteInventoryImage
                        src={m.image}
                        alt={m.name}
                        className="mx-auto h-20 w-20 object-cover transition group-hover:scale-105"
                        fallbackChar="🎵"
                      />
                    </div>
                    <p className="text-[9px] font-bold text-white text-center line-clamp-2">{m.name}</p>
                    {savingMusic===m.id&&<div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-xl"><div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"/></div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Pins UI ─────────────────────────────────────────────────── */}
          {cat==="pins"&&(
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {(["ct","t"] as const).map(side=>{
                  const p=side==="ct"?pinCt:pinT;
                  const isActive=(team==="all") || (team===side);
                  return (
                    <div key={side} className="p-3 rounded-xl" style={{background:"rgba(255,255,255,0.03)",border:isActive?"1px solid rgba(59,130,246,0.4)":"1px solid rgba(255,255,255,0.08)"}}>
                      <p className="text-[10px] font-black text-slate-500 uppercase mb-2">{side==="ct"?"Contra-Terrorista":"Terrorista"}</p>
                      {p?(
                        <div className="flex items-center gap-2">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded">
                            <RemoteInventoryImage src={p.image} alt={p.name} className="h-full w-full object-contain" fallbackChar="○" />
                          </div>
                          <p className="text-xs font-bold text-white truncate">{p.name}</p>
                        </div>
                      ):<p className="text-[10px] text-slate-500 italic">Nenhum</p>}
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 gap-3">
                {pins.map(p=>(
                  <div key={p.id} onClick={()=>savePin(p)} className="group relative rounded-xl p-2 cursor-pointer transition-all hover:bg-white/5" style={{background:"rgba(15,23,42,0.8)",border:"1px solid rgba(255,255,255,0.06)"}}>
                    <div className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden">
                      <RemoteInventoryImage
                        src={p.image}
                        alt={p.name}
                        className="max-h-16 w-full object-contain transition group-hover:scale-105"
                        fallbackChar="○"
                      />
                    </div>
                    <p className="text-[8px] font-bold text-white text-center mt-1 line-clamp-2">{p.name}</p>
                    {savingPin===p.id&&<div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-xl"><div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"/></div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grouped sections */}
          {cat!=="agents" && cat!=="music" && cat!=="pins" && groupNames.length>0&&!loading&&(
            <div className="space-y-6">
              {cat !== "loadout" && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">
                    {visibleSkins.length} de {total} skins
                  </span>
                  <span className="font-bold text-amber-400 tabular-nums">
                    {configuredInCatalog} configuradas
                  </span>
                </div>
              )}
              {groupNames.map((gname, idx)=>{
                const gskins=groups[gname]!;
                const isOpen=collapsed[gname] !== undefined ? collapsed[gname] : (idx === 0);
                return (
                  <div key={gname}>
                    {/* Group header */}
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

                    {isOpen&&(
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
                        <AnimatePresence mode="popLayout">
                          {gskins.map((skin,i)=>{
                            const def=getDefindex(skin);
                            const paint=parseInt(skin.paint_index??"0",10);
                            const k=key(def,paint);
                            const activeTeams = (activeByDef[def] as any) || {};
                            const isSaved = Object.values(activeTeams).includes(paint);
                            const teamsApplied = Object.entries(activeTeams).filter(([_,p])=>p===paint).map(([t])=>parseInt(t,10));
                            const isBusy=busyKey===k;
                            const rc=rarityColor(skin);
                            return (
                              <motion.div key={k} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,scale:0.95}}
                                transition={{duration:0.12,delay:Math.min(i*0.01,0.2)}}>
                                <div
                                  className="group relative cursor-pointer overflow-hidden rounded-xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 hover:ring-1 hover:ring-amber-500/20"
                                  style={{
                                    background: "rgba(15,23,42,0.9)",
                                    borderColor: isSaved ? `${rc}55` : "rgba(255,255,255,0.08)",
                                    boxShadow: isSaved ? `0 0 20px ${rc}18` : undefined,
                                  }}
                                  onClick={() => setSelected(skin)}
                                >
                                  <div
                                    className="absolute inset-x-0 top-0 h-[2px]"
                                    style={{ background: `linear-gradient(90deg,${rc}00,${rc},${rc}00)` }}
                                  />
                                  {isSaved && (
                                    <div className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-slate-900/50 bg-amber-400 shadow-lg">
                                      <span className="text-[8px] font-black text-slate-900">✓</span>
                                    </div>
                                  )}
                                  <div className="absolute left-1.5 top-1.5 z-10 flex flex-col gap-1">
                                    {teamsApplied.includes(0) && (
                                      <span className="rounded border border-white/10 bg-white/20 px-1 text-[6px] font-black text-white backdrop-blur-sm">ANY</span>
                                    )}
                                    {teamsApplied.includes(2) && (
                                      <span className="rounded border border-amber-500/20 bg-amber-500/30 px-1 text-[6px] font-black text-amber-300 backdrop-blur-sm">T</span>
                                    )}
                                    {teamsApplied.includes(3) && (
                                      <span className="rounded border border-blue-500/20 bg-blue-500/30 px-1 text-[6px] font-black text-blue-300 backdrop-blur-sm">CT</span>
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
                                    <p className="line-clamp-2 min-h-[2.25em] text-[10px] font-bold leading-tight text-white">
                                      {skin.name.replace(/^.*\|\s*/, "")}
                                    </p>
                                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                                      <span
                                        className="rounded px-1.5 py-0.5 text-[7px] font-bold uppercase"
                                        style={{ color: rc, background: `${rc}20` }}
                                      >
                                        {skin.rarity?.name?.split(" ").pop()}
                                      </span>
                                      {skin.stattrak && (
                                        <span className="rounded bg-orange-400/15 px-1.5 py-0.5 text-[7px] font-bold text-orange-400">ST</span>
                                      )}
                                    </div>
                                  </div>
                                  {isSaved&&!isBusy&&(
                                    <>
                                      <button onClick={e=>{e.stopPropagation();setStickerTarget({defindex:def,name:skin.weapon.name+" | "+skin.name.replace(/^.*\|\s*/,"")});}}
                                        className="absolute bottom-1 left-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity w-4 h-4 rounded-full bg-violet-500 flex items-center justify-center text-white text-[8px]"
                                        title="Stickers & Pingente">🎨</button>
                                      <button onClick={e=>{e.stopPropagation();handleRemove(def,paint);}}
                                        className="absolute bottom-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-white text-[8px]">✕</button>
                                    </>
                                  )}
                                  {isBusy&&<div className="absolute inset-0 bg-black/60 flex items-center justify-center"><div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"/></div>}
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
          )}

          {/* Load more */}
          {skins.length<total&&(
            <div className="flex justify-center mt-8">
              <button onClick={()=>{const n=offset+LIMIT;setOffset(n);fetch_(cat,query,n);}} disabled={loading}
                className="px-8 py-3 rounded-xl text-sm font-bold text-slate-300 hover:text-white transition-all disabled:opacity-50"
                style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)"}}>
                {loading?"Carregando…":`Carregar mais (${total-skins.length} restantes)`}
              </button>
            </div>
          )}

          {loading&&skins.length===0&&(
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
              {Array.from({length:24}).map((_,i)=><div key={i} className="rounded-xl animate-pulse aspect-[3/4]" style={{background:"rgba(255,255,255,0.04)"}}/>)}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {(()=>{
        if(!selected) return null;
        const def=getDefindex(selected);
        const paint=parseInt(selected.paint_index??"0",10);
        const sv=saved[key(def,paint)];
        const initial=sv?{skinId:String(sv.weapon_paint_id),float:sv.weapon_wear,stattrak:sv.weapon_stattrak===1}:undefined;
        return (
          <SkinConfigModal
            item={selected}
            initial={initial}
            onClose={()=>setSelected(null)}
            onSave={(opts:{float:number;stattrak:boolean})=>{handleSave(selected,opts);setSelected(null);}}
          />
        );
      })()}

      {/* Sticker/Keychain Modal */}
      {stickerTarget&&(
        <StickerKeychainModal
          weaponName={stickerTarget.name}
          weaponDefindex={stickerTarget.defindex}
          weaponTeam={0}
          onClose={()=>setStickerTarget(null)}
          onSave={async(cfg)=>{
            const r=await fetch("/api/skins/stickers",{method:"POST",headers:{"Content-Type":"application/json"},
              body:JSON.stringify({weapon_defindex:stickerTarget.defindex,weapon_team:0,...cfg})});
            if(!r.ok) throw new Error();
            showToast("Stickers/Pingente salvos! !wp no jogo.",true);
          }}
        />
      )}

      {/* Toast */}
      <AnimatePresence>
        {toast&&(
          <motion.div initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} exit={{opacity:0,y:8}}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-5 py-3 rounded-xl text-sm font-bold flex items-center gap-2"
            style={{background:toast.ok?"rgba(15,23,42,0.98)":"rgba(127,29,29,0.98)",border:`1px solid ${toast.ok?"rgba(245,158,11,0.3)":"rgba(239,68,68,0.3)"}`,boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}>
            {toast.ok?"✅":"❌"} {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

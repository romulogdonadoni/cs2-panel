"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { SkinConfigModal, type SkinCatalogRow } from "@/components/skin-config-modal";
import { StickerKeychainModal } from "@/components/sticker-keychain-modal";
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
  "motorcycle_gloves":5035, "specialist_gloves":5031,
  "driver_gloves":5033, "hydra_gloves":5034,
  "brokenfang_gloves":5033, "bloodhound_gloves":5033,
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
  {id:"all",label:"Tudo",icon:"◈"},{id:"knife",label:"Facas",icon:"🗡"},
  {id:"gloves",label:"Luvas",icon:"🧤"},{id:"agents",label:"Agentes",icon:"🧑"},
  {id:"rifle",label:"Rifles",icon:"🎯"},{id:"sniper",label:"Sniper",icon:"🔭"},
  {id:"pistol",label:"Pistolas",icon:"🔫"},{id:"smg",label:"SMG",icon:"⚡"},
  {id:"shotgun",label:"Shotgun",icon:"💥"},{id:"heavy",label:"Pesado",icon:"🛡"},
];

type Agent = { id:string; name:string; image:string; def_index:string; model_player:string|null; team:{id:string;name:string}; rarity:{name:string;color:string}; };

type Skin = SkinCatalogRow & { paint_index:string; weapon:{id:string;name:string;weapon_id?:number}; rarity:{name:string;color:string}; };
type Saved = { weapon_defindex:number; weapon_paint_id:number; weapon_wear:number; weapon_stattrak:0|1; weapon_team:0 | 2 | 3; };

const key = (def:number, paint:number) => `${def}:${paint}`;

export default function SkinsPage() {
  const [skins,setSkins]         = useState<Skin[]>([]);
  const [total,setTotal]         = useState(0);
  const [cat,setCat]             = useState("all");
  const [team,setTeam]           = useState<"all"|"ct"|"t">("all");
  const [query,setQuery]         = useState("");
  const [offset,setOffset]       = useState(0);
  const [loading,setLoading]     = useState(false);
  const [busyKey,setBusyKey]     = useState<string|null>(null);
  const [saved,setSaved]         = useState<Record<string,Saved>>({});
  const [activeByDef,setActive]  = useState<Record<number,number>>({});
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
  const timer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const LIMIT = 5000;

  useEffect(()=>{
    fetch("/api/skins").then(r=>r.json()).then(d=>{
      if(!d.skins) return;
      const m:Record<string,Saved>={}, bd:Record<number,number>={};
      for(const s of d.skins as Saved[]){ m[key(s.weapon_defindex,s.weapon_paint_id)]=s; bd[s.weapon_defindex]=s.weapon_paint_id; }
      setSaved(m); setActive(bd);
      // Carrega agentes salvos
      if(d.agents){ /* agentCt/T são def_index como string */ }
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
    try{
      const body = side==="ct" ? {agent_ct:modelPath} : {agent_t:modelPath};
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

  const fetch_ = useCallback(async(f:string,q:string,off:number)=>{
    if(f==="agents"){ fetchAgents(q,off); return; }
    setLoading(true);
    try{
      const p=new URLSearchParams({filter:f,q,offset:String(off),limit:String(LIMIT)});
      const d=await fetch(`/api/catalog/skins?${p}`).then(r=>r.json());
      off===0?setSkins(d.items??[]):setSkins(prev=>[...prev,...(d.items??[])]);
      setTotal(d.total??0);
    }finally{setLoading(false);}
  },[fetchAgents]);

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
      setSaved(p=>{const n={...p};const old=activeByDef[def];if(old!==undefined&&old!==paint)delete n[key(def,old)];n[k]=ns;return n;});
      setActive(p=>({...p,[def]:paint}));
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
      setActive(p=>{const n={...p};delete n[def];return n;});
      showToast("Skin removida",true);
    }catch{showToast("Falha",false);}
    finally{setBusyKey(null);}
  };

  const showToast=(msg:string,ok:boolean)=>{ setToast({msg,ok}); setTimeout(()=>setToast(null),4000); };

  const savedList = Object.values(saved);

  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40" style={{background:"rgba(2,6,23,0.95)",backdropFilter:"blur(12px)",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
        <div className="max-w-[1700px] mx-auto px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-black italic tracking-tight">MINHA <span className="text-amber-400">LOADOUT</span></h1>
            <p className="text-[10px] text-slate-500">Salve skins e use <code className="text-amber-400">!wp</code> + <code className="text-amber-400">!kill</code> no jogo</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Team filter */}
            <div className="flex rounded-lg overflow-hidden" style={{border:"1px solid rgba(255,255,255,0.08)"}}>
              {(["all","ct","t"] as const).map(t=>(
                <button key={t} onClick={()=>setTeam(t)}
                  className="px-3 py-1.5 text-xs font-bold uppercase transition-all"
                  style={{background:team===t?(t==="ct"?"#3b82f6":t==="t"?"#f59e0b":"rgba(255,255,255,0.1)"):"transparent",color:team===t?"#fff":"rgba(255,255,255,0.4)"}}>
                  {t==="all"?"ALL":t.toUpperCase()}
                </button>
              ))}
            </div>
            {/* Search */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔍</span>
              <input type="text" placeholder="Buscar…" value={query} onChange={e=>setQuery(e.target.value)}
                className="pl-8 pr-4 py-2 rounded-xl text-sm text-white placeholder:text-slate-500 outline-none w-52"
                style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)"}} />
            </div>
          </div>
        </div>
        {/* Category tabs */}
        <div className="max-w-[1700px] mx-auto px-4 pb-2 flex gap-1.5 overflow-x-auto">
          {CATEGORIES.map(f=>(
            <button key={f.id} onClick={()=>setCat(f.id)}
              className="flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all"
              style={{background:cat===f.id?"#f59e0b":"rgba(255,255,255,0.04)",color:cat===f.id?"#1c1917":"rgba(255,255,255,0.5)",border:"1px solid",borderColor:cat===f.id?"transparent":"rgba(255,255,255,0.06)"}}>
              {f.icon} {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main layout ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 max-w-[1700px] mx-auto w-full px-4 py-4 gap-4">

        {/* ── Loadout sidebar ──────────────────────────────────────────────────── */}
        <div className="hidden lg:flex flex-col w-56 shrink-0 gap-2">
          <div className="sticky top-28">
            <p className="text-[10px] font-black text-amber-400 uppercase tracking-[0.15em] mb-2">LOADOUT ATUAL</p>
            {savedList.length===0?(
              <div className="rounded-xl p-4 text-center" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)"}}>
                <p className="text-xs text-slate-500">Nenhuma skin configurada</p>
              </div>
            ):(
              <div className="space-y-1.5">
                {savedList.map(s=>{
                  const skin=skins.find(sk=>getDefindex(sk)===s.weapon_defindex&&parseInt(sk.paint_index??"0",10)===s.weapon_paint_id);
                  const label=skin?skin.name:`Defindex ${s.weapon_defindex}`;
                  const weapLabel=skin?skin.weapon.name:(KNIVES.has(s.weapon_defindex)?"Faca":GLOVES.has(s.weapon_defindex)?"Luva":"Arma");
                  return (
                    <div key={key(s.weapon_defindex,s.weapon_paint_id)}
                      className="group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all hover:bg-white/5"
                      style={{border:"1px solid rgba(255,255,255,0.06)"}}>
                      {skin?.image&&<Image src={skin.image} alt={label} width={36} height={24} className="object-contain shrink-0" unoptimized/>}
                      <div className="flex-1 min-w-0">
                        <p className="text-[8px] text-slate-500 uppercase font-bold truncate">{weapLabel}</p>
                        <p className="text-[10px] text-white font-bold truncate">{label}</p>
                        <p className="text-[8px] text-slate-600">{s.weapon_wear.toFixed(3)}{s.weapon_stattrak?" • ST":""}</p>
                      </div>
                      <button onClick={()=>handleRemove(s.weapon_defindex,s.weapon_paint_id)}
                        className="opacity-0 group-hover:opacity-100 w-4 h-4 rounded-full bg-red-500/70 text-white text-[8px] flex items-center justify-center shrink-0">✕</button>
                    </div>
                  );
                })}
                <div className="mt-3 p-2 rounded-lg text-center" style={{background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)"}}>
                  <p className="text-[9px] text-amber-400 font-bold">Digite no chat:</p>
                  <p className="text-xs text-amber-300 font-black mt-0.5">!wp  →  !kill</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Skin browser ─────────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {/* Stats */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-slate-500">
              {total>0?<>{visibleSkins.length} de <span className="text-white font-bold">{total}</span> skins</>:loading?"Carregando…":"Nenhuma skin"}
            </p>
            <p className="text-xs text-slate-500">
              <span className="text-amber-400 font-bold">{savedList.length}</span> configuradas
            </p>
          </div>

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
                          <Image src={ag.image} alt={ag.name} width={40} height={40} className="object-contain rounded" unoptimized/>
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
                        <div className="aspect-square bg-gradient-to-b from-slate-800/40 to-slate-900/20 flex items-center justify-center overflow-hidden">
                          {agent.image?<Image src={agent.image} alt={agent.name} width={120} height={120}
                            className="object-contain w-full h-full group-hover:scale-105 transition-transform duration-300" unoptimized/>
                            :<div className="text-slate-600 text-2xl">👤</div>}
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

          {/* Grouped sections */}
          {cat!=="agents"&&groupNames.length>0&&!loading&&(
            <div className="space-y-6">
              {groupNames.map((gname, idx)=>{
                const gskins=groups[gname]!;
                const isOpen=collapsed[gname] !== undefined ? collapsed[gname] : (idx === 0);
                return (
                  <div key={gname}>
                    {/* Group header */}
                    <button className="w-full flex items-center gap-3 mb-3 group"
                      onClick={()=>setCollapsed(p=>({...p,[gname]:!isOpen}))}>
                      <span className="text-sm font-black text-white">{gname}</span>
                      <span className="text-[10px] text-slate-500 font-bold">({gskins.length})</span>
                      <div className="flex-1 h-px" style={{background:"linear-gradient(90deg,rgba(255,255,255,0.08),transparent)"}}/>
                      <span className="text-slate-500 text-xs transition-transform" style={{transform:isOpen?"":"rotate(-90deg)"}}>▾</span>
                    </button>

                    {isOpen&&(
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
                        <AnimatePresence mode="popLayout">
                          {gskins.map((skin,i)=>{
                            const def=getDefindex(skin);
                            const paint=parseInt(skin.paint_index??"0",10);
                            const k=key(def,paint);
                            const isSaved=activeByDef[def]===paint;
                            const isBusy=busyKey===k;
                            const rc=rarityColor(skin);
                            return (
                              <motion.div key={k} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,scale:0.95}}
                                transition={{duration:0.12,delay:Math.min(i*0.01,0.2)}}>
                                <div
                                  className="group relative rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
                                  style={{background:"rgba(15,23,42,0.8)",border:`1px solid ${isSaved?`${rc}55`:"rgba(255,255,255,0.06)"}`,boxShadow:isSaved?`0 0 16px ${rc}22`:undefined}}
                                  onClick={()=>setSelected(skin)}>
                                  <div className="absolute top-0 inset-x-0 h-[2px]" style={{background:`linear-gradient(90deg,${rc}00,${rc},${rc}00)`}}/>
                                  {isSaved&&<div className="absolute top-1.5 right-1.5 z-10 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center"><span className="text-[7px] text-slate-900 font-black">✓</span></div>}
                                  <div className="aspect-[4/3] p-2 flex items-center justify-center" style={{background:"linear-gradient(180deg,rgba(30,41,59,0.4),transparent)"}}>
                                    {skin.image?<Image src={skin.image} alt={skin.name} width={120} height={80}
                                      className="object-contain w-full h-full group-hover:scale-105 transition-transform duration-300" unoptimized/>
                                      :<div className="text-slate-600 text-xl">?</div>}
                                  </div>
                                  <div className="p-2">
                                    <p className="text-[10px] font-bold text-white truncate leading-tight">{skin.name.replace(/^.*\|\s*/,"")}</p>
                                    <div className="flex items-center gap-1 mt-1">
                                      <span className="text-[7px] font-bold px-1 py-0.5 rounded uppercase" style={{color:rc,background:`${rc}18`}}>{skin.rarity?.name?.split(" ").pop()}</span>
                                      {skin.stattrak&&<span className="text-[7px] font-bold text-orange-400 bg-orange-400/10 px-1 py-0.5 rounded">ST</span>}
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

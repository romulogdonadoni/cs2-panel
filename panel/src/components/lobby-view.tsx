"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Avatar, Select, ListBox, Label } from "@heroui/react";
import { motion } from "framer-motion";
import type { ScoreboardPlayer, ScoreboardSnapshot } from "@/lib/scoreboard-types";
import type { BroadcastGetResponse } from "@/lib/broadcast-types";
import type { FaceitCs2Public } from "@/lib/faceit";

const MAPS = [
  { id: "de_mirage", name: "Mirage" },
  { id: "de_dust2", name: "Dust II" },
  { id: "de_inferno", name: "Inferno" },
  { id: "de_nuke", name: "Nuke" },
  { id: "de_overpass", name: "Overpass" },
  { id: "de_vertigo", name: "Vertigo" },
  { id: "de_ancient", name: "Ancient" },
  { id: "de_anubis", name: "Anubis" },
] as const;

const MODES = [
  { id: "competitive", label: "Competitivo" },
  { id: "casual", label: "Casual" },
  { id: "wingman", label: "Wingman" },
  { id: "deathmatch", label: "Deathmatch" },
];

const REGIONS: Record<string, string> = {
  sao_paulo: "São Paulo",
  miami: "Miami",
  europe: "Europa (Frankfurt)",
  custom: "Outro",
};

type Member = { steamid64: string; team: number; isReady: boolean; isLeader: boolean; name?: string; avatar?: string };

type Lobby = {
  code: string;
  leaderSteamid64: string;
  team1Name: string;
  team2Name: string;
  mapId: string;
  gameMode: string;
  region: string;
  maxPerTeam: number;
  status: string;
  members: Member[];
  settings: Record<string, unknown>;
};

type Props = {
  code: string;
  me: { steamid64: string } | null;
  onExit?: () => void;
};

/** Thumbnails oficiais (não workshop). https://github.com/MurkyYT/cs2-map-icons/tree/main/images/thumbs */
const CS2_STOCK_MAP_THUMBS_BASE =
  "https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/thumbs";

function formatWorkshopFileSize(bytes: number): string | null {
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes < 1024 * 1024) return `~${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `~${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Arquivos: `{mapa}_png.png` (ex. de_mirage → de_mirage_png.png) */
function stockMapImageUrl(mapId: string | undefined): string | null {
  if (!mapId || /^\d+$/.test(mapId)) return null;
  return `${CS2_STOCK_MAP_THUMBS_BASE}/${mapId}_png.png`;
}

export function LobbyView({ code, me, onExit }: Props) {
  const [data, setData] = useState<{ lobby: Lobby; baseUrl: string } | null>(null);
  const [connectCmd, setConnectCmd] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  type WorkshopInfo = {
    title: string;
    preview_url: string;
    file_size: number;
    assessment: { level: "ok" | "warn" | "bad"; messages: string[] };
  };
  const [workshopInfo, setWorkshopInfo] = useState<WorkshopInfo | null>(null);
  const [workshopLoading, setWorkshopLoading] = useState(false);
  const [workshopFetchError, setWorkshopFetchError] = useState<string | null>(null);
  const [boardView, setBoardView] = useState<ScoreboardSnapshot | null>(null);
  const [faceitBySteam, setFaceitBySteam] = useState<Record<string, FaceitCs2Public | null> | null>(null);
  const [faceitAvailable, setFaceitAvailable] = useState(false);

  const refresh = useCallback(async () => {
    if (!code) return;
    try {
      const r = await fetch("/api/lobbies/" + encodeURIComponent(code));
      if (r.status === 404) {
        setErr("Lobby não encontrada.");
        return;
      }
      const j = await r.json();
      setData(j);

      if (j.lobby.status === "live") {
        const rs = await fetch(`/api/lobbies/${code}/start`);
        const js = await rs.json();
        if (js.connectCmd) {
          setConnectCmd(js.connectCmd);
        }
      } else {
        setConnectCmd(null);
      }
    } catch (e) {
      setErr("Erro ao conectar ao servidor.");
    }
  }, [code]);

  useEffect(() => {
    const t = setInterval(() => void refresh(), 2000);
    void refresh();
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (data?.lobby?.status !== "live") {
      setBoardView(null);
      return;
    }
    let cancelled = false;
    const pollBoard = async () => {
      try {
        const r = await fetch("/api/broadcast", { cache: "no-store" });
        const j = (await r.json()) as BroadcastGetResponse;
        if (cancelled) return;
        if (j.hasData && j.view) {
          setBoardView(j.view);
        } else {
          setBoardView(null);
        }
      } catch {
        if (!cancelled) setBoardView(null);
      }
    };
    void pollBoard();
    const id = setInterval(() => void pollBoard(), 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [data?.lobby?.status]);

  const memberSteamKey =
    data?.lobby?.members
      .map((m) => m.steamid64)
      .sort()
      .join(",") ?? "";

  useEffect(() => {
    if (!code) return;
    if (!data?.lobby) {
      setFaceitBySteam(null);
      setFaceitAvailable(false);
      return;
    }
    let cancelled = false;
    setFaceitBySteam(null);
    (async () => {
      const r = await fetch(`/api/lobbies/${encodeURIComponent(code)}/faceit`, { cache: "no-store" });
      if (!r.ok || cancelled) return;
      const j = (await r.json()) as {
        available?: boolean;
        faceit?: Record<string, FaceitCs2Public | null>;
      };
      if (cancelled) return;
      setFaceitAvailable(!!j.available);
      setFaceitBySteam(j.faceit ?? {});
    })();
    return () => {
      cancelled = true;
    };
  }, [code, memberSteamKey]);

  const lobby = data?.lobby;

  const workshopFetchRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!lobby?.mapId || !/^\d+$/.test(lobby.mapId)) {
      workshopFetchRef.current?.abort();
      setWorkshopInfo(null);
      setWorkshopFetchError(null);
      setWorkshopLoading(false);
      return;
    }
    workshopFetchRef.current?.abort();
    const ac = new AbortController();
    workshopFetchRef.current = ac;
    setWorkshopLoading(true);
    setWorkshopFetchError(null);
    const id = lobby.mapId;
    const t = setTimeout(() => {
      void (async () => {
        try {
          const r = await fetch(`/api/workshop/${id}`, { signal: ac.signal });
          const j = (await r.json()) as {
            error?: string;
            title?: string;
            preview_url?: string;
            file_size?: number;
            assessment?: { level: "ok" | "warn" | "bad"; messages: string[] };
          };
          if (!r.ok) {
            setWorkshopInfo(
              j.assessment
                ? {
                    title: j.title || `Workshop ${id}`,
                    preview_url: "",
                    file_size: Number(j.file_size) || 0,
                    assessment: j.assessment,
                  }
                : null
            );
            setWorkshopFetchError(j.error || "Falha ao verificar o workshop");
            return;
          }
          setWorkshopInfo({
            title: j.title || `ID ${id}`,
            preview_url: j.preview_url || "",
            file_size: Number(j.file_size) || 0,
            assessment: j.assessment || { level: "ok" as const, messages: [] },
          });
        } catch (e) {
          if (e instanceof Error && e.name === "AbortError") return;
          setWorkshopInfo(null);
          setWorkshopFetchError("Não foi possível acessar o painel");
        } finally {
          if (!ac.signal.aborted) {
            setWorkshopLoading(false);
          }
        }
      })();
    }, 450);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [lobby?.mapId]);
  const isLeader = me && lobby && me.steamid64 === lobby.leaderSteamid64;
  const self = lobby && me ? lobby.members.find((m) => m.steamid64 === me.steamid64) : undefined;

  async function joinTeam(team: number) {
    await fetch(`/api/lobbies/${code}/me`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team }),
    });
    void refresh();
  }

  const setMyReady = useCallback(
    async (ready: boolean) => {
      await fetch(`/api/lobbies/${code}/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isReady: ready }),
      });
      void refresh();
    },
    [code, refresh]
  );

  async function updateSetting(updates: object) {
    await fetch(`/api/lobbies/${code}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    void refresh();
  }

  async function startMatch() {
    setStarting(true);
    setErr(null);
    try {
      const r = await fetch(`/api/lobbies/${code}/start`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) {
        setErr(j.error || "Erro ao iniciar");
      } else if (j.connectCmd) {
        setConnectCmd(j.connectCmd);
      }
      void refresh();
    } finally {
      setStarting(false);
    }
  }

  async function cancelPartida() {
    if (!isLeader) return;
    if (!window.confirm("Cancelar a partida? O servidor volta ao estado de espera.")) {
      return;
    }
    setCancelling(true);
    setErr(null);
    try {
      const r = await fetch(`/api/lobbies/${code}/cancel`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) {
        setErr(j.error || "Falha ao cancelar");
      } else {
        setConnectCmd(null);
      }
      void refresh();
    } finally {
      setCancelling(false);
    }
  }

  if (!lobby) return <div className="p-8 text-center text-slate-500">Carregando lobby…</div>;

  const m1 = lobby.members.filter((m) => m.team === 1);
  const m2 = lobby.members.filter((m) => m.team === 2);
  const specs = lobby.members.filter((m) => m.team === 3);

  const playing = lobby.members.filter(m => m.team === 1 || m.team === 2);
  const allReady = playing.length > 0 && playing.every(m => m.isReady);
  const usesWorkshop = /^\d+$/.test(lobby.mapId);
  const workshopBlockStart =
    usesWorkshop &&
    (workshopLoading ||
      (workshopFetchError && !workshopInfo) ||
      (workshopInfo?.assessment.level === "bad"));

  const mapStatusLabel = (() => {
    if (/^\d+$/.test(lobby.mapId)) {
      const t = workshopInfo?.title || "";
      if (t.length > 40) return `${t.slice(0, 40)}…`;
      return t || `Workshop ${lobby.mapId}`;
    }
    return MAPS.find((m) => m.id === lobby.mapId)?.name || lobby.mapId;
  })();

  const mapBackgroundUrl = workshopInfo?.preview_url || stockMapImageUrl(lobby.mapId) || "/bg-cs2.png";

  const renderMember = (p: Member | undefined, team: 1 | 2) => {
    const isCtSide = team === 1;
    const borderAccent = isCtSide
      ? "border-sky-500/35 hover:border-sky-400/50"
      : "border-rose-500/40 hover:border-rose-400/55";
    const ringAccent = isCtSide ? "ring-sky-500/25" : "ring-rose-500/25";
    const isMe = !!(p && me && p.steamid64 === me.steamid64);
    if (!p) {
      return (
        <div
          className={`flex min-h-[3.25rem] items-center justify-center rounded-xl border-2 border-dashed px-3 py-2 text-center ${borderAccent} border-opacity-50 bg-white/[0.02]`}
        >
          <p className="text-[10px] font-bold italic text-slate-600">Esperando jogador…</p>
        </div>
      );
    }
    return (
      <div
        className={`flex items-center gap-2 rounded-xl border-2 p-2.5 pr-1.5 transition-all ${borderAccent} border-solid bg-gradient-to-r ${
          isCtSide
            ? "from-sky-500/[0.08] to-transparent to-60%"
            : "from-rose-500/[0.1] to-transparent to-60%"
        } `}
      >
        <Avatar size="sm" className={`shrink-0 ${ringAccent} ring-2`}>
          {p.avatar ? <Avatar.Image src={p.avatar} /> : null}
          <Avatar.Fallback className="text-[10px] font-bold text-slate-200">{p.name?.[0] ?? "?"}</Avatar.Fallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-xs font-bold text-slate-100">
            <span className="truncate">{p.name || "Jogador"}</span>
            {p.isLeader && <span className="shrink-0 text-[10px] text-amber-400">👑</span>}
          </p>
          <p className="text-[9px] tabular-nums text-slate-500">…{p.steamid64.slice(-6)}</p>
          {faceitAvailable && (() => {
            const f = faceitBySteam?.[p.steamid64];
            return (
            <p className="mt-0.5 min-h-[12px]">
              {faceitBySteam === null ? (
                <span className="text-[8px] text-slate-600" aria-hidden>
                  ···
                </span>
              ) : f ? (
                <a
                  href={f.faceitUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-[8px] font-bold tabular-nums text-[#ff5500] hover:underline"
                  title="Perfil FACEIT"
                >
                  Lv{f.skillLevel} · {f.elo}
                </a>
              ) : (
                <span className="text-[8px] text-slate-600" title="Sem perfil FACEIT CS2 ligado a esta Steam">
                  —
                </span>
              )}
            </p>
            );
          })()}
        </div>
        {isMe ? (
          <button
            type="button"
            onClick={() => void setMyReady(!p.isReady)}
            className={`shrink-0 rounded-lg border-2 px-2.5 py-1.5 text-[9px] font-black uppercase transition ${
              p.isReady
                ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                : "border-white/20 bg-white/[0.06] text-slate-200 hover:border-amber-500/50 hover:text-white"
            }`}
          >
            {p.isReady ? "PRONTO" : "PRONTO?"}
          </button>
        ) : p.isReady ? (
          <span
            className="mr-1 shrink-0 h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
            title="Pronto"
          />
        ) : (
          <span className="mr-1 shrink-0 h-2.5 w-2.5 rounded-full bg-slate-600" title="Aguardando" />
        )}
      </div>
    );
  };

  const boardCt = boardView?.players.filter((p) => p.team === "CT") ?? [];
  const boardT = boardView?.players.filter((p) => p.team === "T") ?? [];
  const boardSpec = boardView?.players.filter((p) => p.team === "SPEC") ?? [];
  const boardRounds = Math.max(1, boardView?.roundsPlayed ?? 1);
  const boardAdr = (p: ScoreboardPlayer) => Math.round(p.damage / boardRounds);
  /** MatchZy: `t1:steamid` / `t2:steamid`; steamid64 cru se existir. */
  const steamidFromPlayerKey = (key: string) => {
    const i = key.indexOf(":");
    return i >= 0 ? key.slice(i + 1) : key;
  };
  const memberByBoardKey = (key: string) =>
    lobby?.members.find((m) => m.steamid64 === steamidFromPlayerKey(key));
  const memberAvatar = (key: string) => memberByBoardKey(key)?.avatar;

  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        style={{ backfaceVisibility: "hidden" }}
        aria-hidden
      >
        <div
          className="absolute inset-[-6%] bg-cover bg-center blur-3xl will-change-transform [transform:translateZ(0)]"
          style={{ backgroundImage: `url(${mapBackgroundUrl})` }}
        />
        <div className="absolute inset-0 bg-slate-950/82" />
      </div>
      <div className="relative z-10 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white italic tracking-tighter">SALA DO SERVIDOR</h2>
          <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-semibold leading-relaxed text-slate-200">
            <span className="text-amber-500" aria-hidden>
              •
            </span>
            <span className="text-slate-300">
              {lobby.status === "live" ? "Partida em andamento" : "Nenhuma partida ativa ainda"}
            </span>
            <span className="text-slate-600" aria-hidden>
              •
            </span>
            <span className="max-w-[14rem] truncate text-amber-100/90 sm:max-w-xl" title={mapStatusLabel}>
              {mapStatusLabel}
            </span>
            <span className="text-slate-600" aria-hidden>
              •
            </span>
            <span className="text-slate-300">{MODES.find((m) => m.id === lobby.gameMode)?.label || "—"}</span>
            <span className="text-slate-600" aria-hidden>
              •
            </span>
            <span className="text-slate-400 tabular-nums">{playing.length} jog.</span>
          </p>
        </div>
        {onExit && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="font-bold border-white/10 text-slate-400" onPress={onExit}>
              SAIR
            </Button>
          </div>
        )}
      </header>

      {lobby.status === "live" && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass bg-accent-blue/10 border-accent-blue/30 p-6 rounded-2xl flex flex-col items-center gap-4 text-center shadow-[0_0_40px_rgba(59,130,246,0.15)]"
        >
          <div className="h-12 w-12 rounded-full bg-accent-blue flex items-center justify-center text-white text-xl animate-pulse">📡</div>
          <div>
            <h3 className="text-lg font-black text-white italic">PARTIDA EM CURSO</h3>
            <p className="text-xs text-slate-400 font-medium">Copie o comando abaixo e cole no console do CS2</p>
          </div>
          <div className="w-full max-w-md flex gap-2">
            <div className="flex-1 glass bg-black/40 border-white/5 rounded-lg px-4 py-2 text-xs font-mono text-accent-blue flex items-center overflow-x-auto whitespace-nowrap">
              {connectCmd || "… obtendo endereço …"}
            </div>
            <Button 
              size="sm" 
              variant="primary" 
              isDisabled={!connectCmd}
              className="bg-accent-blue text-white font-bold"
              onPress={() => {
                if (!connectCmd) return;
                navigator.clipboard.writeText(connectCmd);
                alert("Copiado!");
              }}
            >
              COPIAR
            </Button>
          </div>
          {isLeader && (
            <div className="w-full max-w-lg space-y-2">
              <Button
                variant="outline"
                fullWidth
                isDisabled={cancelling}
                className="font-black border-rose-500/50 text-rose-400/90 hover:bg-rose-500/10"
                onPress={() => void cancelPartida()}
              >
                {cancelling ? "CANCELANDO…" : "CANCELAR PARTIDA NO SERVIDOR"}
              </Button>
            </div>
          )}
        </motion.div>
      )}

      {lobby.status === "live" && (
        <div className="space-y-4">
          {boardView ? (
            <>
              <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-white/10 bg-white/[0.03] py-4 text-center sm:flex-row sm:gap-4">
                <div className="flex min-w-0 flex-1 flex-col items-end sm:pr-4">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-sky-300">CT</span>
                  <span className="line-clamp-1 text-xs font-bold text-slate-300">
                    {boardView.teamCt.name || lobby.team1Name}
                  </span>
                </div>
                <div className="flex items-baseline gap-2 sm:px-2">
                  <span className="text-3xl font-black tabular-nums text-sky-200 sm:text-4xl">{boardView.teamCt.score}</span>
                  <span className="text-lg font-black text-slate-600" aria-hidden>
                    —
                  </span>
                  <span className="text-3xl font-black tabular-nums text-rose-200 sm:text-4xl">{boardView.teamT.score}</span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col items-start sm:pl-4">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-rose-300">T</span>
                  <span className="line-clamp-1 text-xs font-bold text-slate-300">
                    {boardView.teamT.name || lobby.team2Name}
                  </span>
                </div>
              </div>
              <p className="text-center text-[10px] font-semibold text-slate-500">
                <span className="mr-1.5 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[8px] font-black uppercase text-slate-400">
                  MatchZy
                </span>
                {boardView.mapName !== "—" && <span className="text-slate-400">{boardView.mapName}</span>}
                {boardView.mapName !== "—" && " · "}
                {boardView.round > 0 && <span className="tabular-nums">Rodada {boardView.round}</span>}
                {boardView.round > 0 && " · "}
                <span>{boardView.phase !== "—" ? boardView.phase : "—"}</span>
              </p>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <section className="space-y-2 rounded-2xl border border-sky-500/30 bg-sky-500/[0.04] p-3">
                  <div className="grid grid-cols-[1fr_minmax(0,2.5rem)_minmax(0,2.5rem)_minmax(0,2.5rem)_minmax(0,2.5rem)] gap-1 border-b border-sky-500/20 px-1 pb-2 text-[8px] font-black uppercase tracking-tighter text-sky-200/80">
                    <span>Jogador</span>
                    <span className="text-right">K</span>
                    <span className="text-right">A</span>
                    <span className="text-right">D</span>
                    <span className="text-right">ADR</span>
                  </div>
                  <div className="space-y-1.5">
                    {boardCt.map((p) => {
                      const av = memberAvatar(p.key);
                      const m = memberByBoardKey(p.key);
                      return (
                        <div
                          key={p.key}
                          className="grid grid-cols-[1fr_minmax(0,2.5rem)_minmax(0,2.5rem)_minmax(0,2.5rem)_minmax(0,2.5rem)] items-center gap-1 rounded-lg border border-sky-500/20 bg-sky-500/[0.06] px-1.5 py-1.5"
                        >
                          <div className="flex min-w-0 items-center gap-1.5">
                            <Avatar size="sm" className="h-6 w-6 shrink-0 ring-1 ring-sky-500/30">
                              {av ? <Avatar.Image src={av} /> : null}
                              <Avatar.Fallback className="text-[9px] font-bold">{p.name?.[0] ?? "?"}</Avatar.Fallback>
                            </Avatar>
                            <span className="truncate text-[10px] font-bold text-slate-100" title={p.name}>
                              {m?.name && m.name.length > 0 ? m.name : p.name}
                            </span>
                          </div>
                          <span className="text-right text-[10px] font-mono font-bold tabular-nums text-slate-200">{p.kills}</span>
                          <span className="text-right text-[10px] font-mono font-bold tabular-nums text-slate-200">{p.assists}</span>
                          <span className="text-right text-[10px] font-mono font-bold tabular-nums text-slate-200">{p.deaths}</span>
                          <span className="text-right text-[10px] font-mono font-bold tabular-nums text-slate-200">{boardAdr(p)}</span>
                        </div>
                      );
                    })}
                    {boardCt.length === 0 && (
                      <p className="py-3 text-center text-[10px] font-semibold text-slate-500">Nenhum jogador CT no estado atual.</p>
                    )}
                  </div>
                </section>
                <section className="space-y-2 rounded-2xl border border-rose-500/30 bg-rose-500/[0.05] p-3">
                  <div className="grid grid-cols-[1fr_minmax(0,2.5rem)_minmax(0,2.5rem)_minmax(0,2.5rem)_minmax(0,2.5rem)] gap-1 border-b border-rose-500/20 px-1 pb-2 text-[8px] font-black uppercase tracking-tighter text-rose-200/80">
                    <span>Jogador</span>
                    <span className="text-right">K</span>
                    <span className="text-right">A</span>
                    <span className="text-right">D</span>
                    <span className="text-right">ADR</span>
                  </div>
                  <div className="space-y-1.5">
                    {boardT.map((p) => {
                      const av = memberAvatar(p.key);
                      const m = memberByBoardKey(p.key);
                      return (
                        <div
                          key={p.key}
                          className="grid grid-cols-[1fr_minmax(0,2.5rem)_minmax(0,2.5rem)_minmax(0,2.5rem)_minmax(0,2.5rem)] items-center gap-1 rounded-lg border border-rose-500/20 bg-rose-500/[0.08] px-1.5 py-1.5"
                        >
                          <div className="flex min-w-0 items-center gap-1.5">
                            <Avatar size="sm" className="h-6 w-6 shrink-0 ring-1 ring-rose-500/30">
                              {av ? <Avatar.Image src={av} /> : null}
                              <Avatar.Fallback className="text-[9px] font-bold">{p.name?.[0] ?? "?"}</Avatar.Fallback>
                            </Avatar>
                            <span className="truncate text-[10px] font-bold text-slate-100" title={p.name}>
                              {m?.name && m.name.length > 0 ? m.name : p.name}
                            </span>
                          </div>
                          <span className="text-right text-[10px] font-mono font-bold tabular-nums text-slate-200">{p.kills}</span>
                          <span className="text-right text-[10px] font-mono font-bold tabular-nums text-slate-200">{p.assists}</span>
                          <span className="text-right text-[10px] font-mono font-bold tabular-nums text-slate-200">{p.deaths}</span>
                          <span className="text-right text-[10px] font-mono font-bold tabular-nums text-slate-200">{boardAdr(p)}</span>
                        </div>
                      );
                    })}
                    {boardT.length === 0 && (
                      <p className="py-3 text-center text-[10px] font-semibold text-slate-500">Nenhum jogador T no estado atual.</p>
                    )}
                  </div>
                </section>
              </div>
              {boardSpec.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-500">Espectadores (servidor)</h4>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {boardSpec.map((p) => (
                      <span key={p.key} className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-semibold text-slate-300">
                        {p.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 text-center">
              <p className="text-sm font-bold text-amber-100/90">Aguardando placar (MatchZy)</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Cada fim de rodada o MatchZy manda um POST pro painel. No{" "}
                <code className="rounded bg-black/30 px-1 text-[10px]">config.cfg</code> do MatchZy (no <strong className="text-slate-300">servidor de jogo</strong>), a variável{" "}
                <code className="rounded bg-black/30 px-1 text-[10px]">matchzy_remote_log_url</code> precisa ser uma URL que o{" "}
                <strong className="text-slate-300">próprio servidor</strong> consiga abrir — não a do seu PC. Se o painel e o CS2 estão
                juntos (Docker com host, mesma máquina), use algo como{" "}
                <code className="break-all rounded bg-black/30 px-1 text-[10px]">
                  http://127.0.0.1:3080/api/webhooks/matchzy-events
                </code>
                . Se forem hosts diferentes, coloque a URL pública do painel (ex.: <code className="text-[10px]">http://IP:3080/...</code>) e abra
                a porta 3080. Depois de editar, rode <code className="rounded bg-black/30 px-1">exec csgo/cfg/MatchZy/config.cfg</code> no console do
                servidor. Se definir <code className="rounded bg-black/30 px-1">MATCHZY_WEBHOOK_SECRET</code> no .env, o header do MatchZy
                (ex.: <code className="text-[10px]">x-matchzy-secret</code>) tem de ser o mesmo.
              </p>
            </div>
          )}
        </div>
      )}

      {lobby.status !== "live" && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:items-start xl:gap-5">
          <section className="order-2 space-y-3 rounded-2xl border border-sky-500/30 bg-sky-500/[0.04] p-3 xl:order-1 xl:col-span-3">
            <div className="flex items-center justify-between gap-2 px-0.5">
              <h3 className="flex min-w-0 flex-1 flex-col gap-0.5 text-[10px] font-black uppercase leading-tight text-sky-200 sm:flex-row sm:items-baseline sm:gap-1.5 sm:text-xs">
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden>🛡</span>
                  <span className="italic">TIME 1</span> <span>CT</span>
                </span>
                <span className="truncate font-bold text-slate-400 not-italic normal-case">· {lobby.team1Name}</span>
              </h3>
              <span className="shrink-0 text-[10px] font-bold text-slate-500">
                {m1.length}/{lobby.maxPerTeam}
              </span>
            </div>
            <div className="space-y-2">
              {Array.from({ length: lobby.maxPerTeam }).map((_, i) => renderMember(m1[i], 1))}
            </div>
            <Button
              className="w-full min-h-10 border-2 border-dashed border-sky-400/45 bg-sky-500/10 text-[11px] font-black tracking-wide text-sky-200"
              variant="outline"
              onPress={() => joinTeam(1)}
            >
              + ENTRAR
            </Button>
          </section>

          <section className="order-1 min-w-0 space-y-2 xl:order-2 xl:col-span-4">
            <div className="group relative mx-auto w-full max-w-lg overflow-hidden rounded-2xl border-2 border-amber-500/20 bg-slate-900 aspect-video shadow-2xl">
              <img
                src={mapBackgroundUrl}
                alt={lobby.mapId}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                onError={(e) => {
                  const el = e.currentTarget;
                  el.onerror = null;
                  if (el.src.indexOf("bg-cs2") === -1) el.src = "/bg-cs2.png";
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
              <div className="absolute left-3 right-3 top-3 flex flex-wrap gap-1.5 sm:left-4 sm:right-4 sm:top-4">
                <span className="max-w-full truncate rounded-lg border border-white/10 bg-black/50 px-2 py-1 text-[9px] font-black uppercase italic tracking-tight text-white sm:text-[10px]">
                  {workshopInfo?.title || MAPS.find((m) => m.id === lobby.mapId)?.name || "Mapa"}
                </span>
                {isLeader && /^\d+$/.test(lobby.mapId) && workshopInfo && (
                  <span className="whitespace-nowrap rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[8px] font-bold text-amber-100 sm:text-[9px]">
                    ID: {lobby.mapId}
                  </span>
                )}
              </div>
              <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center gap-2 p-3 sm:p-4">
                <div className="flex w-full max-w-sm items-center justify-center gap-4 sm:gap-6">
                  <div className="text-center">
                    <p className="text-[8px] font-bold uppercase text-slate-500">Modo</p>
                    <p className="text-xs font-bold text-white">
                      {MODES.find((m) => m.id === lobby.gameMode)?.label || "Competitivo"}
                    </p>
                  </div>
                  <div className="h-6 w-px bg-white/10" />
                  <div className="text-center">
                    <p className="text-[8px] font-bold uppercase text-slate-500">Região</p>
                    <p className="line-clamp-1 text-xs font-bold text-amber-100/90">
                      {REGIONS[lobby.region] ?? "Servidor"}
                    </p>
                  </div>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[9px] font-black uppercase text-amber-200 shadow-lg">
                  {starting ? "INICIANDO…" : `ESPERANDO ${playing.length}/${lobby.maxPerTeam * 2}`}
                </div>
              </div>
            </div>
          </section>

          <section className="order-3 space-y-3 rounded-2xl border border-rose-500/30 bg-rose-500/[0.05] p-3 xl:col-span-3">
            <div className="flex items-center justify-between gap-2 px-0.5">
              <h3 className="flex min-w-0 flex-1 flex-col gap-0.5 text-[10px] font-black uppercase leading-tight text-rose-200 sm:flex-row sm:items-baseline sm:gap-1.5 sm:text-xs">
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden>⚔</span>
                  <span className="italic">TIME 2</span> <span>TR</span>
                </span>
                <span className="truncate font-bold text-slate-400 not-italic normal-case">· {lobby.team2Name}</span>
              </h3>
              <span className="shrink-0 text-[10px] font-bold text-slate-500">
                {m2.length}/{lobby.maxPerTeam}
              </span>
            </div>
            <div className="space-y-2">
              {Array.from({ length: lobby.maxPerTeam }).map((_, i) => renderMember(m2[i], 2))}
            </div>
            <Button
              className="w-full min-h-10 border-2 border-dashed border-rose-400/50 bg-rose-500/10 text-[11px] font-black tracking-wide text-rose-200"
              variant="outline"
              onPress={() => joinTeam(2)}
            >
              + ENTRAR
            </Button>
          </section>

          {/* SETTINGS & SPECS */}
          <section className="order-4 space-y-6 xl:col-span-2">
          <div className="glass-dark p-6 rounded-2xl border-white/5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-black text-accent-gold uppercase tracking-widest italic">AJUSTES DA PARTIDA</h3>
              {isLeader && (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-tight text-amber-200/95">
                  <span aria-hidden>👑</span> LÍDER
                </span>
              )}
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Mapa</Label>
                  {usesWorkshop ? (
                    <div className="mt-1 min-h-10 flex flex-col justify-center gap-0.5 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-amber-200/80">Mapa de workshop</p>
                      <p className="line-clamp-2 text-xs font-bold text-amber-50" title={workshopInfo?.title || lobby.mapId}>
                        {workshopInfo?.title || `ID ${lobby.mapId}`}
                      </p>
                    </div>
                  ) : (
                    <Select
                      selectedKey={lobby.mapId}
                      onSelectionChange={(k) => updateSetting({ mapId: String(k) })}
                      variant="primary"
                      fullWidth
                      isDisabled={!isLeader}
                      className="mt-1"
                    >
                      <Select.Trigger className="glass bg-white/5 border-white/10 h-10">
                        <Select.Value className="text-xs font-bold text-slate-200">
                          {MAPS.find((m) => m.id === lobby.mapId)?.name || "Mapa"}
                        </Select.Value>
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {MAPS.map((m) => (
                            <ListBox.Item key={m.id} id={m.id} textValue={m.name}>
                              {m.name}
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  )}
                </div>
                <div>
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Modo</Label>
                  <Select
                    selectedKey={lobby.gameMode}
                    onSelectionChange={(k) => updateSetting({ gameMode: String(k) })}
                    variant="primary"
                    fullWidth
                    isDisabled={!isLeader}
                    className="mt-1"
                  >
                    <Select.Trigger className="glass bg-white/5 border-white/10 h-10">
                      <Select.Value className="text-xs font-bold text-slate-200">
                        {MODES.find(m => m.id === lobby.gameMode)?.label || "Modo"}
                      </Select.Value>
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {MODES.map(m => <ListBox.Item key={m.id} id={m.id} textValue={m.label}>{m.label}</ListBox.Item>)}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
              </div>
              
              {/* Rodadas e Overtime */}
              <div>
                <Label className="text-[10px] font-bold text-slate-500 uppercase">Lados (CT / TR)</Label>
                <Select
                  selectedKey={(lobby.settings?.roundSides as string) || "knife"}
                  onSelectionChange={(k) =>
                    updateSetting({ settings: { roundSides: (k as string) === "random" ? "random" : "knife" } })
                  }
                  variant="primary"
                  fullWidth
                  isDisabled={!isLeader}
                  className="mt-1"
                >
                  <Select.Trigger className="glass bg-white/5 border-white/10 h-10">
                    <Select.Value className="text-xs font-bold text-slate-200">
                      {lobby.settings?.roundSides === "random" ? "Aleatório (sem faca)" : "Rodada de faca"}
                    </Select.Value>
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item key="knife" id="knife" textValue="Rodada de faca">
                        Rodada de faca
                      </ListBox.Item>
                      <ListBox.Item key="random" id="random" textValue="Aleatório (sem faca)">
                        Aleatório (sem faca)
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>
                {isLeader && (
                  <p className="text-[9px] text-slate-600 mt-1">
                    Com faca: decide quem fica em CT. Aleatório: sorteio de lados, sem ronda de faca.
                  </p>
                )}
              </div>

              <div>
                <Label className="text-[10px] font-bold text-slate-500 uppercase">MatchZy</Label>
                <Select
                  selectedKey={lobby.settings?.serverMode === "training" ? "training" : "match"}
                  onSelectionChange={(k) =>
                    updateSetting({ settings: { serverMode: (k as string) === "training" ? "training" : "match" } })
                  }
                  variant="primary"
                  fullWidth
                  isDisabled={!isLeader}
                  className="mt-1"
                >
                  <Select.Trigger className="glass bg-white/5 border-white/10 h-10">
                    <Select.Value className="text-xs font-bold text-slate-200">
                      {lobby.settings?.serverMode === "training"
                        ? "Treino (nades, prac)"
                        : "Partida (5v5, PUG)"}
                    </Select.Value>
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item key="match" id="match" textValue="Partida">
                        Partida (5v5, PUG)
                      </ListBox.Item>
                      <ListBox.Item key="training" id="training" textValue="Treino">
                        Treino (nades, prac)
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>
                {isLeader && (
                  <p className="text-[9px] text-slate-600 mt-1">
                    Treino: o servidor executa o modo prática do MatchZy (granadas, lineups) — sem carregar
                    partida PUG. Partida: fluxo normal com matchzy_loadmatch.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Rounds</Label>
                  <Select
                    selectedKey={String(lobby.settings?.rounds || 13)}
                    onSelectionChange={(k) => updateSetting({ settings: { rounds: parseInt(String(k)) } })}
                    variant="primary"
                    fullWidth
                    isDisabled={!isLeader}
                    className="mt-1"
                  >
                    <Select.Trigger className="glass bg-white/5 border-white/10 h-10">
                      <Select.Value className="text-xs font-bold text-slate-200">
                        {lobby.settings?.rounds === 16 ? "MR15 (16 Vence)" : "MR12 (13 Vence)"}
                      </Select.Value>
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item key="13" id="13" textValue="MR12">MR12 (13 Vence)</ListBox.Item>
                        <ListBox.Item key="16" id="16" textValue="MR15">MR15 (16 Vence)</ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Overtime</Label>
                  <Select
                    selectedKey={String(lobby.settings?.overtime ?? true)}
                    onSelectionChange={(k) => updateSetting({ settings: { overtime: k === "true" } })}
                    variant="primary"
                    fullWidth
                    isDisabled={!isLeader}
                    className="mt-1"
                  >
                    <Select.Trigger className="glass bg-white/5 border-white/10 h-10">
                      <Select.Value className="text-xs font-bold text-slate-200">
                        {lobby.settings?.overtime !== false ? "Ativado" : "Desativado"}
                      </Select.Value>
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item key="true" id="true" textValue="Ativado">Ativado</ListBox.Item>
                        <ListBox.Item key="false" id="false" textValue="Desativado">Desativado</ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
              </div>

              {/* Workshop Map */}
              <div>
                <Label className="text-[10px] font-bold text-slate-500 uppercase">Mapa Customizado (Workshop ID)</Label>
                <div className="relative mt-1">
                  <input
                    type="text"
                    disabled={!isLeader}
                    placeholder="Ex: 3070244462"
                    className="w-full h-10 glass bg-white/5 border border-white/10 rounded-lg px-3 text-xs font-bold text-slate-200 focus:border-accent-blue/50 outline-none transition-all placeholder:text-slate-700"
                    value={lobby.mapId.match(/^\d+$/) ? lobby.mapId : ""}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      if (v.match(/^\d*$/)) {
                        updateSetting({ mapId: v || "de_mirage" });
                      }
                    }}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <span className="text-[10px] text-slate-600 font-black tracking-tighter">WS</span>
                  </div>
                </div>
                {isLeader && (
                <p className="text-[9px] text-slate-600 mt-1">Se usares ID de workshop, ele substitui o mapa da lista.</p>
                )}
                {usesWorkshop && isLeader && (
                  <div className="mt-2 space-y-2">
                    {workshopLoading && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-amber-200/85">A consultar a Steam…</p>
                        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                          <motion.div
                            className="absolute top-0 h-full w-[32%] rounded-full bg-amber-500/85"
                            initial={{ left: "-32%" }}
                            animate={{ left: "100%" }}
                            transition={{ duration: 1.25, repeat: Infinity, ease: "linear" }}
                          />
                        </div>
                      </div>
                    )}
                    {!workshopLoading && workshopFetchError && !workshopInfo && (
                      <p className="text-[10px] text-rose-400/95 font-bold border-l-2 border-rose-500/80 pl-2">{workshopFetchError}</p>
                    )}
                    {workshopInfo && (() => {
                      const sizeLabel = formatWorkshopFileSize(workshopInfo.file_size);
                      return (
                      <div
                        className={`text-[10px] font-bold rounded-lg px-3 py-2 border ${
                          workshopInfo.assessment.level === "bad"
                            ? "border-rose-500/50 bg-rose-950/40 text-rose-200"
                            : workshopInfo.assessment.level === "warn"
                              ? "border-amber-500/50 bg-amber-950/30 text-amber-200"
                              : "border-emerald-500/35 bg-emerald-950/25 text-emerald-200/90"
                        }`}
                      >
                        <p className="uppercase tracking-tight text-[9px] opacity-90">
                          {workshopInfo.assessment.level === "bad" && "Mapa não disponível"}
                          {workshopInfo.assessment.level === "warn" && "Atenção: pode não carregar"}
                          {workshopInfo.assessment.level === "ok" && "Mapa verificado na Steam"}
                        </p>
                        {workshopInfo.assessment.messages.map((m, i) => (
                          <p key={i} className="mt-1.5 text-[10px] font-normal text-slate-200/90 leading-snug">
                            {m}
                          </p>
                        ))}
                        {workshopInfo.assessment.level !== "bad" && (
                          <div className="mt-2 border-t border-white/10 pt-2 text-[9px] font-normal leading-relaxed text-slate-300/95">
                            {sizeLabel ? (
                              <p>
                                Tamanho publicado na Steam: <strong className="text-amber-100/90">{sizeLabel}</strong>. O
                                <strong> download</strong> em si ocorre no <strong>servidor</strong> (não há % em tempo real neste site); a 1.ª carga pode
                                levar minutos. Se cair no mapa &quot;error&quot;, espera a transferência ou vê
                                <code className="mx-0.5 rounded bg-black/30 px-0.5">docker logs cs2-server</code>.
                              </p>
                            ) : (
                              <p>
                                A Steam não reportou tamanho. Na 1.ª carga o servidor descarrega o mapa; sem % aqui — usa o log de
                                <code className="mx-0.5 rounded bg-black/30 px-0.5">cs2-server</code> se precisares.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      );
                    })()}
                    {workshopBlockStart && !workshopLoading && (
                      <p className="text-[9px] text-slate-500">Corrija o ID ou troque para um mapa vanilla para iniciar.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
            {isLeader && lobby.status !== "live" && (
              <Button
                variant="primary"
                fullWidth
                className={`font-black italic tracking-widest mt-4 ${allReady && !workshopBlockStart ? "bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]" : "bg-slate-700 opacity-50"}`}
                isDisabled={!allReady || starting || workshopBlockStart}
                onPress={startMatch}
              >
                <span className="mr-1.5 text-base leading-none" aria-hidden>
                  ◎
                </span>
                {starting ? "INICIANDO…" : workshopBlockStart && usesWorkshop ? "WORKSHOP INVÁLIDO" : "INICIAR PARTIDA"}
              </Button>
            )}
          </div>

            <div className="glass bg-white/5 rounded-2xl p-4 border-white/10">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-3">Espectadores</h4>
              <div className="flex flex-wrap gap-2">
                {specs.map((s) => {
                  const fv = faceitBySteam ? faceitBySteam[s.steamid64] : null;
                  const faceitTitle =
                    faceitAvailable && fv ? ` — FACEIT Lv${fv.skillLevel} ${fv.elo}` : "";
                  return (
                  <Avatar key={s.steamid64} size="sm" title={(s.name || "") + faceitTitle} className="ring-2 ring-white/5">
                    {s.avatar ? <Avatar.Image src={s.avatar} /> : null}
                  </Avatar>
                  );
                })}
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full h-8 w-8 p-0 glass bg-white/5 border-white/10"
                  onPress={() => joinTeam(3)}
                >
                  +
                </Button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
    </>
  );
}

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

/** Ex.: `connect 1.2.3.4:27015; password abc` → steam://connect/1.2.3.4:27015/abc */
function steamConnectFromConsoleCmd(cmd: string): string | null {
  const s = cmd.trim();
  const m = s.match(/^connect\s+([^;]+?)(?:\s*;\s*password\s+(.+))?$/i);
  if (!m) return null;
  const hostPort = m[1]?.trim();
  if (!hostPort) return null;
  const pw = m[2]?.trim();
  return pw
    ? `steam://connect/${hostPort}/${encodeURIComponent(pw)}`
    : `steam://connect/${hostPort}`;
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
  const [copyLabel, setCopyLabel] = useState<"idle" | "ok" | "err">("idle");
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Mobile / tap: painel de ajustes sobre o mapa (desktop usa hover no mapa). */
  const [mapAjustesOpen, setMapAjustesOpen] = useState(false);

  useEffect(() => {
    return () => {
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
    };
  }, []);

  useEffect(() => {
    setCopyLabel("idle");
  }, [connectCmd]);

  useEffect(() => {
    if (data?.lobby?.status === "live") setMapAjustesOpen(false);
  }, [data?.lobby?.status]);

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
      : "border-amber-500/40 hover:border-amber-400/55";
    const ringAccent = isCtSide ? "ring-sky-500/25" : "ring-amber-500/25";
    const isMe = !!(p && me && p.steamid64 === me.steamid64);
    if (!p) {
      return (
        <div
          className={`flex min-h-[3.25rem] items-center justify-center rounded-xl border border-dashed px-3 py-2 text-center ${borderAccent} border-opacity-35 bg-white/[0.02]`}
        >
          <p className="text-xs font-medium italic text-slate-400">Esperando jogador…</p>
        </div>
      );
    }
    return (
      <div
        className={`flex items-center gap-2 rounded-xl border-2 p-2.5 pr-1.5 transition-all ${borderAccent} border-solid bg-gradient-to-r ${isCtSide
            ? "from-sky-500/[0.08] to-transparent to-60%"
            : "from-amber-500/[0.1] to-transparent to-60%"
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
          <p className="text-xs tabular-nums text-slate-400">…{p.steamid64.slice(-6)}</p>
          {faceitAvailable && (() => {
            const f = faceitBySteam?.[p.steamid64];
            return (
              <p className="mt-0.5 min-h-[12px]">
                {faceitBySteam === null ? (
                  <span className="text-xs text-slate-400" aria-hidden>
                    ···
                  </span>
                ) : f ? (
                  <a
                    href={f.faceitUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-xs font-bold tabular-nums text-[#ff5500] hover:underline"
                    title="Perfil FACEIT"
                  >
                    Lv{f.skillLevel} · {f.elo}
                  </a>
                ) : (
                  <span className="text-xs text-slate-400" title="Sem perfil FACEIT CS2 ligado a esta Steam">
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
            className={`shrink-0 rounded-lg border-2 px-2.5 py-1.5 text-xs font-black uppercase transition ${p.isReady
                ? "border-amber-500/60 bg-amber-500/15 text-amber-200 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                : "border-white/20 bg-white/[0.06] text-slate-200 hover:border-amber-500/50 hover:text-white"
              }`}
          >
            {p.isReady ? "PRONTO" : "PRONTO?"}
          </button>
        ) : p.isReady ? (
          <span
            className="mr-1 shrink-0 h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
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

  const MatchSettingsBody = () => (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <h3 className="text-xs font-black uppercase italic tracking-widest text-accent-gold">AJUSTES DA PARTIDA</h3>
        {isLeader && (
          <span className="ml-1 inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-black uppercase tracking-tight text-amber-200/95 sm:ml-0">
            <span aria-hidden>👑</span> LÍDER
          </span>
        )}
      </div>
      <div className="space-y-4 pt-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs font-bold uppercase text-slate-400">Mapa</Label>
            {usesWorkshop ? (
              <div className="mt-1 flex min-h-10 flex-col justify-center gap-0.5 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2">
                <p className="text-xs font-bold uppercase tracking-widest text-amber-200/80">Mapa de workshop</p>
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
                <Select.Trigger className="glass min-h-11 border-white/10 bg-white/5 py-2.5">
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
            <Label className="text-xs font-bold uppercase text-slate-400">Modo</Label>
            <Select
              selectedKey={lobby.gameMode}
              onSelectionChange={(k) => updateSetting({ gameMode: String(k) })}
              variant="primary"
              fullWidth
              isDisabled={!isLeader}
              className="mt-1"
            >
              <Select.Trigger className="glass min-h-11 border-white/10 bg-white/5 py-2.5">
                <Select.Value className="text-xs font-bold text-slate-200">
                  {MODES.find((m) => m.id === lobby.gameMode)?.label || "Modo"}
                </Select.Value>
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {MODES.map((m) => (
                    <ListBox.Item key={m.id} id={m.id} textValue={m.label}>
                      {m.label}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
        </div>

        <div>
          <Label className="text-xs font-bold uppercase text-slate-400">Lados (CT / TR)</Label>
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
            <Select.Trigger className="glass min-h-11 border-white/10 bg-white/5 py-2.5">
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
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Com faca: decide quem fica em CT. Aleatório: sorteio de lados, sem ronda de faca.
            </p>
          )}
        </div>

        <div>
          <Label className="text-xs font-bold uppercase text-slate-400">MatchZy</Label>
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
            <Select.Trigger className="glass min-h-11 border-white/10 bg-white/5 py-2.5">
              <Select.Value className="text-xs font-bold text-slate-200">
                {lobby.settings?.serverMode === "training" ? "Treino (nades, prac)" : "Partida (5v5, PUG)"}
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
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Treino: o servidor executa o modo prática do MatchZy (granadas, lineups) — sem carregar partida PUG.
              Partida: fluxo normal com matchzy_loadmatch.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-bold uppercase text-slate-400">Rounds</Label>
            <Select
              selectedKey={String(lobby.settings?.rounds || 13)}
              onSelectionChange={(k) => updateSetting({ settings: { rounds: parseInt(String(k)) } })}
              variant="primary"
              fullWidth
              isDisabled={!isLeader}
              className="mt-1"
            >
              <Select.Trigger className="glass min-h-11 border-white/10 bg-white/5 py-2.5">
                <Select.Value className="text-xs font-bold text-slate-200">
                  {lobby.settings?.rounds === 16 ? "MR15 (16 Vence)" : "MR12 (13 Vence)"}
                </Select.Value>
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item key="13" id="13" textValue="MR12">
                    MR12 (13 Vence)
                  </ListBox.Item>
                  <ListBox.Item key="16" id="16" textValue="MR15">
                    MR15 (16 Vence)
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-bold uppercase text-slate-400">Overtime</Label>
            <Select
              selectedKey={String(lobby.settings?.overtime ?? true)}
              onSelectionChange={(k) => updateSetting({ settings: { overtime: k === "true" } })}
              variant="primary"
              fullWidth
              isDisabled={!isLeader}
              className="mt-1"
            >
              <Select.Trigger className="glass min-h-11 border-white/10 bg-white/5 py-2.5">
                <Select.Value className="text-xs font-bold text-slate-200">
                  {lobby.settings?.overtime !== false ? "Ativado" : "Desativado"}
                </Select.Value>
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item key="true" id="true" textValue="Ativado">
                    Ativado
                  </ListBox.Item>
                  <ListBox.Item key="false" id="false" textValue="Desativado">
                    Desativado
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
        </div>

        <div>
          <Label className="text-xs font-bold uppercase text-slate-400">Mapa Customizado (Workshop ID)</Label>
          <div className="relative mt-1">
            <input
              type="text"
              disabled={!isLeader}
              placeholder="Ex: 3070244462"
              className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 font-mono text-xs font-bold text-slate-200 outline-none transition-all placeholder:text-slate-700 focus:border-accent-gold/50 glass"
              value={lobby.mapId.match(/^\d+$/) ? lobby.mapId : ""}
              onChange={(e) => {
                const v = e.target.value.trim();
                if (v.match(/^\d*$/)) {
                  updateSetting({ mapId: v || "de_mirage" });
                }
              }}
            />
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
              <span className="text-xs font-black tracking-tighter text-slate-400">WS</span>
            </div>
          </div>
          {isLeader && (
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Se usares ID de workshop, ele substitui o mapa da lista.
            </p>
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
                <p className="border-l-2 border-amber-500/80 pl-2 text-[10px] font-bold text-amber-400/95">{workshopFetchError}</p>
              )}
              {workshopInfo && (() => {
                const sizeLabel = formatWorkshopFileSize(workshopInfo.file_size);
                return (
                  <div
                    className={`rounded-lg border px-3 py-2 text-[10px] font-bold ${
                      workshopInfo.assessment.level === "bad"
                        ? "border-amber-500/50 bg-amber-950/40 text-amber-200"
                        : workshopInfo.assessment.level === "warn"
                          ? "border-amber-500/50 bg-amber-950/30 text-amber-200"
                          : "border-amber-500/35 bg-amber-950/25 text-amber-200/90"
                    }`}
                  >
                    <p className="text-xs uppercase tracking-tight opacity-90">
                      {workshopInfo.assessment.level === "bad" && "Mapa não disponível"}
                      {workshopInfo.assessment.level === "warn" && "Atenção: pode não carregar"}
                      {workshopInfo.assessment.level === "ok" && "Mapa verificado na Steam"}
                    </p>
                    {workshopInfo.assessment.messages.map((msg, i) => (
                      <p key={i} className="mt-1.5 text-[10px] font-normal leading-snug text-slate-200/90">
                        {msg}
                      </p>
                    ))}
                    {workshopInfo.assessment.level !== "bad" && (
                      <div className="mt-2 border-t border-white/10 pt-2 text-xs font-normal leading-relaxed text-slate-300/95">
                        {sizeLabel ? (
                          <p>
                            Tamanho publicado na Steam: <strong className="text-amber-100/90">{sizeLabel}</strong>. O
                            <strong> download</strong> em si ocorre no <strong>servidor</strong> (não há % em tempo real
                            neste site); a 1.ª carga pode levar minutos. Se cair no mapa &quot;error&quot;, espera a
                            transferência ou vê
                            <code className="mx-0.5 rounded bg-black/30 px-0.5">docker logs cs2-server</code>.
                          </p>
                        ) : (
                          <p>
                            A Steam não reportou tamanho. Na 1.ª carga o servidor descarrega o mapa; sem % aqui — usa o
                            log de
                            <code className="mx-0.5 rounded bg-black/30 px-0.5">cs2-server</code> se precisares.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
              {workshopBlockStart && !workshopLoading && (
                <p className="text-xs text-slate-400">Corrija o ID ou troque para um mapa vanilla para iniciar.</p>
              )}
            </div>
          )}
        </div>
      </div>
      {isLeader && (
        <Button
          variant="primary"
          fullWidth
          className={`mt-4 font-black italic tracking-widest ${
            allReady && !workshopBlockStart ? "bg-amber-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]" : "bg-slate-700 opacity-50"
          }`}
          isDisabled={!allReady || starting || workshopBlockStart}
          onPress={startMatch}
        >
          <span className="mr-1.5 text-base leading-none" aria-hidden>
            ◎
          </span>
          {starting ? "INICIANDO…" : workshopBlockStart && usesWorkshop ? "WORKSHOP INVÁLIDO" : "INICIAR PARTIDA"}
        </Button>
      )}
    </>
  );

  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        style={{ backfaceVisibility: "hidden" }}
        aria-hidden
      >
        <div
          className="absolute inset-[-6%] bg-cover bg-center blur-md will-change-transform [transform:translateZ(0)] opacity-70"
          style={{ backgroundImage: `url(${mapBackgroundUrl})` }}
        />
        <div className="absolute inset-0 bg-black/85" />
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
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-3xl space-y-5"
          >
            <div className="relative aspect-video overflow-hidden rounded-2xl border-2 border-emerald-500/35 bg-black shadow-2xl">
              <img
                src={mapBackgroundUrl}
                alt={lobby.mapId}
                className="absolute inset-0 h-full w-full object-cover"
                onError={(e) => {
                  const el = e.currentTarget;
                  el.onerror = null;
                  if (el.src.indexOf("bg-cs2") === -1) el.src = "/bg-cs2.png";
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
              <div className="absolute left-3 right-3 top-3 flex flex-wrap items-center gap-2 sm:left-4 sm:right-4 sm:top-4">
                <span className="rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-2 py-1 text-xs font-black uppercase tracking-wide text-emerald-200">
                  Ao vivo
                </span>
                <span className="max-w-full truncate rounded-lg border border-white/10 bg-black/50 px-2 py-1 text-xs font-black uppercase italic tracking-tight text-white">
                  {workshopInfo?.title || MAPS.find((m) => m.id === lobby.mapId)?.name || "Mapa"}
                </span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center gap-2 p-3 pb-4 sm:p-4 sm:pb-5">
                <div className="flex w-full max-w-sm items-center justify-center gap-4 sm:gap-6">
                  <div className="text-center">
                    <p className="text-xs font-bold uppercase text-slate-400">Modo</p>
                    <p className="text-xs font-bold text-white">
                      {MODES.find((m) => m.id === lobby.gameMode)?.label || "—"}
                    </p>
                  </div>
                  <div className="h-6 w-px bg-white/10" />
                  <div className="text-center">
                    <p className="text-xs font-bold uppercase text-slate-400">Região</p>
                    <p className="line-clamp-1 text-xs font-bold text-amber-100/90">
                      {REGIONS[lobby.region] ?? "Servidor"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass rounded-2xl border border-white/10 p-4 sm:p-5">
              <p className="mb-3 text-xs font-medium text-slate-400">
                Ligação ao servidor — cola no console do CS2 ou abre direto no Steam.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="glass flex min-h-10 flex-1 items-center rounded-lg border border-white/10 bg-black/40 px-4 py-3 font-mono text-xs text-accent-gold overflow-x-auto whitespace-nowrap">
                  {connectCmd || "… obtendo endereço …"}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    isDisabled={!connectCmd}
                    className={`btn-panel min-w-[6.5rem] px-4 transition-colors ${
                      copyLabel === "ok"
                        ? "bg-emerald-600 text-white"
                        : copyLabel === "err"
                          ? "bg-red-600/90 text-white"
                          : "bg-accent-gold text-white"
                    }`}
                    onPress={() => {
                      if (!connectCmd) return;
                      void (async () => {
                        try {
                          await navigator.clipboard.writeText(connectCmd);
                          setCopyLabel("ok");
                        } catch {
                          setCopyLabel("err");
                        }
                        if (copyResetRef.current) clearTimeout(copyResetRef.current);
                        copyResetRef.current = setTimeout(() => setCopyLabel("idle"), 2200);
                      })();
                    }}
                  >
                    {copyLabel === "ok" ? "COPIADO!" : copyLabel === "err" ? "ERRO" : "COPIAR"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    isDisabled={!connectCmd || !steamConnectFromConsoleCmd(connectCmd)}
                    className="btn-panel min-w-[6.5rem] border-white/25 font-black text-white"
                    onPress={() => {
                      if (!connectCmd) return;
                      const href = steamConnectFromConsoleCmd(connectCmd);
                      if (!href) return;
                      window.location.href = href;
                    }}
                  >
                    STEAM
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                <span className="font-semibold text-slate-300">STEAM</span> usa o protocolo Valve (mesmo IP, porta e
                senha).
              </p>
              {isLeader && (
                <Button
                  variant="outline"
                  fullWidth
                  isDisabled={cancelling}
                  className="btn-panel mt-4 w-full border-red-500/50 font-black text-red-300 hover:bg-red-500/15"
                  onPress={() => void cancelPartida()}
                >
                  {cancelling ? "CANCELANDO…" : "CANCELAR PARTIDA NO SERVIDOR"}
                </Button>
              )}
            </div>

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
                    <span className="text-3xl font-black tabular-nums text-amber-200 sm:text-4xl">{boardView.teamT.score}</span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col items-start sm:pl-4">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300">T</span>
                    <span className="line-clamp-1 text-xs font-bold text-slate-300">
                      {boardView.teamT.name || lobby.team2Name}
                    </span>
                  </div>
                </div>
                <p className="text-center text-[10px] font-semibold text-slate-500">
                  <span className="mr-1.5 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-black uppercase text-slate-400 sm:text-xs">
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
                    <div className="grid grid-cols-[1fr_minmax(0,2.5rem)_minmax(0,2.5rem)_minmax(0,2.5rem)_minmax(0,2.5rem)] gap-1 border-b border-sky-500/20 px-1 pb-2 text-[10px] font-black uppercase tracking-tighter text-sky-200/80 sm:text-xs">
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
                  <section className="space-y-2 rounded-2xl border border-amber-500/30 bg-amber-500/[0.05] p-3">
                    <div className="grid grid-cols-[1fr_minmax(0,2.5rem)_minmax(0,2.5rem)_minmax(0,2.5rem)_minmax(0,2.5rem)] gap-1 border-b border-amber-500/20 px-1 pb-2 text-[10px] font-black uppercase tracking-tighter text-amber-200/80 sm:text-xs">
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
                            className="grid grid-cols-[1fr_minmax(0,2.5rem)_minmax(0,2.5rem)_minmax(0,2.5rem)_minmax(0,2.5rem)] items-center gap-1 rounded-lg border border-amber-500/20 bg-amber-500/[0.08] px-1.5 py-1.5"
                          >
                            <div className="flex min-w-0 items-center gap-1.5">
                              <Avatar size="sm" className="h-6 w-6 shrink-0 ring-1 ring-amber-500/30">
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
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Espectadores (servidor)</h4>
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
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 text-left sm:p-8 sm:text-center">
                <p className="text-sm font-bold text-amber-100/90">Aguardando placar (MatchZy)</p>
                <p className="mt-3 text-xs leading-relaxed text-slate-400">
                  Cada fim de rodada o MatchZy envia um POST para o painel. Configure no servidor de jogo:
                </p>
                <ul className="mt-4 list-disc space-y-3 pl-5 text-left text-xs leading-relaxed text-slate-400 sm:mx-auto sm:max-w-xl sm:list-inside sm:pl-0">
                  <li>
                    No ficheiro <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">config.cfg</code> do MatchZy, defina{" "}
                    <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">matchzy_remote_log_url</code> com uma URL que o{" "}
                    <strong className="text-slate-300">próprio servidor</strong> consiga abrir (não use apenas o URL do seu PC).
                  </li>
                  <li>
                    Painel e CS2 na mesma máquina (ex.: Docker): algo como{" "}
                    <code className="break-all rounded bg-black/30 px-1.5 py-0.5 text-xs">
                      http://127.0.0.1:3080/api/webhooks/matchzy-events
                    </code>
                    .
                  </li>
                  <li>
                    Hosts diferentes: use o URL público do painel (ex.: <code className="text-xs">http://IP:3080/...</code>) e abra a porta 3080.
                  </li>
                  <li>
                    Depois de editar, no console do servidor:{" "}
                    <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">exec csgo/cfg/MatchZy/config.cfg</code>.
                  </li>
                  <li>
                    Se usar <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">MATCHZY_WEBHOOK_SECRET</code> no .env, o header do MatchZy
                    (ex.: <code className="text-xs">x-matchzy-secret</code>) tem de coincidir.
                  </li>
                </ul>
              </div>
            )}
            </div>
          </motion.div>
        )}

        {lobby.status !== "live" && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:items-start xl:gap-8">
            <section className="order-2 space-y-3 rounded-2xl border border-sky-500/30 bg-sky-500/[0.04] p-3 xl:order-1">
              <div className="flex items-center justify-between gap-2 px-0.5">
                <h3 className="flex min-w-0 flex-1 flex-col gap-0.5 text-xs font-black uppercase leading-tight text-sky-200 sm:flex-row sm:items-baseline sm:gap-1.5">
                  <span className="inline-flex items-center gap-1">
                    <span aria-hidden>🛡</span>
                    <span className="italic">TIME 1</span> <span>CT</span>
                  </span>
                  <span className="truncate font-bold text-slate-400 not-italic normal-case">· {lobby.team1Name}</span>
                </h3>
                <span className="shrink-0 text-xs font-bold text-slate-400">
                  {m1.length}/{lobby.maxPerTeam}
                </span>
              </div>
              <div className="space-y-2">
                {Array.from({ length: lobby.maxPerTeam }).map((_, i) => renderMember(m1[i], 1))}
              </div>
              <Button
                className="btn-panel w-full border-2 border-dashed border-sky-400/45 bg-sky-500/10 text-xs font-black tracking-wide text-sky-200"
                variant="outline"
                onPress={() => joinTeam(1)}
              >
                + ENTRAR
              </Button>
            </section>

            <section className="order-1 min-w-0 space-y-3 xl:order-2">
              {mapAjustesOpen && (
                <div className="fixed inset-0 z-50 flex md:hidden" role="dialog" aria-modal="true" aria-label="Ajustes da partida">
                  <button
                    type="button"
                    className="absolute inset-0 bg-black/75 backdrop-blur-sm"
                    aria-label="Fechar ajustes"
                    onClick={() => setMapAjustesOpen(false)}
                  />
                  <div className="relative ml-auto flex h-full w-[min(100%,22rem)] flex-col border-l border-white/10 bg-zinc-950 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                      <span className="text-xs font-black uppercase tracking-wide text-accent-gold">Ajustes</span>
                      <button
                        type="button"
                        className="rounded-lg px-2 py-1 text-xs font-bold text-slate-400 hover:bg-white/10 hover:text-white"
                        onClick={() => setMapAjustesOpen(false)}
                      >
                        Fechar
                      </button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-4 [-webkit-overflow-scrolling:touch]">
                      <MatchSettingsBody />
                    </div>
                  </div>
                </div>
              )}

              <p className="mx-auto hidden max-w-lg text-center text-[11px] leading-snug text-slate-400 md:block">
                Usa o botão <span className="text-slate-300">⚙</span> no mapa para mapa, MatchZy e{" "}
                <span className="text-slate-300">iniciar</span> — os menus precisam ficar abertos ao escolher opções.
              </p>

              <div className="relative mx-auto w-full max-w-lg">
                <div className="relative aspect-video overflow-hidden rounded-2xl border-2 border-amber-500/20 bg-black shadow-2xl">
                  <img
                    src={mapBackgroundUrl}
                    alt={lobby.mapId}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700"
                    onError={(e) => {
                      const el = e.currentTarget;
                      el.onerror = null;
                      if (el.src.indexOf("bg-cs2") === -1) el.src = "/bg-cs2.png";
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 z-30 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl border border-amber-500/40 bg-black/70 text-lg text-amber-200 shadow-lg backdrop-blur-sm transition hover:border-amber-400 hover:bg-black/85 md:flex"
                    title="Ajustes da partida"
                    aria-expanded={mapAjustesOpen}
                    aria-label="Abrir ajustes da partida"
                    onClick={() => setMapAjustesOpen((v) => !v)}
                  >
                    ⚙
                  </button>
                  <div className="absolute left-3 right-3 top-3 z-10 flex flex-wrap gap-1.5 pr-14 sm:left-4 sm:right-4 sm:top-4 sm:pr-16">
                    <span className="max-w-full truncate rounded-lg border border-white/10 bg-black/50 px-2 py-1 text-xs font-black uppercase italic tracking-tight text-white">
                      {workshopInfo?.title || MAPS.find((m) => m.id === lobby.mapId)?.name || "Mapa"}
                    </span>
                    {isLeader && /^\d+$/.test(lobby.mapId) && workshopInfo && (
                      <span className="whitespace-nowrap rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-bold text-amber-100">
                        ID: {lobby.mapId}
                      </span>
                    )}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col items-center gap-2 p-3 pb-4 sm:p-4 sm:pb-5">
                    <div className="flex w-full max-w-sm items-center justify-center gap-4 sm:gap-6">
                      <div className="text-center">
                        <p className="text-xs font-bold uppercase text-slate-400">Modo</p>
                        <p className="text-xs font-bold text-white">
                          {MODES.find((m) => m.id === lobby.gameMode)?.label || "Competitivo"}
                        </p>
                      </div>
                      <div className="h-6 w-px bg-white/10" />
                      <div className="text-center">
                        <p className="text-xs font-bold uppercase text-slate-400">Região</p>
                        <p className="line-clamp-1 text-xs font-bold text-amber-100/90">
                          {REGIONS[lobby.region] ?? "Servidor"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-black uppercase text-amber-200 shadow-lg">
                      {starting ? "INICIANDO…" : `ESPERANDO ${playing.length}/${lobby.maxPerTeam * 2}`}
                    </div>
                  </div>
                </div>

                {mapAjustesOpen && (
                  <div
                    className="absolute inset-0 z-40 hidden overflow-hidden rounded-2xl border-2 border-amber-500/20 md:block"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Ajustes da partida"
                  >
                    <button
                      type="button"
                      className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
                      aria-label="Fechar ajustes"
                      onClick={() => setMapAjustesOpen(false)}
                    />
                    <div className="absolute inset-y-0 right-0 flex w-[min(100%,20.5rem)] flex-col border-l border-amber-500/30 bg-zinc-950/98 shadow-[-16px_0_48px_rgba(0,0,0,0.75)] backdrop-blur-md">
                      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400/95">
                          Centro de comando
                        </span>
                        <button
                          type="button"
                          className="rounded-lg px-2 py-1 text-xs font-bold text-slate-400 hover:bg-white/10 hover:text-white"
                          onClick={() => setMapAjustesOpen(false)}
                        >
                          Fechar
                        </button>
                      </div>
                      <div className="min-h-0 flex-1 overflow-y-auto p-4 [-webkit-overflow-scrolling:touch]">
                        <MatchSettingsBody />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                className="btn-panel mx-auto w-full max-w-lg border border-white/15 bg-white/5 text-xs font-black uppercase tracking-wide text-slate-200 hover:bg-white/10 md:hidden"
                onClick={() => setMapAjustesOpen(true)}
              >
                Ajustes da partida e iniciar
              </button>

              <div className="glass mx-auto max-w-lg rounded-2xl border border-white/10 p-4">
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Espectadores</h4>
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
                    className="h-8 w-8 rounded-full border border-white/10 bg-white/5 p-0 glass"
                    onPress={() => joinTeam(3)}
                  >
                    +
                  </Button>
                </div>
              </div>
            </section>

            <section className="order-3 space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.05] p-3">
              <div className="flex items-center justify-between gap-2 px-0.5">
                <h3 className="flex min-w-0 flex-1 flex-col gap-0.5 text-xs font-black uppercase leading-tight text-amber-200 sm:flex-row sm:items-baseline sm:gap-1.5">
                  <span className="inline-flex items-center gap-1">
                    <span aria-hidden>⚔</span>
                    <span className="italic">TIME 2</span> <span>TR</span>
                  </span>
                  <span className="truncate font-bold text-slate-400 not-italic normal-case">· {lobby.team2Name}</span>
                </h3>
                <span className="shrink-0 text-xs font-bold text-slate-400">
                  {m2.length}/{lobby.maxPerTeam}
                </span>
              </div>
              <div className="space-y-2">
                {Array.from({ length: lobby.maxPerTeam }).map((_, i) => renderMember(m2[i], 2))}
              </div>
              <Button
                className="btn-panel w-full border-2 border-dashed border-amber-400/45 bg-amber-500/10 text-xs font-black tracking-wide text-amber-200"
                variant="outline"
                onPress={() => joinTeam(2)}
              >
                + ENTRAR
              </Button>
            </section>
          </div>
        )}
      </div>
    </>
  );
}

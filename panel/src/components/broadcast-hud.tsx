"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BroadcastGetResponse } from "@/lib/broadcast-types";
import type { ScoreboardPlayer } from "@/lib/scoreboard-types";

const POLL_MS = 1500;

type ApiView = BroadcastGetResponse;

type TabId = "geral" | "avancado";

function fmt1(n: number): string {
  return Number.isFinite(n) ? n.toFixed(1) : "—";
}

function kdRow(p: ScoreboardPlayer): string {
  if (p.deaths <= 0) return p.kills > 0 ? `${p.kills.toFixed(2)}` : "0.00";
  return (p.kills / p.deaths).toFixed(2);
}

function statsFor(p: ScoreboardPlayer, roundsPlayed: number) {
  const adr = p.damage > 0 ? p.damage / roundsPlayed : 0;
  const kpr = p.kills / roundsPlayed;
  const hsPct = p.kills > 0 ? (p.headshotKills / p.kills) * 100 : 0;
  return { adr, kpr, hsPct };
}

function TeamBlock({
  side,
  teamName,
  score,
  accent,
  rows,
  roundsPlayed,
  teamAvgAdr,
}: {
  side: "CT" | "T";
  teamName: string;
  score: number;
  accent: "violet" | "emerald";
  rows: ScoreboardPlayer[];
  roundsPlayed: number;
  teamAvgAdr: number;
}) {
  const bar =
    accent === "violet"
      ? "from-violet-600/25 to-transparent border-l-violet-500/50"
      : "from-emerald-600/25 to-transparent border-l-emerald-500/50";

  return (
    <section
      className={`overflow-hidden rounded-xl border border-white/[0.06] bg-[#0c0c0e] ${
        accent === "violet" ? "shadow-[0_0_40px_-12px_rgba(139,92,246,0.35)]" : "shadow-[0_0_40px_-12px_rgba(16,185,129,0.25)]"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`text-4xl font-black tabular-nums leading-none ${
              side === "CT" ? "text-slate-400" : "text-emerald-400"
            }`}
          >
            {score}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{side}</p>
            <p className="truncate text-sm font-bold text-white">{teamName}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-end justify-end gap-4 text-right text-xs">
          <div>
            <p className="text-slate-400">Team avg (DMR)</p>
            <p className="font-bold tabular-nums text-amber-200/90">{fmt1(teamAvgAdr)}</p>
          </div>
          <div className="hidden sm:block">
            <p className="text-slate-400">Rodadas disputadas</p>
            <p className="font-bold tabular-nums text-slate-300">{roundsPlayed}</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-[11px]">
          <thead>
            <tr className="border-b border-white/[0.06] text-xs font-bold uppercase tracking-wider text-slate-400">
              <th className="sticky left-0 z-10 bg-[#0c0c0e] px-3 py-2 pl-4">Jogador</th>
              <th className="px-1.5 py-2 text-center">K</th>
              <th className="px-1.5 py-2 text-center">D</th>
              <th className="px-1.5 py-2 text-center">A</th>
              <th className="px-1.5 py-2 text-center">DMR</th>
              <th className="px-1.5 py-2 text-center">K/D</th>
              <th className="px-1.5 py-2 text-center">K/R</th>
              <th className="px-1.5 py-2 text-center">HS</th>
              <th className="px-1.5 py-2 text-center">HS %</th>
              <th className="px-1.5 py-2 text-center pr-4">MVP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const { adr, kpr, hsPct } = statsFor(p, roundsPlayed);
              return (
                <tr key={p.key} className="border-b border-white/[0.04] transition hover:bg-white/[0.03]">
                  <td
                    className={`sticky left-0 z-10 bg-gradient-to-r ${bar} border-l-2 px-3 py-2 pl-4 font-semibold text-slate-100`}
                  >
                    <span className="truncate block max-w-[10rem] sm:max-w-xs">{p.name}</span>
                  </td>
                  <td className="px-1.5 py-2 text-center tabular-nums text-slate-200">{p.kills}</td>
                  <td className="px-1.5 py-2 text-center tabular-nums text-slate-400">{p.deaths}</td>
                  <td className="px-1.5 py-2 text-center tabular-nums text-slate-400">{p.assists}</td>
                  <td className="px-1.5 py-2 text-center tabular-nums text-amber-200/80">{p.damage > 0 ? fmt1(adr) : "—"}</td>
                  <td className="px-1.5 py-2 text-center tabular-nums text-slate-200">{kdRow(p)}</td>
                  <td className="px-1.5 py-2 text-center tabular-nums text-slate-300">{fmt1(kpr)}</td>
                  <td className="px-1.5 py-2 text-center tabular-nums text-slate-500">{p.headshotKills > 0 ? p.headshotKills : "—"}</td>
                  <td className="px-1.5 py-2 text-center tabular-nums text-slate-500">
                    {p.kills > 0 && p.headshotKills > 0 ? `${fmt1(hsPct)}%` : "—"}
                  </td>
                  <td className="px-1.5 py-2 text-center tabular-nums text-slate-400 pr-4">{p.mvps > 0 ? p.mvps : "—"}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-600">
                  Nenhum jogador neste time no último evento.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function BroadcastHud() {
  const [data, setData] = useState<ApiView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("geral");
  const [roundPulse, setRoundPulse] = useState<number | null>(null);
  const prevRound = useRef<number | null>(null);

  const pull = useCallback(async () => {
    try {
      const r = await fetch("/api/broadcast", { cache: "no-store" });
      const j = (await r.json()) as ApiView;
      if (!r.ok) {
        setErr("Falha ao ler estado");
        return;
      }
      setData(j);
      setErr(null);
    } catch {
      setErr("Sem conexão com o painel");
    }
  }, []);

  useEffect(() => {
    void pull();
    const t = setInterval(() => void pull(), POLL_MS);
    return () => clearInterval(t);
  }, [pull]);

  const v = data?.view ?? null;
  const src = data?.source ?? "none";

  useEffect(() => {
    if (!v?.hasData) return;
    if (prevRound.current === null) {
      prevRound.current = v.round;
      return;
    }
    if (v.round !== prevRound.current) {
      setRoundPulse(v.round);
      prevRound.current = v.round;
      const t = setTimeout(() => setRoundPulse(null), 3500);
      return () => clearTimeout(t);
    }
  }, [v?.round, v?.hasData]);

  const lastAge =
    v && v.updatedAt > 0 ? Math.max(0, Math.floor((Date.now() - v.updatedAt) / 1000)) : null;

  const ct = v?.players.filter((p) => p.team === "CT") ?? [];
  const tr = v?.players.filter((p) => p.team === "T") ?? [];
  const rp = v?.roundsPlayed ?? 1;

  const teamAvg = (list: ScoreboardPlayer[]) => {
    if (list.length === 0) return 0;
    const sum = list.reduce((a, p) => a + (p.damage > 0 ? p.damage / rp : 0), 0);
    return sum / list.length;
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#070708] text-slate-100">
      {roundPulse !== null && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-sm font-bold text-amber-200">
          Rodada {roundPulse} · placar e estatísticas atualizados
        </div>
      )}

      <div className="mx-auto max-w-[1600px] space-y-4 px-3 py-4 md:px-6 md:py-6">
        <header className="flex flex-col gap-3 border-b border-white/[0.08] pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-500/90">Estatísticas da partida</p>
            <h1 className="mt-1 text-2xl font-black italic tracking-tight text-white md:text-3xl">Broadcast · scoreboard</h1>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Dados <strong className="text-slate-400">acumulados do mapa</strong> (MatchZy, fim da rodada). Fonte:{" "}
              <strong className="text-slate-300">{src === "matchzy" ? "MatchZy" : "—"}</strong> · poll ~{POLL_MS / 1000}s
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {lastAge !== null && (
              <p className="text-xs tabular-nums text-slate-400">Último pacote: há {lastAge}s</p>
            )}
            {v && (
              <p className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-slate-300">
                {v.mapName} · rodada {v.round} · {v.phase}
              </p>
            )}
          </div>
        </header>

        {err && (
          <p className="rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-sm font-medium text-rose-400">{err}</p>
        )}

        {!data?.hasData || !v ? (
          <div className="space-y-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center">
            <p className="text-sm text-slate-400">
              Sem dados ainda. No servidor, em{" "}
              <code className="rounded bg-white/10 px-1.5">game/csgo/cfg/MatchZy/config.cfg</code>, defina{" "}
              <code className="rounded bg-white/10 px-1.5">matchzy_remote_log_url</code> com a URL completa do painel +{" "}
              <code className="text-amber-200/80">/api/webhooks/matchzy-events</code> (e o segredo no painel, se usar).
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-1 rounded-lg border border-white/10 p-0.5">
                {(
                  [
                    ["geral", "Geral"],
                    ["avancado", "Avançado"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={`rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${
                      tab === id
                        ? "border border-amber-500/50 bg-amber-500/10 text-amber-200"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {tab === "geral" && (
              <div className="space-y-6">
                <TeamBlock
                  side="CT"
                  teamName={v.teamCt.name || "CT"}
                  score={v.teamCt.score}
                  accent="violet"
                  rows={ct}
                  roundsPlayed={rp}
                  teamAvgAdr={teamAvg(ct)}
                />
                <TeamBlock
                  side="T"
                  teamName={v.teamT.name || "TR"}
                  score={v.teamT.score}
                  accent="emerald"
                  rows={tr}
                  roundsPlayed={rp}
                  teamAvgAdr={teamAvg(tr)}
                />
              </div>
            )}

            {tab === "avancado" && (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-sm text-slate-400">
                <p className="mb-2 font-bold text-amber-200/80">Métricas avançadas (KAST, RWS, multikills por rodada, etc.)</p>
                <p>
                  O que vês no separador <span className="text-slate-400">Geral</span> vem dos eventos <code className="text-slate-400">round_end</code> do
                  MatchZy. Métricas extras (RWS, 2K/3K/4K por rodada, etc.) exigiriam outra fonte (logs ou plugin no servidor).
                </p>
              </div>
            )}

            <p className="text-center text-xs leading-relaxed text-slate-400">
              Dano, MVPs e HS vêm do payload de estatísticas do MatchZy quando o servidor envia após a rodada.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

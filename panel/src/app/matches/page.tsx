"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, Button, Card } from "@heroui/react";
import { RemoteInventoryImage } from "@/components/remote-inventory-image";

type MatchPlayer = {
  steamid64: string;
  team: number;
  kills: number;
  deaths: number;
  assists: number;
  adr: number;
  user: {
    name: string;
    avatar: string;
  } | null;
};

type Match = {
  id: string;
  mapId: string;
  team1Name: string;
  team2Name: string;
  score1: number;
  score2: number;
  winner: number | null;
  startedAt: string;
  endedAt: string | null;
  players: MatchPlayer[];
};

type Demo = {
  name: string;
  size: number;
  mtime: string;
};

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [demos, setDemos] = useState<Demo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [mRes, dRes] = await Promise.all([
          fetch("/api/matches"),
          fetch("/api/matches/demos"),
        ]);
        const mData = await mRes.json();
        const dData = await dRes.json();
        setMatches(mData.matches || []);
        setDemos(dData.demos || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-black text-white">
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 sm:px-6">
        <header className="mb-6 border-b border-white/10 pb-4">
          <h1 className="text-lg font-black uppercase tracking-tight text-white sm:text-xl">Histórico de partidas</h1>
          <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">Scoreboard e demos</p>
        </header>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 text-sm font-medium">
            Carregando histórico…
          </div>
        ) : matches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 text-sm font-medium">
            Nenhuma partida finalizada encontrada.
          </div>
        ) : (
          <div className="space-y-4">
            {matches.map((match) => (
              <Card
                key={match.id}
                className="overflow-hidden border-white/5 bg-neutral-900/40 hover:bg-neutral-900/60 transition-all"
              >
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedMatch(expandedMatch === match.id ? null : match.id)}
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-[80px]">
                        <p className="text-xs font-black uppercase text-slate-400">{match.mapId}</p>
                        <p className="text-xs text-slate-400">{formatDate(match.startedAt)}</p>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-xs font-black text-white truncate max-w-[120px]">{match.team1Name}</p>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-1.5 rounded-xl bg-black/40 border border-white/5 shadow-inner">
                          <span className={`text-2xl font-black tabular-nums ${match.winner === 1 ? "text-sky-400" : "text-white/60"}`}>
                            {match.score1}
                          </span>
                          <span className="text-slate-700 font-bold">:</span>
                          <span className={`text-2xl font-black tabular-nums ${match.winner === 2 ? "text-amber-400" : "text-white/60"}`}>
                            {match.score2}
                          </span>
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-black text-white truncate max-w-[120px]">{match.team2Name}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {demos.some(d => d.name.includes(match.id)) && (
                        <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-xs font-black uppercase tracking-tight text-emerald-400">
                          Demo disponível
                        </span>
                      )}
                      <div className={`transition-transform duration-200 ${expandedMatch === match.id ? "rotate-180" : ""}`}>
                        ▼
                      </div>
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedMatch === match.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-white/5"
                    >
                      <div className="p-6 space-y-8">
                        {/* Team Scoreboards */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                          {/* Team 1 (CT Aesthetic) */}
                          <div className="space-y-3">
                            <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-sky-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                              {match.team1Name}
                            </h3>
                            <div className="overflow-hidden rounded-xl border border-sky-500/20 bg-sky-500/[0.03]">
                              <table className="w-full text-[11px]">
                                <thead className="border-b border-sky-500/10 bg-sky-500/5 text-sky-300/70 font-black uppercase tracking-tighter">
                                  <tr>
                                    <th className="px-3 py-2 text-left">Jogador</th>
                                    <th className="px-2 py-2 text-right">K</th>
                                    <th className="px-2 py-2 text-right">A</th>
                                    <th className="px-2 py-2 text-right">D</th>
                                    <th className="px-2 py-2 text-right">ADR</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-sky-500/5">
                                  {match.players.filter(p => p.team === 1).sort((a,b)=>b.kills-a.kills).map(p => (
                                    <tr key={p.steamid64} className="hover:bg-sky-500/5 transition-colors">
                                      <td className="px-3 py-2.5">
                                        <div className="flex items-center gap-2">
                                          <Avatar className="h-5 w-5 ring-1 ring-sky-500/30" size="sm">
                                            {p.user?.avatar && <Avatar.Image src={p.user.avatar} />}
                                            <Avatar.Fallback className="text-[10px] font-bold">{p.user?.name?.[0] ?? "?"}</Avatar.Fallback>
                                          </Avatar>
                                          <span className="font-bold text-slate-100">{p.user?.name || `…${p.steamid64.slice(-6)}`}</span>
                                        </div>
                                      </td>
                                      <td className="px-2 py-2.5 text-right font-mono font-bold text-sky-100">{p.kills}</td>
                                      <td className="px-2 py-2.5 text-right font-mono text-slate-400">{p.assists}</td>
                                      <td className="px-2 py-2.5 text-right font-mono text-slate-400">{p.deaths}</td>
                                      <td className="px-2 py-2.5 text-right font-mono font-bold text-sky-200/70">{Math.round(p.adr)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Team 2 (Amber Aesthetic) */}
                          <div className="space-y-3">
                            <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-amber-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              {match.team2Name}
                            </h3>
                            <div className="overflow-hidden rounded-xl border border-amber-500/20 bg-amber-500/[0.03]">
                              <table className="w-full text-[11px]">
                                <thead className="border-b border-amber-500/10 bg-amber-500/5 text-amber-300/70 font-black uppercase tracking-tighter">
                                  <tr>
                                    <th className="px-3 py-2 text-left">Jogador</th>
                                    <th className="px-2 py-2 text-right">K</th>
                                    <th className="px-2 py-2 text-right">A</th>
                                    <th className="px-2 py-2 text-right">D</th>
                                    <th className="px-2 py-2 text-right">ADR</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-amber-500/5">
                                  {match.players.filter(p => p.team === 2).sort((a,b)=>b.kills-a.kills).map(p => (
                                    <tr key={p.steamid64} className="hover:bg-amber-500/5 transition-colors">
                                      <td className="px-3 py-2.5">
                                        <div className="flex items-center gap-2">
                                          <Avatar className="h-5 w-5 ring-1 ring-amber-500/30" size="sm">
                                            {p.user?.avatar && <Avatar.Image src={p.user.avatar} />}
                                            <Avatar.Fallback className="text-[10px] font-bold">{p.user?.name?.[0] ?? "?"}</Avatar.Fallback>
                                          </Avatar>
                                          <span className="font-bold text-slate-100">{p.user?.name || `…${p.steamid64.slice(-6)}`}</span>
                                        </div>
                                      </td>
                                      <td className="px-2 py-2.5 text-right font-mono font-bold text-amber-100">{p.kills}</td>
                                      <td className="px-2 py-2.5 text-right font-mono text-slate-400">{p.assists}</td>
                                      <td className="px-2 py-2.5 text-right font-mono text-slate-400">{p.deaths}</td>
                                      <td className="px-2 py-2.5 text-right font-mono font-bold text-amber-200/70">{Math.round(p.adr)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>

                        {/* Demo Download */}
                        {demos.filter(d => d.name.includes(match.id)).map(demo => (
                          <div key={demo.name} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                            <div className="flex items-center gap-3">
                              <span className="text-xl">📽</span>
                              <div>
                                <p className="text-xs font-bold text-white">{demo.name}</p>
                                <p className="text-xs font-black uppercase text-slate-400">{formatSize(demo.size)} · MatchZy Demo</p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              className="btn-panel bg-accent-gold text-xs font-black text-black"
                              onPress={() => window.open(`/api/matches/demos/${demo.name}`)}
                            >
                              DOWNLOAD DEMO
                            </Button>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

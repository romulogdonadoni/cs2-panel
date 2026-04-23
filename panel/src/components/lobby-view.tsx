"use client";

import { useCallback, useEffect, useState } from "react";
import { 
  Button, 
  Card, 
  Checkbox, 
  Avatar, 
  Badge, 
  Select, 
  ListBox,
  Label
} from "@heroui/react";
import { motion, AnimatePresence } from "framer-motion";

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
  custom: "Personalizado (Docker)",
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
  onExit: () => void;
};

export function LobbyView({ code, me, onExit }: Props) {
  const [data, setData] = useState<{ lobby: Lobby; baseUrl: string } | null>(null);
  const [connectCmd, setConnectCmd] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

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
      setErr("Erro ao ligar ao servidor.");
    }
  }, [code]);

  useEffect(() => {
    const t = setInterval(() => void refresh(), 2000);
    void refresh();
    return () => clearInterval(t);
  }, [refresh]);

  const lobby = data?.lobby;
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

  if (!lobby) return <div className="p-8 text-center text-slate-500">A carregar lobby...</div>;

  const m1 = lobby.members.filter((m) => m.team === 1);
  const m2 = lobby.members.filter((m) => m.team === 2);
  const specs = lobby.members.filter((m) => m.team === 3);

  const playing = lobby.members.filter(m => m.team === 1 || m.team === 2);
  const allReady = playing.length > 0 && playing.every(m => m.isReady);

  const renderMember = (p?: Member) => (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
      p ? "glass bg-white/5 border-white/10" : "border-dashed border-white/5 bg-transparent"
    }`}>
      <Avatar size="sm" className={p ? "ring-2 ring-accent-blue/20" : "opacity-20"}>
        {p?.avatar ? <Avatar.Image src={p.avatar} /> : null}
        <Avatar.Fallback className="text-[10px]">{p ? p.name?.[0] : "?"}</Avatar.Fallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-bold truncate ${p ? "text-slate-100" : "text-slate-700"}`}>
          {p ? p.name || "Jogador" : "Vazio"}
          {p?.isLeader && <span className="ml-1 text-accent-gold text-[10px]">★</span>}
        </p>
        {p && <p className="text-[10px] text-slate-500 tabular-nums">…{p.steamid64.slice(-6)}</p>}
      </div>
      {p?.isReady && <Badge size="sm" color="accent" className="bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" />}
    </div>
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white italic tracking-tighter">LOBBY #{lobby.code}</h2>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
            {MAPS.find(m => m.id === lobby.mapId)?.name || "Desconhecido"} • {MODES.find(m => m.id === lobby.gameMode)?.label || "Desconhecido"} • {lobby.members.length} Jogadores
          </p>
        </div>
        <div className="flex gap-2">
          {self && (
            <Checkbox 
              isSelected={self.isReady} 
              onChange={(v) => {
                fetch(`/api/lobbies/${code}/me`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ isReady: v }),
                });
              }}
              className="glass px-4 py-2 rounded-lg border-white/10"
            >
              <span className="text-xs font-bold text-white uppercase">Pronto</span>
            </Checkbox>
          )}
          <Button size="sm" variant="outline" className="font-bold border-white/10 text-slate-400" onPress={onExit}>SAIR</Button>
        </div>
      </header>

      {connectCmd && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass bg-accent-blue/10 border-accent-blue/30 p-6 rounded-2xl flex flex-col items-center gap-4 text-center shadow-[0_0_40px_rgba(59,130,246,0.15)]"
        >
          <div className="h-12 w-12 rounded-full bg-accent-blue flex items-center justify-center text-white text-xl animate-pulse">📡</div>
          <div>
            <h3 className="text-lg font-black text-white italic">PARTIDA EM CURSO</h3>
            <p className="text-xs text-slate-400 font-medium">Copia o comando abaixo e cola no console do CS2</p>
          </div>
          <div className="w-full max-w-md flex gap-2">
            <div className="flex-1 glass bg-black/40 border-white/5 rounded-lg px-4 py-2 text-xs font-mono text-accent-blue flex items-center overflow-x-auto whitespace-nowrap">
              {connectCmd}
            </div>
            <Button 
              size="sm" 
              variant="primary" 
              className="bg-accent-blue text-white font-bold"
              onPress={() => {
                navigator.clipboard.writeText(connectCmd);
                alert("Copiado!");
              }}
            >
              COPIAR
            </Button>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* TEAM 1 */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black text-accent-blue uppercase tracking-widest italic">{lobby.team1Name}</h3>
            <span className="text-[10px] font-bold text-slate-600">{m1.length}/{lobby.maxPerTeam}</span>
          </div>
          <div className="space-y-2">
            {Array.from({ length: lobby.maxPerTeam }).map((_, i) => renderMember(m1[i]))}
          </div>
          <Button size="sm" className="w-full glass border-accent-blue/30 text-accent-blue font-bold" onPress={() => joinTeam(1)}>JUNTAR-SE À EQUIPA 1</Button>
        </section>

        {/* TEAM 2 */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black text-accent-orange uppercase tracking-widest italic">{lobby.team2Name}</h3>
            <span className="text-[10px] font-bold text-slate-600">{m2.length}/{lobby.maxPerTeam}</span>
          </div>
          <div className="space-y-2">
            {Array.from({ length: lobby.maxPerTeam }).map((_, i) => renderMember(m2[i]))}
          </div>
          <Button size="sm" className="w-full glass border-accent-orange/30 text-accent-orange font-bold" onPress={() => joinTeam(2)}>JUNTAR-SE À EQUIPA 2</Button>
        </section>

        {/* SETTINGS & SPECS */}
        <section className="space-y-6">
          <div className="glass-dark p-6 rounded-2xl border-white/5 space-y-4">
            <h3 className="text-xs font-black text-white uppercase tracking-widest italic">DEFINIÇÕES DO LÍDER</h3>
            <div className="space-y-3">
              <div>
                <Label className="text-[10px] font-bold text-slate-500 uppercase">Mapa</Label>
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
                      {MAPS.find(m => m.id === lobby.mapId)?.name || "Mapa"}
                    </Select.Value>
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {MAPS.map(m => <ListBox.Item key={m.id} id={m.id} textValue={m.name}>{m.name}</ListBox.Item>)}
                    </ListBox>
                  </Select.Popover>
                </Select>
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
            {isLeader && lobby.status !== "live" && (
              <Button 
                variant="primary" 
                fullWidth 
                className={`font-black italic tracking-widest ${allReady ? "bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]" : "bg-slate-700 opacity-50"}`}
                isDisabled={!allReady || starting}
                onPress={startMatch}
              >
                {starting ? "A INICIAR..." : "INICIAR PARTIDA"}
              </Button>
            )}
          </div>

          <div className="glass bg-white/5 rounded-2xl p-4 border-white/10">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-3">Espectadores</h4>
            <div className="flex flex-wrap gap-2">
              {specs.map(s => (
                <Avatar key={s.steamid64} size="sm" title={s.name}>
                  {s.avatar ? <Avatar.Image src={s.avatar} /> : null}
                </Avatar>
              ))}
              <Button size="sm" variant="ghost" className="rounded-full h-8 w-8 p-0" onPress={() => joinTeam(3)}>+</Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

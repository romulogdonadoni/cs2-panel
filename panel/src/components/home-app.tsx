"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Description,
  Input,
  Label,
  ListBox,
  Select,
  Tab,
  TabList,
  TabListContainer,
  TabPanel,
  Tabs,
  TextField,
} from "@heroui/react";
import { motion, AnimatePresence } from "framer-motion";
import { SkinConfigModal, type SkinCatalogRow } from "@/components/skin-config-modal";
import { ServerSettings } from "@/components/server-settings";
import { LobbyView } from "@/components/lobby-view";
import {
  type LoadoutV1,
  type WeaponSlotConfig,
  clamp,
  defaultLoadout,
  midFloat,
  normalizeLoadout,
  toPersist,
} from "@/lib/loadout-types";


const ESSENTIAL_SLOTS = [
  { id: "knife", label: "Faca" },
  { id: "gloves", label: "Luvas" },
  { id: "weapon_ak47", label: "AK-47" },
  { id: "weapon_m4a1_silencer", label: "M4A1-S" },
  { id: "weapon_m4a1", label: "M4A4" },
  { id: "weapon_awp", label: "AWP" },
  { id: "weapon_glock", label: "Glock-18" },
  { id: "weapon_usp_silencer", label: "USP-S" },
  { id: "weapon_deagle", label: "Desert Eagle" },
];

type Me = {
  steamid64: string;
  name: string | null;
  avatar: string | null;
  profileUrl: string | null;
} | null;


function countLoadoutPicks(Lo: LoadoutV1): number {
  const w = Object.keys(Lo.weapons).length;
  const a = (Lo.agent_ct ? 1 : 0) + (Lo.agent_t ? 1 : 0);
  const m = Lo.music ? 1 : 0;
  return w + a + m;
}

export function HomeApp() {
  const [me, setMe] = useState<Me | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);
  const [loadout, setLoadout] = useState<LoadoutV1>(defaultLoadout);
  const [saving, setSaving] = useState(false);
  const [lobbyCode, setLobbyCode] = useState("");
  const [activeLobbyCode, setActiveLobbyCode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("lobby");
  const [isAdmin, setIsAdmin] = useState(false);



  const refreshMe = useCallback(async () => {
    const r = await fetch("/api/me", { credentials: "include" });
    const j = (await r.json()) as { user: Me; isAdmin: boolean };
    setMe(j.user);
    setIsAdmin(j.isAdmin);
  }, []);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  useEffect(() => {
    if (!me) {
      return;
    }
    void (async () => {
      const r = await fetch("/api/profile/loadout", { credentials: "include" });
      if (!r.ok) {
        return;
      }
      const j = (await r.json()) as { body: unknown };
      setLoadout(normalizeLoadout(j.body));
    })();
  }, [me]);


  async function saveLoadout(Lo: LoadoutV1) {
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch("/api/profile/loadout", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPersist(Lo)),
      });
      if (!r.ok) {
        const t = (await r.json().catch(() => ({}))) as { error?: string };
        setErr(t.error || "Falha ao guardar");
      }
    } finally {
      setSaving(false);
    }
  }



  async function createLobby() {
    setErr(null);
    const r = await fetch("/api/lobbies", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const j = (await r.json()) as { error?: string; lobby?: { code: string } };
    if (!r.ok) {
      setErr(j.error || "Erro");
      return;
    }
    if (j.lobby?.code) {
      setActiveLobbyCode(j.lobby.code);
      setActiveTab("lobby");
    }
  }

  if (me === undefined) {
    return <div className="p-8 text-center text-foreground-600">A carregar…</div>;
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Immersive Background */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <Image
          src="/bg-cs2.png"
          alt=""
          fill
          priority
          className="object-cover opacity-20 scale-110 blur-sm brightness-50"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/40 to-slate-950/90" />
      </div>

      <header className="glass sticky top-0 z-50 px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b-0 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-accent-gold/20 flex items-center justify-center border border-accent-gold/30">
            <span className="text-accent-gold font-bold text-xl italic">CS</span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              PAINEL <span className="text-accent-orange text-xs bg-accent-orange/10 px-2 py-0.5 rounded uppercase tracking-widest">PRO</span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">Loadout & Lobbies</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {me ? (
            <>
              <div className="flex items-center gap-3 bg-white/5 pl-2 pr-4 py-1.5 rounded-full border border-white/10 ring-1 ring-white/5">
                <Avatar className="h-8 w-8 ring-2 ring-accent-blue/30" size="sm">
                  {me.avatar ? (
                    <Avatar.Image src={me.avatar} alt="" className="object-cover" />
                  ) : null}
                  <Avatar.Fallback className="bg-slate-800 text-xs text-white">
                    {me.name?.[0] ?? "?"}
                  </Avatar.Fallback>
                </Avatar>
                <div className="hidden sm:block">
                  <p className="text-xs font-bold text-slate-200 leading-none">
                    {me.name || "Jogador"}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">…{me.steamid64.slice(-6)}</p>
                </div>
              </div>
              
              <Button size="sm" variant="primary" className="font-bold bg-accent-orange text-white shadow-lg shadow-accent-orange/20" onPress={createLobby}>
                + LOBBY
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="font-bold text-amber-400 hover:text-amber-300 border border-amber-400/20 hover:border-amber-400/40 hover:bg-amber-400/5 transition-all"
                onPress={() => { location.href = "/skins"; }}
              >
                🎨 SKINS
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-slate-400 hover:text-white"
                onPress={async () => {
                  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
                  setMe(null);
                }}
              >
                SAIR
              </Button>
            </>
          ) : (
            <Button variant="primary" className="bg-accent-gold text-black font-bold" size="sm" onPress={() => { location.href = "/auth/steam"; }}>
              ENTRAR COM STEAM
            </Button>
          )}
        </div>
      </header>

      {err && (
        <div className="bg-danger-100 text-danger-800 m-3 rounded-lg px-3 py-2 text-sm border border-danger-200/50">
          {err}
        </div>
      )}

      {!me ? (
        <div className="m-auto max-w-md p-6">
          <Card className="p-6">
            <h2 className="text-xl font-medium">Bem-vindo</h2>
            <p className="mt-2 text-foreground-600 text-sm">
              Autentica-te com a Steam para gerir o teu loadout e lobbies.
            </p>
            <Button className="mt-4" variant="primary" onPress={() => { location.href = "/auth/steam"; }}>
              Entrar com Steam
            </Button>
          </Card>
        </div>
      ) : (
        <div className="grid flex-1 min-h-0 grid-cols-1 gap-0 lg:grid-cols-[300px_1fr]">
          <aside className="glass-dark border-r-0 border-b lg:border-b-0 lg:border-r border-white/5 p-6 space-y-6">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-accent-gold uppercase tracking-[0.2em]">Visão Geral</p>
              <h3 className="text-xl font-bold text-white italic">LOADOUT</h3>
            </div>
            
            <div className="glass bg-white/5 rounded-xl border-white/10 overflow-hidden">
              <div className="bg-white/5 px-4 py-2 border-b border-white/5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Itens Equipados</span>
              </div>
              <div className="p-2 space-y-1 max-h-[400px] overflow-auto">
                {ESSENTIAL_SLOTS.map(slot => {
                  const cfg = loadout.weapons[slot.id];
                  return (
                    <div key={slot.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors group">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-slate-500 uppercase leading-none mb-1">{slot.label}</p>
                        <p className={`text-xs font-medium truncate ${cfg ? "text-accent-blue" : "text-slate-600 italic"}`}>
                          {cfg ? cfg.name : "Vazio"}
                        </p>
                      </div>
                      {cfg && (
                        <div className="h-1.5 w-1.5 rounded-full bg-accent-blue shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                      )}
                    </div>
                  );
                })}
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors group border-t border-white/5 mt-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-500 uppercase leading-none mb-1">Música</p>
                    <p className={`text-xs font-medium truncate ${loadout.music ? "text-accent-gold" : "text-slate-600 italic"}`}>
                      {loadout.music || "Padrão"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ações</p>
              <Button
                className="w-full h-12 font-bold bg-white text-black hover:bg-slate-200 transition-all shadow-xl shadow-white/5"
                variant="primary"
                isDisabled={saving}
                onPress={() => void saveLoadout(loadout)}
              >
                {saving ? "A GUARDAR…" : "GUARDAR TUDO"}
              </Button>
              <p className="text-[10px] text-center text-slate-500 italic">As alterações são aplicadas instantaneamente no servidor.</p>
            </div>
          </aside>
          <main className="min-h-0 overflow-auto p-6">
            <Tabs className="w-full" selectedKey={activeTab} onSelectionChange={(k) => setActiveTab(String(k))}>
              <TabListContainer className="mb-6">
                <TabList aria-label="Secções do loadout" className="gap-2">
                  <Tab id="lobby" className="px-6 py-2 font-bold uppercase tracking-wider text-xs">Lobby</Tab>
                  {isAdmin && <Tab id="server" className="px-6 py-2 font-bold uppercase tracking-wider text-xs">Servidor</Tab>}
                </TabList>
              </TabListContainer>

              <TabPanel className="pt-4" id="lobby">
                {activeLobbyCode ? (
                  <LobbyView code={activeLobbyCode} me={me} onExit={() => setActiveLobbyCode(null)} />
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                    <div className="h-20 w-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl opacity-50">🎮</div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Nenhuma Lobby Ativa</h3>
                      <p className="text-sm text-slate-500 mt-2">Cria uma nova lobby ou junta-te a uma existente.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button variant="primary" className="font-bold bg-accent-orange text-white" onPress={createLobby}>+ NOVA LOBBY</Button>
                      <div className="flex items-center gap-2">
                        <TextField
                          className="w-32"
                          value={lobbyCode}
                          onChange={setLobbyCode}
                          aria-label="Código da lobby"
                        >
                          <Input placeholder="CÓDIGO" className="text-xs font-bold uppercase glass bg-white/5 border-white/10" variant="primary" />
                        </TextField>
                        <Button
                          variant="outline"
                          className="font-bold border-white/10"
                          onPress={() => {
                            const c = lobbyCode.trim().toUpperCase();
                            if (c) {
                              setActiveLobbyCode(c);
                              setActiveTab("lobby");
                            }
                          }}
                        >
                          JOIN
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </TabPanel>

              <TabPanel className="pt-4" id="server">
                <ServerSettings />
              </TabPanel>
            </Tabs>
          </main>
        </div>
      )}

    </div>
  );
}

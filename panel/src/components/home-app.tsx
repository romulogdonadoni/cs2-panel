"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Avatar, Button, Card, Tab, TabList, TabListContainer, TabPanel, Tabs } from "@heroui/react";
import { ServerSettings } from "@/components/server-settings";
import { LobbyView } from "@/components/lobby-view";

type Me = {
  steamid64: string;
  name: string | null;
  avatar: string | null;
  profileUrl: string | null;
} | null;

export function HomeApp() {
  const [me, setMe] = useState<Me | undefined>(undefined);
  const [singletonCode, setSingletonCode] = useState<string | null>(null);
  const [singletonErr, setSingletonErr] = useState<string | null>(null);
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
    setSingletonErr(null);
    void (async () => {
      const r = await fetch("/api/lobby", { credentials: "include" });
      const j = (await r.json()) as { error?: string; lobby?: { code: string } };
      if (!r.ok) {
        setSingletonErr(j.error || "Não foi possível carregar a sala.");
        return;
      }
      if (j.lobby?.code) {
        setSingletonCode(j.lobby.code);
      }
    })();
  }, [me]);

  if (me === undefined) {
    return <div className="p-8 text-center text-foreground-600">Carregando…</div>;
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
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
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.55)]" title="Sala activa" />
                <span className="text-xs text-slate-300">Partida personalizada</span>
              </div>
              <a
                className="text-[11px] text-cyan-400/80 hover:underline"
                href="/broadcast"
                target="_blank"
                rel="noreferrer"
              >
                Monitor
              </a>
            </div>
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

              <Button
                size="sm"
                variant="ghost"
                className="font-bold text-amber-400 hover:text-amber-300 border border-amber-400/45 hover:border-amber-400/70 hover:bg-amber-400/5 transition-all"
                onPress={() => { location.href = "/skins"; }}
              >
                <span className="mr-1" aria-hidden>
                  🗡
                </span>
                SKINS
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

      {singletonErr && (
        <div className="bg-danger-100 text-danger-800 m-3 rounded-lg px-3 py-2 text-sm border border-danger-200/50">
          {singletonErr}
        </div>
      )}

      {!me ? (
        <div className="m-auto max-w-md p-6">
          <Card className="p-6">
            <h2 className="text-xl font-medium">Bem-vindo</h2>
            <p className="mt-2 text-foreground-600 text-sm">
              Autentica-te com a Steam para entrar na sala e conectar ao servidor.
            </p>
            <Button className="mt-4" variant="primary" onPress={() => { location.href = "/auth/steam"; }}>
              Entrar com Steam
            </Button>
          </Card>
        </div>
      ) : (
        <main className="min-h-0 flex-1 overflow-auto p-4 md:p-6">
          <Tabs className="w-full" selectedKey={activeTab} onSelectionChange={(k) => setActiveTab(String(k))}>
            <TabListContainer className="mb-6">
              <TabList aria-label="Navegação" className="gap-2">
                <Tab id="lobby" className="px-6 py-2 font-bold uppercase tracking-wider text-xs">Lobby</Tab>
                {isAdmin && <Tab id="server" className="px-6 py-2 font-bold uppercase tracking-wider text-xs">Servidor</Tab>}
              </TabList>
            </TabListContainer>

            <TabPanel className="pt-4" id="lobby">
              {singletonCode ? (
                <div className="relative z-10">
                  <LobbyView code={singletonCode} me={me} />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500 text-sm font-medium">
                  Carregando a sala do servidor…
                </div>
              )}
            </TabPanel>

            <TabPanel className="pt-4" id="server">
              <ServerSettings />
            </TabPanel>
          </Tabs>
        </main>
      )}
    </div>
  );
}

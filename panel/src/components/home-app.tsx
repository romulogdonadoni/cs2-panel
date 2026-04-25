"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button, Card, Tab, TabList, TabListContainer, TabPanel, Tabs } from "@heroui/react";
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
            <Link
              href="/auth/steam"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-accent-gold px-6 text-sm font-bold text-black transition hover:bg-accent-gold/90"
            >
              Entrar com Steam
            </Link>
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

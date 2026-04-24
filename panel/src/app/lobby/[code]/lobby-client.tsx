"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LobbyView } from "@/components/lobby-view";

export function LobbyClient() {
  const router = useRouter();
  const [me, setMe] = useState<{ steamid64: string } | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/me", { credentials: "include" });
        const j = await r.json();
        setMe(j.user);
        if (!j.user) {
          return;
        }
        const lr = await fetch("/api/lobby", { credentials: "include" });
        if (lr.status === 401) {
          setCode(null);
          return;
        }
        const lj = (await lr.json()) as { lobby?: { code: string } };
        if (lj.lobby?.code) {
          setCode(lj.lobby.code);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="p-20 text-center text-slate-500 font-bold italic tracking-widest animate-pulse">CARREGANDO…</div>;
  }

  if (!me) {
    return (
      <div className="mx-auto max-w-md p-8 text-center text-slate-400">
        <p className="mb-4">Inicia sessão para ver a sala.</p>
        <button type="button" className="text-accent-blue font-bold" onClick={() => { location.href = "/auth/steam"; }}>
          Entrar com Steam
        </button>
      </div>
    );
  }

  if (!code) {
    return (
      <div className="p-20 text-center text-slate-500 text-sm max-w-md mx-auto">
        Não foi possível abrir a sala.{" "}
        <button type="button" className="text-accent-blue underline" onClick={() => router.push("/")}>
          Voltar ao início
        </button>
      </div>
    );
  }

  return (
    <div className="relative z-10 mx-auto max-w-7xl p-4 lg:p-8">
      <LobbyView 
        code={code} 
        me={me} 
        onExit={() => router.push("/")} 
      />
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Avatar, Button } from "@heroui/react";

type Me = {
  steamid64: string;
  name: string | null;
  avatar: string | null;
  profileUrl: string | null;
} | null;

const NAV_ITEMS = [
  { href: "/", label: "Início", match: (p: string) => p === "/" || p.startsWith("/lobby") },
  { href: "/skins", label: "Loadout", match: (p: string) => p.startsWith("/skins") },
  { href: "/matches", label: "Partidas", match: (p: string) => p.startsWith("/matches") },
  { href: "/broadcast", label: "Broadcast", match: (p: string) => p.startsWith("/broadcast") },
] as const;

export function PanelChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const [me, setMe] = useState<Me | undefined>(undefined);

  const refreshMe = useCallback(async () => {
    const r = await fetch("/api/me", { credentials: "include" });
    const j = (await r.json()) as { user: Me };
    setMe(j.user);
  }, []);

  useEffect(() => {
    void refreshMe();
  }, [pathname, refreshMe]);

  useEffect(() => {
    const onFocus = () => void refreshMe();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshMe]);

  const linkClass = (active: boolean) =>
    `shrink-0 rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-wide transition md:px-4 md:text-xs ${
      active
        ? "bg-accent-gold/15 text-accent-gold ring-1 ring-accent-gold/40"
        : "text-slate-400 hover:bg-white/5 hover:text-white"
    }`;

  return (
    <div className="flex min-h-dvh flex-col bg-black">
      <header className="glass sticky top-0 z-[100] border-b border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
        <div className="mx-auto flex w-full max-w-[1900px] flex-wrap items-center justify-between gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="flex min-w-0 flex-1 items-center gap-4 md:flex-none md:gap-6">
            <Link href="/" className="flex shrink-0 items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent-gold/30 bg-accent-gold/15 sm:h-10 sm:w-10">
                <span className="text-lg font-bold italic text-accent-gold sm:text-xl">CS</span>
              </div>
              <div className="hidden min-w-0 sm:block">
                <p className="flex min-w-0 items-center gap-2 truncate text-sm font-bold tracking-tight text-white">
                  <span className="truncate">PAINEL</span>
                  <span className="inline-flex shrink-0 items-center rounded bg-accent-orange/15 px-1.5 py-0.5 text-[10px] font-black uppercase leading-none tracking-widest text-accent-orange">
                    PRO
                  </span>
                </p>
                <p className="text-xs text-slate-400">Partida personalizada</p>
              </div>
            </Link>

            <nav
              className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto pb-0.5 md:gap-1 md:overflow-visible md:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              aria-label="Principal"
            >
              {NAV_ITEMS.map(({ href, label, match }) => (
                <Link key={href} href={href} className={linkClass(match(pathname))} prefetch>
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2 self-center sm:gap-3">
            {me === undefined ? (
              <span className="text-xs text-slate-400">…</span>
            ) : me ? (
              <>
                <div className="hidden items-center gap-2 self-center rounded-full border border-white/10 bg-white/5 py-1 pl-1 pr-3 ring-1 ring-white/5 sm:flex">
                  <Avatar className="h-8 w-8 ring-2 ring-white/20" size="sm">
                    {me.avatar ? (
                      <Avatar.Image src={me.avatar} alt="" className="object-cover" />
                    ) : null}
                    <Avatar.Fallback className="bg-slate-800 text-xs text-white">
                      {me.name?.[0] ?? "?"}
                    </Avatar.Fallback>
                  </Avatar>
                  <div className="max-w-[140px]">
                    <p className="truncate text-xs font-bold leading-none text-slate-200">
                      {me.name || "Jogador"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">…{me.steamid64.slice(-6)}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="min-h-10 h-10 font-bold text-slate-400 hover:text-white"
                  onPress={async () => {
                    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
                    setMe(null);
                  }}
                >
                  Sair
                </Button>
              </>
            ) : (
              <Link
                href="/auth/steam"
                className="btn-panel rounded-lg bg-accent-gold text-black transition hover:bg-accent-gold/90 sm:text-sm"
              >
                Entrar
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

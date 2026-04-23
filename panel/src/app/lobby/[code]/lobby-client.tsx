"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Card, Checkbox } from "@heroui/react";

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

const MODE_LBL: Record<string, string> = {
  competitive: "Competitivo",
  casual: "Casual",
  wingman: "Wingman",
  deathmatch: "Deathmatch",
};

const REGION_LBL: Record<string, string> = {
  sao_paulo: "São Paulo",
  miami: "Miami",
  europe: "Europa (Frankfurt)",
  custom: "Personalizado (Docker)",
};

type Member = { steamid64: string; team: number; isReady: boolean; isLeader: boolean };

type Lobby = {
  code: string;
  leaderSteamid64: string;
  team1Name: string;
  team2Name: string;
  mapId: string;
  gameMode: string;
  region: string;
  maxPerTeam: number;
  members: Member[];
  settings: Record<string, unknown>;
};

export function LobbyClient() {
  const params = useParams();
  const router = useRouter();
  const code = String(params.code || "").toUpperCase();
  const [me, setMe] = useState<{ steamid64: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<{ lobby: Lobby; baseUrl: string } | null>(null);

  const refresh = useCallback(async () => {
    if (!code) {
      return;
    }
    const r = await fetch("/api/lobbies/" + encodeURIComponent(code), { credentials: "include" });
    if (r.status === 404) {
      setErr("Lobby não encontrada.");
      return;
    }
    const j = (await r.json()) as { error?: string; lobby: Lobby; baseUrl: string };
    if (j.error) {
      setErr(j.error);
      return;
    }
    setData(j);
    setErr(null);
  }, [code]);

  useEffect(() => {
    void (async () => {
      const r = await fetch("/api/me", { credentials: "include" });
      const j = (await r.json()) as { user: { steamid64: string } | null };
      setMe(j.user);
    })();
  }, []);

  useEffect(() => {
    const t = setInterval(() => void refresh(), 2500);
    void refresh();
    return () => clearInterval(t);
  }, [refresh]);

  const lobby = data?.lobby;
  const isLeader = me && lobby && me.steamid64 === lobby.leaderSteamid64;
  const self = lobby && me ? lobby.members.find((m) => m.steamid64 === me.steamid64) : undefined;

  async function joinLobby() {
    const r = await fetch("/api/lobbies/" + encodeURIComponent(code) + "/join", {
      method: "POST",
      credentials: "include",
    });
    if (r.status === 401) {
      router.push("/auth/steam");
      return;
    }
    if (!r.ok) {
      const t = (await r.json().catch(() => ({}))) as { error?: string };
      setErr(t.error || "Erro");
      return;
    }
    await refresh();
  }

  async function putMe(body: object) {
    const r = await fetch("/api/lobbies/" + encodeURIComponent(code) + "/me", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const t = (await r.json().catch(() => ({}))) as { error?: string };
      alert(t.error || "Erro");
    }
    await refresh();
  }

  async function kick(sid: string) {
    if (!confirm("Expulsar?")) {
      return;
    }
    await fetch("/api/lobbies/" + encodeURIComponent(code) + "/kick", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steamid64: sid }),
    });
    await refresh();
  }

  async function delLobby() {
    if (!confirm("Eliminar lobby?")) {
      return;
    }
    const r = await fetch("/api/lobbies/" + encodeURIComponent(code), { method: "DELETE", credentials: "include" });
    if (r.ok) {
      router.push("/");
    }
  }

  if (err && !data) {
    return (
      <div className="m-auto p-6 text-center">
        <p className="text-danger">{err}</p>
        <Button className="mt-4" onPress={() => router.push("/")}>
          Início
        </Button>
      </div>
    );
  }
  if (!lobby) {
    return <div className="p-8 text-center">A carregar…</div>;
  }

  const cap = lobby.maxPerTeam * 2;
  const filled = lobby.members.filter((m) => m.team === 1 || m.team === 2).length;
  const m1 = lobby.members.filter((m) => m.team === 1);
  const m2 = lobby.members.filter((m) => m.team === 2);
  const specs = lobby.members.filter((m) => m.team === 3);

  return (
    <div className="mx-auto max-w-4xl p-4">
      {err && <p className="text-danger-600 text-sm mb-2">{err}</p>}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Lobby #{lobby.code}</h1>
        <div className="flex gap-2">
          {me && !self && (
            <Button variant="primary" onPress={joinLobby}>
              Entrar na lobby
            </Button>
          )}
          {!me && (
            <Button onPress={() => { location.href = "/auth/steam"; }}>Entrar (Steam)</Button>
          )}
        </div>
      </header>

      <p className="text-sm text-foreground-600 mb-4">
        {MODE_LBL[lobby.gameMode] || lobby.gameMode} · {REGION_LBL[lobby.region] || lobby.region} · {filled}/{cap} slots
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <h2 className="font-medium mb-2">{lobby.team1Name}</h2>
          <ul className="space-y-1 text-sm">
            {Array.from({ length: lobby.maxPerTeam }).map((_, i) => {
              const p = m1[i];
              return (
                <li key={i} className="flex items-center justify-between border-b border-foreground-200/20 py-1">
                  <span>
                    {p ? (p.isLeader ? "★ " : "") + "…" + p.steamid64.slice(-5) : "Vazio"}
                    {p?.isReady ? " ✓" : ""}
                  </span>
                  {isLeader && p && !p.isLeader && (
                    <Button size="sm" variant="ghost" onPress={() => void kick(p.steamid64)}>
                      expulsar
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          {self && <Button className="mt-2" size="sm" onPress={() => void putMe({ team: 1 })}>Juntar-me</Button>}
        </Card>
        <Card className="p-4">
          <h2 className="font-medium mb-2">{lobby.team2Name}</h2>
          <ul className="space-y-1 text-sm">
            {Array.from({ length: lobby.maxPerTeam }).map((_, i) => {
              const p = m2[i];
              return (
                <li key={i} className="flex items-center justify-between border-b border-foreground-200/20 py-1">
                  <span>
                    {p ? (p.isLeader ? "★ " : "") + "…" + p.steamid64.slice(-5) : "Vazio"}
                    {p?.isReady ? " ✓" : ""}
                  </span>
                  {isLeader && p && !p.isLeader && (
                    <Button size="sm" variant="ghost" onPress={() => void kick(p.steamid64)}>
                      expulsar
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          {self && <Button className="mt-2" size="sm" onPress={() => void putMe({ team: 2 })}>Juntar-me</Button>}
        </Card>
      </div>

      <Card className="p-4 mt-4">
        <h2 className="font-medium mb-2">Espectador</h2>
        <ul className="text-sm">
          {specs.length
            ? specs.map((p) => (
                <li key={p.steamid64}>…{p.steamid64.slice(-5)}</li>
              ))
            : "Nenhum"}
        </ul>
        {self && <Button className="mt-2" size="sm" onPress={() => void putMe({ team: 3 })}>Espectador</Button>}
      </Card>

      {self && (
        <div className="mt-4 flex items-center gap-2">
          <Checkbox
            isSelected={self.isReady}
            onChange={(v) => void putMe({ isReady: v })}
          >
            Pronto
          </Checkbox>
        </div>
      )}

      {isLeader && (
        <Card className="p-4 mt-4">
          <h2 className="font-medium mb-3">Definições (líder)</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-sm text-foreground-600">Mapa</p>
              <select
                className="w-full mt-1 rounded border border-foreground-200/30 bg-transparent p-2"
                value={lobby.mapId}
                onChange={async (e) => {
                  const mapId = e.target.value;
                  await fetch("/api/lobbies/" + encodeURIComponent(code) + "/settings", {
                    method: "PUT",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ mapId }),
                  });
                  await refresh();
                }}
              >
                {MAPS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-sm text-foreground-600">Modo</p>
              <select
                className="w-full mt-1 rounded border border-foreground-200/30 bg-transparent p-2"
                value={lobby.gameMode}
                onChange={async (e) => {
                  await fetch("/api/lobbies/" + encodeURIComponent(code) + "/settings", {
                    method: "PUT",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ gameMode: e.target.value }),
                  });
                  await refresh();
                }}
              >
                {Object.entries(MODE_LBL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button className="mt-4" variant="danger" onPress={delLobby}>
            Apagar lobby
          </Button>
        </Card>
      )}
    </div>
  );
}

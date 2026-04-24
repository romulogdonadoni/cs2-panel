"use client";

import { useEffect, useState } from "react";
import { Button, Card, Input, Label, TextField } from "@heroui/react";

export function ServerSettings() {
  const [env, setEnv] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/panel/server");
        const j = await r.json();
        if (j.env) {
          setEnv(j.env);
        }
      } catch (e) {
        setErr("Falha ao carregar configurações");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = async () => {
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch("/api/panel/server", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: env }),
      });
      if (!r.ok) {
        const j = await r.json();
        setErr(j.error || "Erro ao salvar");
      }
    } catch (e) {
      setErr("Erro de rede");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-slate-500 p-4">Carregando configurações…</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <header>
        <h2 className="text-xl font-bold text-white italic tracking-tight">DEFINIÇÕES DO SERVIDOR</h2>
        <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">Lobby & Gameplay</p>
      </header>

      {err && <div className="p-3 bg-danger-100 text-danger-800 rounded-lg text-sm">{err}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold text-slate-400 uppercase">Nome do Servidor</Label>
          <TextField value={env.CS2_SERVERNAME || ""} onChange={(v) => setEnv(e => ({ ...e, CS2_SERVERNAME: v }))}>
            <Input className="glass bg-white/5 border-white/10" />
          </TextField>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold text-slate-400 uppercase">Mapa Inicial</Label>
          <TextField value={env.CS2_STARTMAP || ""} onChange={(v) => setEnv(e => ({ ...e, CS2_STARTMAP: v }))}>
            <Input className="glass bg-white/5 border-white/10" />
          </TextField>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold text-slate-400 uppercase">Tipo de Jogo</Label>
          <TextField value={env.CS2_GAMETYPE || "0"} onChange={(v) => setEnv(e => ({ ...e, CS2_GAMETYPE: v }))}>
            <Input className="glass bg-white/5 border-white/10" />
          </TextField>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold text-slate-400 uppercase">Modo de Jogo</Label>
          <TextField value={env.CS2_GAMEMODE || "1"} onChange={(v) => setEnv(e => ({ ...e, CS2_GAMEMODE: v }))}>
            <Input className="glass bg-white/5 border-white/10" />
          </TextField>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold text-slate-400 uppercase">Password do Servidor</Label>
          <TextField value={env.CS2_PW || ""} onChange={(v) => setEnv(e => ({ ...e, CS2_PW: v }))}>
            <Input className="glass bg-white/5 border-white/10" placeholder="Vazio para público" />
          </TextField>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold text-slate-400 uppercase">RCON Password</Label>
          <TextField value={env.CS2_RCONPW || ""} onChange={(v) => setEnv(e => ({ ...e, CS2_RCONPW: v }))}>
            <Input className="glass bg-white/5 border-white/10" type="password" />
          </TextField>
        </div>
      </div>

      <Button 
        variant="primary" 
        className="font-bold bg-accent-gold text-black px-8"
        isDisabled={saving}
        onPress={update}
      >
        {saving ? "SALVANDO…" : "APLICAR ALTERAÇÕES"}
      </Button>
      <p className="text-[10px] text-slate-500 italic">Algumas alterações podem exigir reinício do processo de jogo no anfitrião.</p>
    </div>
  );
}

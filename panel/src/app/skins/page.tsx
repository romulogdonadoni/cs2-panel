"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SkinConfigModal } from "@/components/skin-config-modal";
import { useSkinsData } from "./hooks/useSkinsData";
import { LoadoutGrid } from "./LoadoutGrid";
import { SkinPickerModal } from "./components/SkinPickerModal";
import { type PickingSlot, type Skin } from "./types";

export default function SkinsPage() {
  const {
    saved,
    toast,
    agents,
    agentCt,
    agentT,
    musicCt,
    musicT,
    pinCt,
    pinT,
    savingAgent,
    musics,
    pins,
    savingMusic,
    savingPin,
    fetchAgents,
    saveAgent,
    removeAgent,
    saveMusic,
    savePin,
    fetch_,
    getDefindex,
    handleSave,
    handleRemove,
    key,
    allWeapons,
    showToast,
  } = useSkinsData("loadout", "", "all");

  const [pickingSlot, setPickingSlot] = useState<PickingSlot | null>(null);
  const [selected, setSelected] = useState<Skin | null>(null);
  const [saveTeamOverride, setSaveTeamOverride] = useState<0 | 2 | 3 | undefined>(undefined);
  const savedList = useMemo(() => Object.values(saved), [saved]);

  const openSkinConfig = useCallback((skin: Skin, teamOverride?: 0 | 2 | 3) => {
    setSaveTeamOverride(teamOverride);
    setSelected(skin);
  }, []);

  const closeSkinConfig = useCallback(() => {
    setSelected(null);
    setSaveTeamOverride(undefined);
  }, []);

  useEffect(() => {
    if (!pickingSlot) return;
    if (pickingSlot.type === "agent") {
      void fetchAgents("", 0, pickingSlot.team === "ct" ? "ct" : "t");
    }
    if (pickingSlot.type === "music") fetch_("music", "", 0);
    if (pickingSlot.type === "pin") fetch_("pins", "", 0);
  }, [pickingSlot, fetchAgents, fetch_]);

  const handleRemoveFromGrid = useCallback(
    (def: number, paint: number, slotTeam: "ct" | "t") => {
      const t = slotTeam === "ct" ? 3 : 2;
      void handleRemove(def, paint, t);
    },
    [handleRemove]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-neutral-950 text-white">
      <main className="mx-auto flex min-h-0 w-full max-w-[1900px] flex-1 flex-col overflow-hidden px-1.5 py-1 sm:px-2">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <LoadoutGrid
            savedList={savedList}
            skins={allWeapons}
            handleRemove={handleRemoveFromGrid}
            onSlotClick={setPickingSlot}
            music={{ ct: musicCt, t: musicT }}
            pin={{ ct: pinCt, t: pinT }}
            agents={{ ct: agentCt, t: agentT }}
            removeAgent={removeAgent}
            onConfigureSlot={({ skin, slotTeam }) => {
              setPickingSlot(null);
              setSaveTeamOverride(slotTeam === "ct" ? 3 : 2);
              setSelected(skin);
            }}
          />
        </div>
      </main>

      <SkinPickerModal
        slot={pickingSlot}
        skins={allWeapons}
        agents={agents}
        musics={musics}
        pins={pins}
        onClose={() => setPickingSlot(null)}
        onPickSkin={(skin) => {
          const t = pickingSlot?.team === "ct" ? 3 : 2;
          setPickingSlot(null);
          openSkinConfig(skin, t);
        }}
        onPickAgent={(agent) => {
          const side = pickingSlot?.team ?? "ct";
          void saveAgent(agent, side);
          setPickingSlot(null);
        }}
        onPickMusic={(m) => {
          void saveMusic(m, pickingSlot?.team);
          setPickingSlot(null);
        }}
        onPickPin={(p) => {
          void savePin(p, pickingSlot?.team);
          setPickingSlot(null);
        }}
        savingAgent={savingAgent}
        savingMusic={savingMusic}
        savingPin={savingPin}
      />

      {selected && (() => {
        const def = getDefindex(selected);
        const paint = parseInt(String(selected.paint_index ?? "0"), 10);
        const sv = saved[key(def, paint)];
        const initial = sv
          ? {
              skinId: String(sv.weapon_paint_id),
              float: sv.weapon_wear,
              stattrak: sv.weapon_stattrak === 1,
            }
          : undefined;
        return (
          <SkinConfigModal
            item={selected}
            initial={initial}
            weaponTeam={saveTeamOverride ?? 0}
            onClose={closeSkinConfig}
            onSave={async (opts) => {
              await handleSave(selected, { float: opts.float, stattrak: opts.stattrak }, saveTeamOverride);
              if (opts.stickerExtras) {
                const team = saveTeamOverride ?? 0;
                const r = await fetch("/api/skins/stickers", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    weapon_defindex: getDefindex(selected),
                    weapon_team: team,
                    stickers: opts.stickerExtras.stickers,
                    stickerWear: opts.stickerExtras.stickerWear,
                    keychain: opts.stickerExtras.keychain,
                    keychainSeed: opts.stickerExtras.keychainSeed,
                  }),
                });
                if (!r.ok) {
                  showToast(
                    "Não foi possível gravar stickers/pingente. Guarda a skin primeiro (APPLICAR) e tenta de novo.",
                    false
                  );
                  throw new Error("stickers");
                }
                showToast("Stickers e pingente guardados. !wp no jogo.", true);
              }
            }}
          />
        );
      })()}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed bottom-6 left-1/2 z-[300] flex -translate-x-1/2 items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold"
            style={{
              background: toast.ok ? "rgba(15,23,42,0.98)" : "rgba(127,29,29,0.98)",
              border: `1px solid ${toast.ok ? "rgba(245,158,11,0.3)" : "rgba(239,68,68,0.3)"}`,
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            }}
          >
            {toast.ok ? "✅" : "❌"} {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

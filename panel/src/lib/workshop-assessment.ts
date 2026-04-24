/**
 * Heurísticas para o dedicado CS2: a Web API da Steam muitas vezes ainda mostra
 * itens antigos/legados; pistas úteis: banned, time_updated, extensão do ficheiro.
 */

/** ~Outubro 2023 — fase de transição; mapas com última update antes disso soem ser CS:GO. */
export const CS2_HEURISTIC_CUTOFF_UTC = 1696128000;

export type WorkshopAssessment = {
  level: "ok" | "warn" | "bad";
  messages: string[];
};

export type WorkshopDetailsForAssess = {
  result: number;
  banned?: number;
  time_updated: number;
  time_created: number;
  filename?: string;
};

export function assessWorkshopFile(d: WorkshopDetailsForAssess): WorkshopAssessment {
  if (d.result !== 1) {
    return {
      level: "bad",
      messages: [
        "A Steam não devolveu este item (não existente, privado, ou inacessível). Usa outro ID.",
      ],
    };
  }
  if (d.banned === 1) {
    return {
      level: "bad",
      messages: ["Item banido no Workshop — o servidor não consegue montar este conteúdo."],
    };
  }

  const messages: string[] = [];
  if (d.time_updated < CS2_HEURISTIC_CUTOFF_UTC) {
    messages.push(
      "Última atualização muito antiga (era típica de CS:GO / Source 1). O dedicado do CS2 muitas vezes não carrega estes ficheiros; procura uma versão de workshop publicada para CS2."
    );
  }
  const fn = d.filename || "";
  if (fn.toLowerCase().endsWith(".bsp") && d.time_updated < CS2_HEURISTIC_CUTOFF_UTC) {
    messages.push(
      "Nome de ficheiro `.bsp` solto: no CS2 o workshop costuma ser pacote VPK. Pode ser legado incompatível."
    );
  }

  if (messages.length) return { level: "warn", messages };
  return { level: "ok", messages: [] };
}

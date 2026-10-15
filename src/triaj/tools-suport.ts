// src/triaj/tools-suport.ts
//
// Doua tool-uri pentru echipa de suport, cu date simulate (fara API extern):
//   verificaStatus(serviciu)        starea unui serviciu al platformei
//   cautaFacturi(clientId, luna)    facturile emise unui client intr-o luna
// Le folosim in ReAct-ul scris de mana (demo10).

import { tool } from "@langchain/core/tools";
import { z } from "zod";

const STATUS: Record<string, string> = {
  login: "INCIDENT ACTIV din 08:12, echipa lucreaza la el",
  rapoarte: "functional",
  facturare: "functional",
};

const FACTURI: Record<string, { numar: string; luna: string; suma: number }[]> = {
  "beta-srl": [
    { numar: "F-1041", luna: "2026-10", suma: 490 },
    { numar: "F-1042", luna: "2026-10", suma: 490 }, // dublura
    { numar: "F-0987", luna: "2026-09", suma: 490 },
  ],
};

export const verificaStatus = tool(
  async ({ serviciu }: { serviciu: string }) => {
    const s = STATUS[serviciu.toLowerCase()];
    return s ? `Serviciul ${serviciu}: ${s}.` : `Nu cunosc serviciul «${serviciu}». Disponibile: ${Object.keys(STATUS).join(", ")}.`;
  },
  {
    name: "verificaStatus",
    description: "Verifica starea unui serviciu al platformei (login, rapoarte, facturare).",
    schema: z.object({ serviciu: z.string().describe("Numele serviciului") }),
  },
);

export const cautaFacturi = tool(
  async ({ clientId, luna }: { clientId: string; luna: string }) => {
    const f = (FACTURI[clientId] ?? []).filter((x) => x.luna === luna);
    if (f.length === 0) return `Nicio factura pentru ${clientId} in ${luna}.`;
    return f.map((x) => `${x.numar}: ${x.suma} EUR (${x.luna})`).join("\n");
  },
  {
    name: "cautaFacturi",
    description: "Listeaza facturile unui client intr-o luna (format AAAA-LL).",
    schema: z.object({
      clientId: z.string().describe("Id-ul clientului, de exemplu beta-srl"),
      luna: z.string().describe("Luna, format AAAA-LL, de exemplu 2026-10"),
    }),
  },
);

export const toolsSuport = [verificaStatus, cautaFacturi];

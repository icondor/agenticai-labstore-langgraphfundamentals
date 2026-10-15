// src/parte2/exercitiu2-referinta.ts
//
// ===========================================================================
// EXERCITIU PARTEA 2 (REFERINTA): ramura «cere detalii»
// ===========================================================================
//
// Rulare:  pnpm exercitiu2     (cere un model real)
// Implementarea de referinta pentru trainer. Studentii pornesc de la
// src/exercitiu/schelet-parte2.ts.

import "../lib/env.js";
import { StateGraph, START, END, type GraphNode } from "@langchain/langgraph";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { createModel, readProviderFromEnv } from "../lib/llm.js";
import { mermaidCurat, textulMesajului, titlu } from "../lib/afisare.js";
import { StareTriaj, noduriTriaj, ruteaza } from "../triaj/graf-triaj.js";
import type { Triaj } from "../triaj/schema.js";

export const MINIM_CUVINTE = 6;

export function numarCuvinte(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Regula in cod: lungimea se verifica INAINTE de prioritate.
export function ruteazaCuDetalii(s: { ticket: string; triaj?: Triaj }) {
  return numarCuvinte(s.ticket) < MINIM_CUVINTE ? ("cere_detalii" as const) : ruteaza(s);
}

export function creeazaGrafCuDetalii(model: BaseChatModel) {
  const n = noduriTriaj(model);

  const cereDetalii: GraphNode<typeof StareTriaj> = async (s) => {
    const r = await model.invoke([
      {
        role: "system",
        content: "Esti agent de suport. Tichetul primit e prea scurt ca sa poata fi tratat. Cere politicos, in romana, in maxim 2 propozitii, detaliile lipsa: ce functionalitate, ce se intampla, de cand.",
      },
      { role: "user", content: s.ticket },
    ]);
    return { raspunsClient: textulMesajului(r), pasi: [`cere_detalii: tichet de ${numarCuvinte(s.ticket)} cuvinte`] };
  };

  return new StateGraph(StareTriaj)
    .addNode("clasifica", n.clasifica)
    .addNode("valideaza", n.valideaza)
    .addNode("escaladeaza", n.escaladeaza)
    .addNode("raspuns_client", n.raspunsClient)
    .addNode("nota_interna", n.notaInterna)
    .addNode("finalizeaza", n.finalizeaza)
    .addNode("cere_detalii", cereDetalii)
    .addEdge(START, "clasifica")
    .addEdge("clasifica", "valideaza")
    .addConditionalEdges("valideaza", ruteazaCuDetalii, ["escaladeaza", "raspuns_client", "nota_interna", "cere_detalii"])
    .addEdge("escaladeaza", "raspuns_client")
    .addEdge("escaladeaza", "nota_interna")
    .addEdge(["raspuns_client", "nota_interna"], "finalizeaza")
    .addEdge("finalizeaza", END)
    .addEdge("cere_detalii", END)
    .compile();
}

async function main() {
  const graf = creeazaGrafCuDetalii(createModel(readProviderFromEnv()));
  for (const ticket of ["Nu merge.", "Exportul de rapoarte da eroare 500 de ieri, cand apasam pe Genereaza."]) {
    titlu(`Tichet: «${ticket}»`);
    const r = await graf.invoke({ ticket });
    for (const p of r.pasi) console.log(`  - ${p}`);
    console.log(`  raspuns client: ${r.raspunsClient || "(gol)"}\n  nota interna: ${r.notaInterna || "(gol)"}`);
  }
  titlu("Graful");
  console.log(mermaidCurat((await graf.getGraphAsync()).drawMermaid()));
}

// Ruleaza main doar cand fisierul e pornit direct (nu cand e importat de teste).
if (import.meta.url === `file://${process.argv[1]}`) main().catch(console.error);

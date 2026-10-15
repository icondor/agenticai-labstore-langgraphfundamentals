// src/exercitiu/schelet-parte2.ts
//
// ===========================================================================
// EXERCITIU PARTEA 2: ramura «cere detalii» in graful de triaj
// ===========================================================================
//
// Rulare:  pnpm exercitiu2:schelet     (cere un model real)
//
// PROBLEMA DE BUSINESS
//   Tichetele foarte scurte («Nu merge.») nu pot fi tratate: nu stim ce nu
//   merge. Azi, graful le clasifica oricum si genereaza un raspuns inventat.
//   Vrem: daca tichetul are sub 6 cuvinte, graful NU mai genereaza raspuns si
//   nota interna, ci un singur mesaj politicos care cere detalii.
//
// CE E DEJA FACUT
//   Nodurile din Lab 12 (noduriTriaj) si legaturile grafului original.
//
// CE FACI TU (cauta TODO)
//   TODO 1: functia de rutare ruteazaCuDetalii: «cere_detalii» pentru tichete
//           sub 6 cuvinte, altfel exact ce facea ruteaza.
//   TODO 2: nodul cereDetalii: modelul scrie un raspuns scurt care cere detalii.
//   TODO 3: legaturile: nodul nou, destinatia noua in conditional edge,
//           muchia cere_detalii -> END.

import "../lib/env.js";
import { StateGraph, START, END, type GraphNode } from "@langchain/langgraph";
import { createModel, readProviderFromEnv } from "../lib/llm.js";
import { mermaidCurat, titlu } from "../lib/afisare.js";
import { StareTriaj, noduriTriaj, ruteaza } from "../triaj/graf-triaj.js";
import type { Triaj } from "../triaj/schema.js";

const model = createModel(readProviderFromEnv());
const n = noduriTriaj(model);

export const MINIM_CUVINTE = 6;

// TODO 1: intoarce "cere_detalii" daca s.ticket are sub MINIM_CUVINTE cuvinte,
// altfel ce intoarce ruteaza(s).
function ruteazaCuDetalii(s: { ticket: string; triaj?: Triaj }) {
  return ruteaza(s);
}

// TODO 2: un nod care cere detalii. Intoarce { raspunsClient, pasi: ["cere_detalii: ..."] }.
const cereDetalii: GraphNode<typeof StareTriaj> = async () => {
  throw new Error("TODO 2: cereDetalii");
};
void cereDetalii;

// TODO 3: adauga nodul "cere_detalii", destinatia lui in addConditionalEdges si muchia spre END.
// Daca uiti numele in lista de destinatii, compile se opreste cu UnreachableNodeError.
const graf = new StateGraph(StareTriaj)
  .addNode("clasifica", n.clasifica)
  .addNode("valideaza", n.valideaza)
  .addNode("escaladeaza", n.escaladeaza)
  .addNode("raspuns_client", n.raspunsClient)
  .addNode("nota_interna", n.notaInterna)
  .addNode("finalizeaza", n.finalizeaza)
  .addEdge(START, "clasifica")
  .addEdge("clasifica", "valideaza")
  .addConditionalEdges("valideaza", ruteazaCuDetalii, ["escaladeaza", "raspuns_client", "nota_interna"])
  .addEdge("escaladeaza", "raspuns_client")
  .addEdge("escaladeaza", "nota_interna")
  .addEdge(["raspuns_client", "nota_interna"], "finalizeaza")
  .addEdge("finalizeaza", END)
  .compile();

// ---------------------------------------------------------------------------
// De aici in jos nu e nevoie sa modifici nimic.
// ---------------------------------------------------------------------------
async function main() {
  for (const ticket of ["Nu merge.", "Exportul de rapoarte da eroare 500 de ieri, cand apasam pe Genereaza."]) {
    titlu(`Tichet: «${ticket}»`);
    const r = await graf.invoke({ ticket });
    for (const p of r.pasi) console.log(`  - ${p}`);
    console.log(`  raspuns client: ${r.raspunsClient || "(gol)"}\n  nota interna: ${r.notaInterna || "(gol)"}`);
  }
  titlu("Graful");
  console.log(mermaidCurat((await graf.getGraphAsync()).drawMermaid()));
}

main().catch((e) => console.error(`\nOPRIT: ${(e as Error).message}\n`));

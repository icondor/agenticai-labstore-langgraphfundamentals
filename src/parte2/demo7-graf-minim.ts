// src/parte2/demo7-graf-minim.ts
//
// ===========================================================================
// DEMO 7: CEL MAI MIC GRAF UTIL: un nod, o stare, START si END
// ===========================================================================
//
// Rulare:  pnpm demo7        (cere un model real: LLM_PROVIDER + cheia lui)
//
// CE ARATAM
//   1. Starea: un StateSchema cu doua campuri, ticket si rezumat.
//   2. Un nod: o functie async care primeste starea si intoarce DOAR ce schimba.
//   3. Muchii: START -> rezuma -> END.
//   4. compile(): din descriere obtinem un obiect care se poate rula.
//   5. invoke(): starea de intrare, starea de iesire.
//   6. drawMermaid(): graful desenat, din cod.

import "../lib/env.js";
import { StateGraph, StateSchema, START, END, type GraphNode } from "@langchain/langgraph";
import { z } from "zod";
import { createModel, readProviderFromEnv } from "../lib/llm.js";
import { mermaidCurat, textulMesajului, titlu } from "../lib/afisare.js";
import { TICHETE } from "../triaj/schema.js";

const model = createModel(readProviderFromEnv());

// 1. STAREA: ce circula prin graf. default("") = valoare de pornire.
const Stare = new StateSchema({
  ticket: z.string(),
  rezumat: z.string().default(""),
});

// 2. NODUL: primeste starea, intoarce un UPDATE partial (doar rezumat).
const rezuma: GraphNode<typeof Stare> = async (stare) => {
  const raspuns = await model.invoke([
    { role: "system", content: "Rezuma tichetul de suport intr-o singura propozitie, in romana." },
    { role: "user", content: stare.ticket },
  ]);
  return { rezumat: textulMesajului(raspuns) };
};

// 3 + 4. MUCHIILE si COMPILAREA
const graf = new StateGraph(Stare)
  .addNode("rezuma", rezuma)
  .addEdge(START, "rezuma")
  .addEdge("rezuma", END)
  .compile();

async function main() {
  titlu("DEMO 7: graful minim");

  const intrare = { ticket: TICHETE.urgent.text };
  console.log("STARE LA INTRARE:", JSON.stringify(intrare, null, 2));

  // 5. INVOKE: starea de iesire contine campurile vechi + ce a schimbat nodul
  const iesire = await graf.invoke(intrare);
  console.log("\nSTARE LA IESIRE:", JSON.stringify(iesire, null, 2));

  // 6. DIAGRAMA, generata din graf (lipeste textul in https://mermaid.live)
  titlu("Graful, desenat de LangGraph");
  console.log(mermaidCurat((await graf.getGraphAsync()).drawMermaid()));
}

main().catch(console.error);

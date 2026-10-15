// src/parte2/demo9-reduceri.ts
//
// ===========================================================================
// DEMO 9: CINE CASTIGA CAND DOUA NODURI SCRIU ACELASI CAMP? (reducers)
// ===========================================================================
//
// Rulare:  pnpm demo9        (FARA model: aici ne uitam doar la stare)
//
// CE ARATAM
//   A. Doua noduri UNUL DUPA ALTUL scriu acelasi camp, fara reducer:
//      al doilea il SUPRASCRIE pe primul (LastValue).
//   B. Aceleasi doua noduri IN PARALEL, fara reducer: LangGraph refuza,
//      InvalidUpdateError ("LastValue can only receive one value per step").
//   C. Acelasi camp cu ReducedValue (reducer = concatenare): ambele valori
//      se pastreaza, iar nodul de dupa le vede pe amandoua.

import { StateGraph, StateSchema, ReducedValue, START, END, InvalidUpdateError } from "@langchain/langgraph";
import { z } from "zod";
import { titlu } from "../lib/afisare.js";

// Camp FARA reducer: fiecare update inlocuieste valoarea (LastValue).
const StareSimpla = new StateSchema({
  pasi: z.array(z.string()).default([]),
});

// Camp CU reducer: fiecare update se ADAUGA la ce exista.
const StareCuReducer = new StateSchema({
  pasi: new ReducedValue(z.array(z.string()).default(() => []), {
    reducer: (existente: string[], noi: string[]) => [...existente, ...noi],
  }),
});

async function main() {
  titlu("A. secvential, fara reducer: ultimul castiga");
  const a = new StateGraph(StareSimpla)
    .addNode("raspuns_client", async () => ({ pasi: ["raspuns_client"] }))
    .addNode("nota_interna", async () => ({ pasi: ["nota_interna"] }))
    .addEdge(START, "raspuns_client")
    .addEdge("raspuns_client", "nota_interna")
    .addEdge("nota_interna", END)
    .compile();
  console.log("  pasi =", (await a.invoke({})).pasi, " (raspuns_client a disparut)");

  titlu("B. in paralel, fara reducer: eroare");
  const b = new StateGraph(StareSimpla)
    .addNode("raspuns_client", async () => ({ pasi: ["raspuns_client"] }))
    .addNode("nota_interna", async () => ({ pasi: ["nota_interna"] }))
    .addEdge(START, "raspuns_client")
    .addEdge(START, "nota_interna") // doua muchii din START = fan-out
    .addEdge("raspuns_client", END)
    .addEdge("nota_interna", END)
    .compile();
  try {
    await b.invoke({});
    console.log("  (nicio eroare?)");
  } catch (e) {
    console.log(`  ${e instanceof InvalidUpdateError ? "InvalidUpdateError" : "eroare"}: ${(e as Error).message.split("\n")[0]}`);
  }

  titlu("C. in paralel, CU reducer: ambele raman");
  const c = new StateGraph(StareCuReducer)
    .addNode("raspuns_client", async () => ({ pasi: ["raspuns_client"] }))
    .addNode("nota_interna", async () => ({ pasi: ["nota_interna"] }))
    .addNode("finalizeaza", async (s) => ({ pasi: [`finalizeaza (vede ${s.pasi.length} intrari)`] }))
    .addEdge(START, "raspuns_client")
    .addEdge(START, "nota_interna")
    .addEdge(["raspuns_client", "nota_interna"], "finalizeaza") // fan-in: asteapta ambele
    .addEdge("finalizeaza", END)
    .compile();
  console.log("  pasi =", (await c.invoke({})).pasi);
  console.log("\n  MessagesValue, pe care il folosim pentru mesaje, este tot un camp cu reducer.\n");
}

main().catch(console.error);

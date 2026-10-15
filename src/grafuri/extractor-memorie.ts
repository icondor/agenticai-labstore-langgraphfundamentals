// src/grafuri/extractor-memorie.ts
//
// ===========================================================================
// SCRIERE IN BACKGROUND: un graf LangGraph care extrage memorii DUPA conversatie
// ===========================================================================
//
// HOT PATH (demo3, demo5): modelul salveaza prin tool, IN TIMPUL conversatiei.
//   + memoria e disponibila imediat
//   - adauga latenta si complexitate; modelul isi imparte atentia intre
//     raspuns si memorie
//
// BACKGROUND (aici): conversatia se termina normal, fara tool-uri de memorie.
//   Apoi aplicatia porneste SEPARAT acest graf, care citeste conversatia,
//   extrage faptele stabile si actualizeaza profilul.
//   + zero latenta pentru utilizator, responsabilitati separate
//   - memoria NU e disponibila imediat; trebuie sa decizi CAND rulezi
//     (dupa fiecare conversatie? o data pe ora?)
//
// ELEMENTE LANGGRAPH 1.0 FOLOSITE AICI (le reluam in Partea 2)
//   new StateSchema({...})               starea grafului, cu Zod
//   new StateGraph(Stare, schemaContext) graful, cu forma contextului
//   graph.compile({ store })             Store-ul ajunge in fiecare nod
//   async (state, runtime) => ...        nodul primeste Runtime:
//                                        runtime.store si runtime.context

import { StateGraph, StateSchema, START, END, type GraphNode } from "@langchain/langgraph";
import type { BaseStore } from "@langchain/langgraph";
import { z } from "zod";
import { actualizeazaProfil, schemaProfil, type Profil } from "../lib/profil.js";
import { schemaContext } from "../tools/memorie.js";

/** Orice model care stie withStructuredOutput (real sau fals). */
type ModelExtractie = {
  withStructuredOutput: (schema: typeof schemaProfil) => { invoke: (input: string) => Promise<unknown> };
};

const Stare = new StateSchema({
  conversatie: z.string(), // textul conversatiei incheiate
  extras: z.record(z.string(), z.string()).default({}), // ce a gasit modelul
  profil: z.record(z.string(), z.string()).default({}), // profilul dupa actualizare
});

type Context = z.infer<typeof schemaContext>;

export function creeazaExtractor(model: ModelExtractie, store: BaseStore, optiuni: { intarziereMs?: number } = {}) {
  // Nodul 1: modelul citeste conversatia si intoarce DOAR fapte stabile, in forma profilului.
  const extrage: GraphNode<typeof Stare, Context> = async (state) => {
    if (optiuni.intarziereMs) await new Promise((r) => setTimeout(r, optiuni.intarziereMs)); // simuleaza latenta unui LLM
    const prompt =
      "Extrage din conversatie DOAR fapte stabile despre utilizator, spuse chiar de el " +
      "(nu din documente sau rezultate de tool-uri). Fara date de sanatate. Conversatia:\n" +
      state.conversatie;
    const extras = (await model.withStructuredOutput(schemaProfil).invoke(prompt)) as Profil;
    return { extras: extras as Record<string, string> };
  };

  // Nodul 2: scrie in Store. userId vine din runtime.context, niciodata din text.
  const salveaza: GraphNode<typeof Stare, Context> = async (state, runtime) => {
    const userId = runtime.context?.userId;
    if (!runtime.store || !userId) throw new Error("Extractorul cere compile({ store }) si context.userId.");
    const profil = await actualizeazaProfil(runtime.store, userId, state.extras);
    return { profil: profil as Record<string, string> };
  };

  return new StateGraph(Stare, schemaContext)
    .addNode("extrage", extrage)
    .addNode("salveaza", salveaza)
    .addEdge(START, "extrage")
    .addEdge("extrage", "salveaza")
    .addEdge("salveaza", END)
    .compile({ store });
}

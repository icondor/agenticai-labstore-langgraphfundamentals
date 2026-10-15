// src/triaj/graf-triaj.ts
//
// ===========================================================================
// GRAFUL DE TRIAJ: Lab 5 rescris in LangGraph
// ===========================================================================
//
//   START -> clasifica -> valideaza -> (conditional edge pe prioritate)
//                                        urgenta      -> escaladeaza -> raspuns_client + nota_interna
//                                        medie, joasa ->                raspuns_client + nota_interna
//            raspuns_client + nota_interna (in paralel) -> finalizeaza -> END
//
// CE AJUNGE UNDE, FATA DE LCEL (Lab 5)
//   prompt.pipe(classifier)      -> nodul clasifica (LLM, structured output)
//   (nu exista in Lab 5)         -> nodul valideaza (REGULA DE BUSINESS, in cod)
//   RunnableBranch               -> addConditionalEdges(valideaza, ruteaza, ...)
//   RunnableLambda escaladeaza   -> nodul escaladeaza
//   RunnableParallel             -> doua muchii care pleaca din acelasi punct
//                                   (fan-out) si se intalnesc in finalizeaza (fan-in)
//
// ELEMENTE NOI
//   StateSchema       starea grafului, descrisa cu Zod; fiecare nod citeste
//                     starea si intoarce DOAR campurile pe care le schimba
//   ReducedValue      camp cu reducer: `pasi` ADUNA intrarile, nu le suprascrie.
//                     Fara reducer, doua noduri paralele care scriu acelasi camp
//                     dau InvalidUpdateError (verificat).
//   addConditionalEdges(sursa, functie, destinatii posibile)

import { StateGraph, StateSchema, ReducedValue, START, END, type GraphNode } from "@langchain/langgraph";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { z } from "zod";
import { schemaTriaj, type Triaj } from "./schema.js";
import { textulMesajului } from "../lib/afisare.js";

/** Jurnalul pasilor: fiecare nod adauga o linie. Reducer = concatenare. */
export const campPasi = () =>
  new ReducedValue(z.array(z.string()).default(() => []), {
    reducer: (existente: string[], noi: string[]) => [...existente, ...noi],
  });

export const StareTriaj = new StateSchema({
  ticket: z.string(),
  triaj: schemaTriaj.optional(), // completat de clasifica
  raspunsClient: z.string().default(""),
  notaInterna: z.string().default(""),
  escaladat: z.boolean().default(false),
  pasi: campPasi(),
});

/** Tonul raspunsului, ca in Lab 5: depinde de prioritate. */
export function tonPentru(prioritate: Triaj["prioritate"]): string {
  if (prioritate === "urgenta") return "empatic si rapid";
  if (prioritate === "medie") return "profesionist si clar";
  return "prietenos si concis";
}

/**
 * Regula de business, in COD, nu in prompt: facturarea nu e niciodata «joasa».
 * Modelul poate clasifica gresit; regula asta se aplica mereu.
 */
export function aplicaReguli(t: Triaj): { triaj: Triaj; motiv?: string } {
  if (t.categorie === "facturare" && t.prioritate === "joasa") {
    return { triaj: { ...t, prioritate: "medie" }, motiv: "facturare ridicata de la joasa la medie" };
  }
  return { triaj: t };
}

/** Functia de rutare: citeste starea, intoarce NUMELE nodului (sau nodurilor) urmator. */
export function ruteaza(s: { triaj?: Triaj }): "escaladeaza" | ["raspuns_client", "nota_interna"] {
  return s.triaj?.prioritate === "urgenta" ? "escaladeaza" : ["raspuns_client", "nota_interna"];
}

/** Nodurile grafului, separat de legaturi (le refolosim in exercitiu). */
export function noduriTriaj(model: BaseChatModel) {
  const clasificator = model.withStructuredOutput(schemaTriaj, { name: "triaj" });

  const clasifica: GraphNode<typeof StareTriaj> = async (s) => {
    const triaj = (await clasificator.invoke([
      {
        role: "system",
        content:
          "Esti sistemul de triaj al unei echipe de suport. Clasifica tichetul. Fii strict cu prioritatea: " +
          '"urgenta" doar daca ceva e nefunctional sau blocheaza un client care plateste.',
      },
      { role: "user", content: `Tichet:\n${s.ticket}` },
    ])) as Triaj;
    return { triaj, pasi: [`clasifica: ${triaj.categorie}, ${triaj.prioritate}`] };
  };

  const valideaza: GraphNode<typeof StareTriaj> = async (s) => {
    const { triaj, motiv } = aplicaReguli(s.triaj!);
    return { triaj, pasi: [`valideaza: ${motiv ?? "fara modificari"}`] };
  };

  const escaladeaza: GraphNode<typeof StareTriaj> = async () => ({
    escaladat: true,
    pasi: ["escaladeaza: anunta on-call (PagerDuty)"],
  });

  const raspunsClient: GraphNode<typeof StareTriaj> = async (s) => {
    const r = await model.invoke([
      {
        role: "system",
        content: `Esti agent de suport. Scrie un raspuns ${tonPentru(s.triaj!.prioritate)} catre client, in romana, maxim 4 propozitii. Nu inventa solutii tehnice.`,
      },
      { role: "user", content: `Rezumatul problemei: ${s.triaj!.rezumat}\nCategorie: ${s.triaj!.categorie}` },
    ]);
    return { raspunsClient: textulMesajului(r), pasi: ["raspuns_client: gata"] };
  };

  const notaInterna: GraphNode<typeof StareTriaj> = async (s) => {
    const r = await model.invoke([
      {
        role: "system",
        content: "Scrie o nota interna scurta pentru echipa de suport: ce trebuie facut, cui se atribuie (dev/billing/support), maxim 2 propozitii.",
      },
      { role: "user", content: `Categorie: ${s.triaj!.categorie}\nPrioritate: ${s.triaj!.prioritate}\nProblema: ${s.triaj!.rezumat}` },
    ]);
    return { notaInterna: textulMesajului(r), pasi: ["nota_interna: gata"] };
  };

  // Ruleaza o singura data, dupa ce AMBELE ramuri paralele s-au terminat.
  const finalizeaza: GraphNode<typeof StareTriaj> = async (s) => ({
    pasi: [`finalizeaza: ${s.raspunsClient ? "raspuns" : "FARA raspuns"} + ${s.notaInterna ? "nota" : "FARA nota"}`],
  });

  return { clasifica, valideaza, escaladeaza, raspunsClient, notaInterna, finalizeaza };
}

export function creeazaGrafTriaj(model: BaseChatModel) {
  const { clasifica, valideaza, escaladeaza, raspunsClient, notaInterna, finalizeaza } = noduriTriaj(model);
  return new StateGraph(StareTriaj)
    .addNode("clasifica", clasifica)
    .addNode("valideaza", valideaza)
    .addNode("escaladeaza", escaladeaza)
    .addNode("raspuns_client", raspunsClient)
    .addNode("nota_interna", notaInterna)
    .addNode("finalizeaza", finalizeaza)
    .addEdge(START, "clasifica")
    .addEdge("clasifica", "valideaza")
    .addConditionalEdges("valideaza", ruteaza, ["escaladeaza", "raspuns_client", "nota_interna"])
    .addEdge("escaladeaza", "raspuns_client")
    .addEdge("escaladeaza", "nota_interna")
    .addEdge(["raspuns_client", "nota_interna"], "finalizeaza") // fan-in: asteapta ambele
    .addEdge("finalizeaza", END)
    .compile();
}

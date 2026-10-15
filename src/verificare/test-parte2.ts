// src/verificare/test-parte2.ts
//
// ===========================================================================
// VERIFICARE: Lab 12, Partea 2. Fara chei, cu modele false.
// ===========================================================================
//
// Rulare:  pnpm verifica2
//
// Demo-urile din Partea 2 cer un model real. Aici verificam MECANISMUL
// grafurilor (rutare, paralelism, reducers, ciclu, memorie ca noduri) cu
// FakeToolCallingModel, care intoarce raspunsuri fixe. Calitatea clasificarii
// unui model real NU se verifica aici.

import { createAgent, FakeToolCallingModel } from "langchain";
import { HumanMessage } from "@langchain/core/messages";
import { StateGraph, StateSchema, ReducedValue, InMemoryStore, START, END, InvalidUpdateError, GraphRecursionError } from "@langchain/langgraph";
import { z } from "zod";
import { creeazaGrafTriaj, ruteaza, aplicaReguli } from "../triaj/graf-triaj.js";
import { creeazaReactDeMana } from "../triaj/react-de-mana.js";
import { toolsSuport } from "../triaj/tools-suport.js";
import { creeazaTriajCuMemorie, spatiuTichete, aplicaRecurenta } from "../triaj/triaj-cu-memorie.js";
import { creeazaGrafCuDetalii, ruteazaCuDetalii } from "../parte2/exercitiu2-referinta.js";
import type { Triaj } from "../triaj/schema.js";

let trecute = 0;
let picate = 0;
function verifica(nume: string, conditie: boolean, detaliu?: unknown) {
  if (conditie) {
    trecute++;
    console.log(`  ok    ${nume}`);
  } else {
    picate++;
    console.log(`  PICAT ${nume}${detaliu !== undefined ? `   (${JSON.stringify(detaliu)})` : ""}`);
  }
}

const fals = (triaj: Triaj) => new FakeToolCallingModel({ structuredResponse: triaj });
const T = (categorie: Triaj["categorie"], prioritate: Triaj["prioritate"]): Triaj => ({ categorie, prioritate, rezumat: "rezumat" });

async function main() {
  console.log("\nA. Graful de triaj");
  {
    const r = await creeazaGrafTriaj(fals(T("bug", "urgenta"))).invoke({ ticket: "t" });
    verifica("urgenta: trece prin escaladeaza", r.escaladat === true && r.pasi.some((p) => p.startsWith("escaladeaza")), r.pasi);
    verifica("urgenta: raspuns_client si nota_interna ruleaza amandoua", !!r.raspunsClient && !!r.notaInterna);
    verifica("finalizeaza ruleaza o singura data (fan-in)", r.pasi.filter((p) => p.startsWith("finalizeaza")).length === 1, r.pasi);
    verifica("jurnalul pastreaza toti pasii (ReducedValue)", r.pasi.length === 6, r.pasi);

    const f = await creeazaGrafTriaj(fals(T("facturare", "joasa"))).invoke({ ticket: "t" });
    verifica("regula in cod: facturare joasa devine medie", f.triaj?.prioritate === "medie" && !f.escaladat, f.triaj);

    const j = await creeazaGrafTriaj(fals(T("functionalitate", "joasa"))).invoke({ ticket: "t" });
    verifica("functionalitate joasa: ramane joasa, fara escaladare", j.triaj?.prioritate === "joasa" && !j.escaladat);

    verifica("ruteaza: urgenta -> escaladeaza", ruteaza({ triaj: T("bug", "urgenta") }) === "escaladeaza");
    verifica("ruteaza: medie -> ambele noduri in paralel", JSON.stringify(ruteaza({ triaj: T("bug", "medie") })) === '["raspuns_client","nota_interna"]');
    verifica("aplicaReguli nu atinge bug-urile", aplicaReguli(T("bug", "joasa")).triaj.prioritate === "joasa");

    const m = (await creeazaGrafTriaj(fals(T("bug", "medie"))).getGraphAsync()).drawMermaid();
    verifica("diagrama: muchie conditionala valideaza -.-> escaladeaza", m.includes("valideaza -.-> escaladeaza"));
    verifica("diagrama: fan-in spre finalizeaza din ambele noduri", m.includes("raspuns_client --> finalizeaza") && m.includes("nota_interna --> finalizeaza"));
  }

  console.log("\nB. Reducers");
  {
    const Simpla = new StateSchema({ pasi: z.array(z.string()).default([]) });
    const paralel = new StateGraph(Simpla)
      .addNode("a", async () => ({ pasi: ["a"] }))
      .addNode("b", async () => ({ pasi: ["b"] }))
      .addEdge(START, "a").addEdge(START, "b").addEdge("a", END).addEdge("b", END).compile();
    let eroare: unknown;
    try { await paralel.invoke({}); } catch (e) { eroare = e; }
    verifica("fara reducer, doua noduri paralele pe acelasi camp: InvalidUpdateError", eroare instanceof InvalidUpdateError);

    const secv = new StateGraph(Simpla)
      .addNode("a", async () => ({ pasi: ["a"] }))
      .addNode("b", async () => ({ pasi: ["b"] }))
      .addEdge(START, "a").addEdge("a", "b").addEdge("b", END).compile();
    verifica("fara reducer, secvential: ultimul castiga", JSON.stringify((await secv.invoke({})).pasi) === '["b"]');

    const CuReducer = new StateSchema({ pasi: new ReducedValue(z.array(z.string()).default(() => []), { reducer: (x: string[], y: string[]) => [...x, ...y] }) });
    const ok = new StateGraph(CuReducer)
      .addNode("a", async () => ({ pasi: ["a"] }))
      .addNode("b", async () => ({ pasi: ["b"] }))
      .addEdge(START, "a").addEdge(START, "b").addEdge("a", END).addEdge("b", END).compile();
    const p = (await ok.invoke({})).pasi;
    verifica("cu reducer: ambele valori raman", p.length === 2 && p.includes("a") && p.includes("b"), p);
  }

  console.log("\nC. ReAct scris de mana");
  {
    const model = new FakeToolCallingModel({ toolCalls: [[{ name: "cautaFacturi", args: { clientId: "beta-srl", luna: "2026-10" }, id: "1" }], []] });
    const r = await creeazaReactDeMana(model, toolsSuport, "sistem").invoke({ messages: [new HumanMessage("factura dubla?")] });
    const tipuri = r.messages.map((m) => m.getType()).join(",");
    verifica("bucla: human, ai (tool call), tool, ai (final)", tipuri === "human,ai,tool,ai", tipuri);
    verifica("tool-ul a rulat cu argumentele cerute de model", String(r.messages[2].content).includes("F-1042"), r.messages[2].content);

    // Un ciclu care nu se opreste. (Nu folosim modelul fals aici: el da tuturor
    // mesajelor AI acelasi id, reducerul de mesaje le contopeste si bucla se
    // opreste din alt motiv. Testam direct mecanismul recursionLimit.)
    const infinit = new StateGraph(new StateSchema({ n: z.number() }))
      .addNode("pas", async (s) => ({ n: s.n + 1 }))
      .addEdge(START, "pas")
      .addConditionalEdges("pas", () => "pas", ["pas"])
      .compile();
    let eroare: unknown;
    try { await infinit.invoke({ n: 0 }, { recursionLimit: 6 }); } catch (e) { eroare = e; }
    verifica("ciclu fara oprire: GraphRecursionError la recursionLimit", eroare instanceof GraphRecursionError);

    const noi = (await creeazaReactDeMana(model, toolsSuport, "s").getGraphAsync()).drawMermaid();
    const agent = createAgent({ model: new FakeToolCallingModel({ toolCalls: [[]] }), tools: toolsSuport });
    const ei = await agent.drawMermaid();
    verifica("diagrama noastra: ciclu tools --> model si iesire conditionala spre END", noi.includes("tools --> model") && noi.includes("model -.-> __end__"));
    verifica("diagrama createAgent: aceeasi forma (model_request, tools, ciclu)", ei.includes("tools --> model_request") && ei.includes("model_request -.-> tools"));
  }

  console.log("\nD. Memoria ca noduri");
  {
    const store = new InMemoryStore();
    const graf = creeazaTriajCuMemorie(fals(T("bug", "medie")), store);
    const r1 = await graf.invoke({ ticket: "unu" }, { context: { clientId: "acme" } });
    const r2 = await graf.invoke({ ticket: "doi" }, { context: { clientId: "acme" } });
    const rg = await graf.invoke({ ticket: "altul" }, { context: { clientId: "gamma" } });
    const r3 = await graf.invoke({ ticket: "trei" }, { context: { clientId: "acme" } });
    verifica("incarca_istoric: 0, apoi 1, apoi 2 tichete anterioare", r1.istoric.length === 0 && r2.istoric.length === 1 && r3.istoric.length === 2);
    verifica("al treilea tichet din aceeasi categorie devine urgenta (regula de recurenta)", r1.triaj?.prioritate === "medie" && r3.triaj?.prioritate === "urgenta", r3.pasi);
    verifica("alt client are istoricul lui (izolare pe namespace)", rg.istoric.length === 0 && rg.triaj?.prioritate === "medie");
    verifica("Store-ul are 3 tichete pentru acme, 1 pentru gamma", (await store.search(spatiuTichete("acme"))).length === 3 && (await store.search(spatiuTichete("gamma"))).length === 1);
    let eroare = "";
    try { await graf.invoke({ ticket: "x" }); } catch (e) { eroare = String((e as Error).message); }
    verifica("fara context.clientId: eroare (nu ruleaza tacut)", eroare.length > 0, eroare.slice(0, 80));
    verifica("aplicaRecurenta: categorii diferite nu escaladeaza", aplicaRecurenta(T("bug", "medie"), [{ categorie: "facturare" }, { categorie: "facturare" }]).triaj.prioritate === "medie");
    const m = (await graf.getGraphAsync()).drawMermaid();
    verifica("diagrama: memoria apare ca noduri", m.includes("incarca_istoric") && m.includes("salveaza_tichet"));
  }

  console.log("\nE. Exercitiu (referinta)");
  {
    const g = creeazaGrafCuDetalii(fals(T("bug", "medie")));
    const scurt = await g.invoke({ ticket: "Nu merge." });
    verifica("tichet scurt: trece prin cere_detalii, fara nota interna", scurt.pasi.some((p) => p.startsWith("cere_detalii")) && !scurt.notaInterna, scurt.pasi);
    const lung = await g.invoke({ ticket: "Exportul de rapoarte da eroare 500 de ieri, cand apasam pe Genereaza." });
    verifica("tichet lung: drumul normal, cu raspuns si nota", !!lung.raspunsClient && !!lung.notaInterna && !lung.pasi.some((p) => p.startsWith("cere_detalii")));
    verifica("ruteazaCuDetalii verifica lungimea inainte de prioritate", ruteazaCuDetalii({ ticket: "Totul e cazut", triaj: T("bug", "urgenta") }) === "cere_detalii");
    verifica("diagrama contine nodul nou", (await g.getGraphAsync()).drawMermaid().includes("cere_detalii"));
  }

  console.log(`\nREZULTAT: ${trecute} trecute, ${picate} picate.\n`);
  process.exit(picate === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

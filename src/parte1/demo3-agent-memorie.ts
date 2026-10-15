// src/parte1/demo3-agent-memorie.ts
//
// ===========================================================================
// DEMO 3: AGENT CU MEMORIE PE TERMEN LUNG (prin tool-uri)
// ===========================================================================
//
// Rulare:  pnpm demo3        (cere un model real)
//
// CE ARATAM
//   Acelasi tip de agent ca la Demo 1, dar cu un Store si trei tool-uri de
//   memorie. Trei conversatii:
//     conv-1 (ionel): spune ce prefera       -> agentul SALVEAZA
//     conv-2 (ionel): cere o recomandare      -> agentul CAUTA si tine cont
//     conv-3 (ana):   "ce stii despre mine?"  -> nu gaseste nimic al lui ionel
//
// ELEMENTE NOI
//   createAgent({ store })          Store-ul ajunge in tool-uri, ca runtime.store
//   createAgent({ contextSchema })  forma contextului: { userId }
//   invoke(input, { context })      aplicatia spune CUI apartine rularea (runtime.context)
//
// CE TREBUIE SA VEZI IN CONSOLA
//   Pasii fiecarei conversatii (ce tool-uri a chemat modelul) si, la final,
//   continutul Store-ului citit din AFARA conversatiei. Asta e dovada: nu
//   "pare ca isi aminteste", ci "iata ce e scris, pe utilizator".
//
// DE CE E O DEMONSTRATIE IMPERFECTA (si e bine sa o spui)
//   1. Modelul DECIDE daca salveaza si daca cauta (scriere si citire in HOT
//      PATH, prin tool-uri). Poate uita sa cheme cautaMemorie si sa recomande
//      un hotel zgomotos. Demo 5 rezolva citirea.
//   2. Store-ul de aici NU are index. cautaMemorie primeste un query, dar
//      fara index query-ul ar fi ignorat in tacere. De aceea tool-ul listeaza
//      TOATE amintirile si spune asta in rezultat ("nu s-a cautat dupa sens").
//      Cautarea dupa sens vine in Demo 4.

import "../lib/env.js";
import { createAgent } from "langchain";
import { MemorySaver } from "@langchain/langgraph";
import { createModel, readProviderFromEnv } from "../lib/llm.js";
import { creeazaStoreSimplu, spatiuMemorii } from "../lib/store.js";
import { schemaContext, toolMemorie } from "../tools/memorie.js";
import { afiseazaPasii, titlu } from "../lib/afisare.js";

const store = creeazaStoreSimplu();

const agent = createAgent({
  model: createModel(readProviderFromEnv()),
  tools: toolMemorie,
  systemPrompt:
    "Esti asistentul personal de calatorii al unei agentii de turism. Raspunzi scurt, in romana.\n" +
    "Reguli de memorie:\n" +
    "- Cand utilizatorul iti spune o preferinta, o restrictie sau un fapt stabil despre el, salveaza-l cu salveazaMemorie.\n" +
    "- INAINTE sa recomanzi ceva sau cand te intreaba ce stii despre el, cheama cautaMemorie.\n" +
    "- Nu salva ce a intrebat acum si nu salva date sensibile.\n" +
    "- Cand utilizatorul cere sa uiti ceva sau o informatie nu mai e adevarata, cheama stergeMemorie cu id-ul amintirii.",
  contextSchema: schemaContext, // forma contextului: { userId }
  store, // Store-ul ajunge in tool-uri prin runtime.store
  checkpointer: new MemorySaver(), // conversatia ramane pe thread, memoria pe user
});

async function conversatie(userId: string, threadId: string, text: string) {
  console.log(`\n[${userId} / ${threadId}] > ${text}`);
  const rezultat = await agent.invoke(
    { messages: [{ role: "user", content: text }] },
    // thread_id = conversatia. context.userId = utilizatorul (vine din login, NU de la model).
    { configurable: { thread_id: threadId }, context: { userId } },
  );
  afiseazaPasii(rezultat.messages);
}

async function main() {
  titlu("DEMO 3: memorie pe termen lung, prin tool-uri");

  await conversatie(
    "ionel",
    "conv-1",
    "Salut! Prefer hoteluri linistite, fara galagie. Nu mananc fructe de mare si calatoresc des cu doi copii.",
  );
  await conversatie("ionel", "conv-2", "Vreau o recomandare de cazare la Roma pentru 3 nopti.");
  await conversatie("ana", "conv-3", "Ce stii despre mine?");

  titlu("DOVADA: continutul Store-ului, citit din afara conversatiei");
  for (const userId of ["ionel", "ana"]) {
    const items = await store.search(spatiuMemorii(userId), { limit: 100 });
    console.log(`\n  ${userId}: ${items.length} amintiri`);
    for (const i of items) console.log(`    [${i.key}] ${i.value.text} (${i.value.categorie})`);
  }
  console.log(
    "\nconv-2 a fost un THREAD NOU, deci checkpointer-ul nu avea nimic din conv-1.\n" +
      "Daca recomandarea tine cont de preferinte, informatia a venit din Store.\n",
  );
}

main().catch(console.error);

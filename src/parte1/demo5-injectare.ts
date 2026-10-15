// src/parte1/demo5-injectare.ts
//
// ===========================================================================
// DEMO 5: MEMORIA CITITA AUTOMAT (middleware), nu la latitudinea modelului
// ===========================================================================
//
// Rulare:  pnpm demo5        (cere un model real)
//
// DIFERENTA FATA DE DEMO 3
//   Demo 3: modelul are cautaMemorie si DECIDE daca o cheama.
//   Demo 5: middleware-ul memorieAutomata citeste Store-ul la FIECARE apel de
//           model si pune amintirile in system prompt. Modelul primeste doar
//           salveazaMemorie si stergeMemorie, nu mai are tool de citire.
//
// DE CE (legatura cu Lab 9)
//   Citirea memoriei e un invariant: "intotdeauna stii ce stii despre
//   utilizator". Invariantele merg in cod, nu in prompt. Scrierea ramane
//   discretionara: modelul stie ce merita retinut din ce a spus omul.
//
// CE TREBUIE SA VEZI
//   In conv-2 NU apare niciun tool call de cautare, dar linia [memorie]
//   arata ca amintirile au fost injectate, iar recomandarea tine cont de ele.
//
// STERGEREA FUNCTIONEAZA SI AICI
//   Modelul nu are cautaMemorie, dar middleware-ul injecteaza fiecare amintire
//   cu id-ul ei ([a1b2c3d4] ...). In conv-4 omul cere sa uitam ceva, iar
//   modelul poate chema stergeMemorie cu id-ul vazut in instructiuni.
//
// NOTA: aici folosim Store-ul simplu (fara index). Fara index nu se poate
//   cauta dupa sens, deci middleware-ul injecteaza TOATE amintirile (linia
//   [memorie] spune "fara index, toate"). Pentru semantic search inlocuiesti
//   creeazaStoreSimplu() cu await creeazaStoreSemantic(creeazaEmbeddingsPentruMemorie()).

import "../lib/env.js";
import { createAgent } from "langchain";
import { MemorySaver } from "@langchain/langgraph";
import { createModel, readProviderFromEnv } from "../lib/llm.js";
import { creeazaStoreSimplu, spatiuMemorii } from "../lib/store.js";
import { salveazaMemorie, schemaContext, stergeMemorie } from "../tools/memorie.js";
import { memorieAutomata } from "../middleware/memorie-automata.js";
import { afiseazaPasii, titlu } from "../lib/afisare.js";

const store = creeazaStoreSimplu();

const agent = createAgent({
  model: createModel(readProviderFromEnv()),
  tools: [salveazaMemorie, stergeMemorie], // fara cautaMemorie: citirea e in middleware
  systemPrompt:
    "Esti asistentul personal de calatorii al unei agentii de turism. Raspunzi scurt, in romana.\n" +
    "Cand utilizatorul iti spune o preferinta, o restrictie sau un fapt stabil despre el, salveaza-l cu salveazaMemorie.\n" +
    "Nu salva ce a intrebat acum si nu salva date sensibile.\n" +
    "Cand utilizatorul cere sa uiti ceva sau o informatie nu mai e adevarata, cheama stergeMemorie cu id-ul amintirii.",
  middleware: [memorieAutomata({ verbose: true })] as const,
  contextSchema: schemaContext,
  store,
  checkpointer: new MemorySaver(),
});

async function conversatie(userId: string, threadId: string, text: string) {
  console.log(`\n[${userId} / ${threadId}] > ${text}`);
  const rezultat = await agent.invoke(
    { messages: [{ role: "user", content: text }] },
    { configurable: { thread_id: threadId }, context: { userId } },
  );
  afiseazaPasii(rezultat.messages);
}

async function main() {
  titlu("DEMO 5: memoria injectata de middleware");

  await conversatie(
    "ionel",
    "conv-1",
    "Salut! Prefer hoteluri linistite, fara galagie. Nu mananc fructe de mare si calatoresc des cu doi copii.",
  );
  await conversatie("ionel", "conv-2", "Vreau o recomandare de cazare la Roma pentru 3 nopti.");
  await conversatie("ana", "conv-3", "Ce stii despre mine?");
  await conversatie("ionel", "conv-4", "Am inceput sa mananc fructe de mare. Te rog sa uiti ce ti-am spus despre asta.");

  titlu("DOVADA: Store-ul, citit din afara");
  for (const userId of ["ionel", "ana"]) {
    const items = await store.search(spatiuMemorii(userId), { limit: 100 });
    console.log(`  ${userId}: ${items.length} amintiri ${items.map((i) => `"${i.value.text}"`).join(", ")}`);
  }
  console.log();
}

main().catch(console.error);

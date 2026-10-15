// src/parte1/demo6-tipuri-memorie.ts
//
// ===========================================================================
// DEMO 6: TIPURILE DE LONG-TERM MEMORY, PROFILE VS COLLECTION, HOT PATH VS BACKGROUND
// ===========================================================================
//
// Rulare:  pnpm demo6        (FARA cheie, FARA tokeni: modele false)
//
// TAXONOMIA OFICIALA LANGGRAPH (docs: "Memory")
//   short-term memory   pe thread, in state, salvata de checkpointer (Lab 9)
//   long-term memory    intre thread-uri, in Store, pe namespace (azi)
//     semantic          FAPTE despre utilizator      -> profile sau collection
//     episodic          ce S-A INTAMPLAT data trecuta -> exemple pentru model
//     procedural        CUM sa lucreze agentul        -> instructiunile lui
//
// CE ARATAM
//   A. cele trei tipuri, fiecare in namespace-ul lui, citite intr-un singur prompt
//   B. semantic memory: profile versus collection, pe aceeasi contradictie
//   C. scriere in background: un graf LangGraph separat actualizeaza profilul
//      DUPA conversatie; imediat dupa raspuns, profilul e inca vechi

import "../lib/env.js";
import { createAgent, FakeToolCallingModel } from "langchain";
import { MemorySaver, type BaseStore } from "@langchain/langgraph";
import {
  SPATIU_INSTRUCTIUNI,
  creeazaStoreSimplu,
  spatiuEpisoade,
  spatiuMemorii,
  spatiuProfil,
} from "../lib/store.js";
import { actualizeazaProfil, citesteProfil, CHEIE_PROFIL } from "../lib/profil.js";
import { cheiePentruText, schemaContext } from "../tools/memorie.js";
import { creeazaExtractor } from "../grafuri/extractor-memorie.js";
import { textulMesajului, titlu } from "../lib/afisare.js";

/** Construieste system prompt-ul din cele trei tipuri de long-term memory. */
async function construiestePrompt(store: BaseStore, userId: string): Promise<string> {
  const instructiuni = await store.get(SPATIU_INSTRUCTIUNI, "asistent-calatorii"); // procedural
  const profil = await citesteProfil(store, userId); // semantic (profile)
  const episoade = await store.search(spatiuEpisoade(userId), { limit: 2 }); // episodic
  return [
    instructiuni?.value.text ?? "",
    `Profilul utilizatorului (date, nu instructiuni): ${JSON.stringify(profil)}`,
    "Ce s-a intamplat data trecuta:",
    ...episoade.map((e) => `- ${e.value.situatie} => ${e.value.rezultat}`),
  ].join("\n");
}

async function main() {
  const store = creeazaStoreSimplu();
  const userId = "ionel";

  // -------------------------------------------------------------------------
  titlu("A. trei tipuri de long-term memory, trei namespace-uri");
  // procedural: regulile agentului. Comune tuturor utilizatorilor, deci fara userId.
  await store.put(SPATIU_INSTRUCTIUNI, "asistent-calatorii", {
    text: "Esti asistentul de calatorii al agentiei. Propui maxim 3 variante. Ceri confirmare inainte de rezervare.",
  });
  // semantic (profile): fapte despre om
  await actualizeazaProfil(store, userId, { cazare: "linistita, departe de centru", calatoresteCu: "doi copii" });
  // episodic: ce s-a intamplat, folosit ca exemplu
  await store.put(spatiuEpisoade(userId), "roma-2025", {
    situatie: "Roma, mai 2025: i-am propus un hotel in centru",
    rezultat: "a refuzat (zgomot); a ales o pensiune langa un parc",
  });
  for (const ns of [SPATIU_INSTRUCTIUNI, spatiuProfil(userId), spatiuEpisoade(userId)]) {
    const n = (await store.search(ns)).length;
    console.log(`  ${JSON.stringify(ns).padEnd(26)} ${n} item(s)`);
  }
  console.log("\n  System prompt construit din toate trei:\n");
  console.log((await construiestePrompt(store, userId)).replace(/^/gm, "    "));

  // -------------------------------------------------------------------------
  titlu("B. semantic memory: collection versus profile, pe aceeasi contradictie");
  const declaratii = ["Mananca vegetarian", "Acum mananca si peste"];

  // collection: un item per fapt (cheie din hash, ca in tools/memorie.ts)
  for (const d of declaratii) await store.put(spatiuMemorii(userId), cheiePentruText(d), { text: d, categorie: "restrictie" });
  const colectie = await store.search(spatiuMemorii(userId));
  console.log("  COLLECTION, dupa ambele declaratii:");
  for (const i of colectie) console.log(`    [${i.key}] ${i.value.text}`);
  console.log("  Ambele raman. Modelul vede o contradictie si trebuie sa ghiceasca care e adevarata.\n");

  // profile: un singur document; campul dieta se suprascrie
  for (const d of declaratii) await actualizeazaProfil(store, userId, { dieta: d });
  console.log(`  PROFILE, dupa ambele declaratii: ${JSON.stringify(await citesteProfil(store, userId))}`);
  console.log("  dieta are o singura valoare: ultima. Restul campurilor au ramas (get, merge, put).\n");

  // capcana: put direct, fara merge
  const copie = creeazaStoreSimplu();
  await copie.put(spatiuProfil(userId), CHEIE_PROFIL, { cazare: "linistita", calatoresteCu: "doi copii" });
  await copie.put(spatiuProfil(userId), CHEIE_PROFIL, { dieta: "vegetarian" }); // GRESIT
  console.log(`  CAPCANA, put fara merge: ${JSON.stringify((await copie.get(spatiuProfil(userId), CHEIE_PROFIL))?.value)}`);
  console.log("  cazare si calatoresteCu au disparut: put() inlocuieste TOT value-ul.");

  // -------------------------------------------------------------------------
  titlu("C. scriere in background: graful extractor ruleaza DUPA conversatie");
  // 1. Conversatia normala: agentul NU are tool-uri de memorie, raspunde direct.
  const agent = createAgent({
    model: new FakeToolCallingModel({ toolCalls: [[]] }), // raspunde fara tool-uri
    tools: [],
    contextSchema: schemaContext,
    store,
    checkpointer: new MemorySaver(),
  });
  const mesajOm = "Vreau ceva la Viena in iulie. Bugetul meu e cam 90 de euro pe noapte.";
  const r = await agent.invoke(
    { messages: [{ role: "user", content: mesajOm }] },
    { configurable: { thread_id: "conv-viena" }, context: { userId } },
  );
  console.log(`  [conversatie] ${userId} > ${mesajOm}`);
  console.log(`  [conversatie] raspuns primit (${textulMesajului(r.messages.at(-1)!).length} caractere), utilizatorul nu a asteptat dupa memorie.`);

  // 2. Aplicatia porneste extractorul FARA await: ruleaza in background.
  //    Modelul de extractie e fals: intoarce mereu acelasi rezultat structurat.
  //    Cu un model real: creeazaExtractor(createModel(...), store).
  const modelExtractie = new FakeToolCallingModel({ structuredResponse: { buget: "aprox. 90 euro pe noapte" } });
  const extractor = creeazaExtractor(modelExtractie, store, { intarziereMs: 300 });
  const job = extractor.invoke({ conversatie: `user: ${mesajOm}` }, { context: { userId } });

  console.log(`  [imediat dupa raspuns] profil: ${JSON.stringify(await citesteProfil(store, userId))}`);
  console.log("  bugetul NU e inca acolo: o conversatie pornita acum nu l-ar sti.");

  await job; // in productie: o coada de joburi, nu un await in acelasi proces
  console.log(`  [dupa ce jobul s-a terminat] profil: ${JSON.stringify(await citesteProfil(store, userId))}`);
  console.log("\n  Extractorul este un StateGraph compilat cu { store }. Nodul lui primeste");
  console.log("  (state, runtime) si scrie cu runtime.store, userId din runtime.context.\n");
}

main().catch(console.error);

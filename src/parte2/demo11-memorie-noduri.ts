// src/parte2/demo11-memorie-noduri.ts
//
// ===========================================================================
// DEMO 11: MEMORIA CA NODURI IN GRAF
// ===========================================================================
//
// Rulare:  pnpm demo11       (cere un model real)
//
// CE ARATAM
//   Clientul «acme» trimite trei tichete despre probleme asemanatoare, in trei
//   rulari separate. Graful citeste istoricul clientului din Store (nod inainte
//   de model) si salveaza fiecare tichet (nod dupa decizie).
//   La al treilea tichet din aceeasi categorie, regula de recurenta din cod il
//   face «urgenta». Clientul «gamma» are istoricul lui, separat.
//
// DE URMARIT
//   - linia incarca_istoric: 0, apoi 1, apoi 2 tichete anterioare
//   - linia valideaza: la al treilea tichet, «recurent» (daca modelul a pus
//     aceeasi categorie de fiecare data; modelul poate varia)
//   - la final, Store-ul citit din afara grafului

import "../lib/env.js";
import { InMemoryStore } from "@langchain/langgraph";
import { createModel, readProviderFromEnv } from "../lib/llm.js";
import { mermaidCurat, titlu } from "../lib/afisare.js";
import { creeazaTriajCuMemorie, spatiuTichete } from "../triaj/triaj-cu-memorie.js";

const store = new InMemoryStore();
const graf = creeazaTriajCuMemorie(createModel(readProviderFromEnv()), store);

const RULARI = [
  { clientId: "acme", ticket: "Exportul de rapoarte da eroare 500 de ieri." },
  { clientId: "acme", ticket: "Rapoartele nu se mai genereaza, primim o eroare." },
  { clientId: "gamma", ticket: "Ar fi util un export in Excel." },
  { clientId: "acme", ticket: "Iar nu merg rapoartele, a treia oara saptamana asta." },
];

async function main() {
  for (const [i, { clientId, ticket }] of RULARI.entries()) {
    titlu(`DEMO 11: rularea ${i + 1}, client ${clientId}`);
    console.log(`> ${ticket}`);
    const r = await graf.invoke({ ticket }, { context: { clientId } });
    for (const p of r.pasi) console.log(`  - ${p}`);
    console.log(`  triaj final: ${r.triaj?.categorie}, ${r.triaj?.prioritate}`);
  }

  titlu("DOVADA: Store-ul, citit din afara grafului");
  for (const clientId of ["acme", "gamma"]) {
    const iteme = await store.search(spatiuTichete(clientId), { limit: 20 });
    console.log(`  ${clientId}: ${iteme.map((x) => `[${x.value.categorie}] ${x.value.rezumat}`).join(" | ")}`);
  }

  titlu("Graful (memoria este vizibila ca noduri)");
  console.log(mermaidCurat((await graf.getGraphAsync()).drawMermaid()));
}

main().catch(console.error);

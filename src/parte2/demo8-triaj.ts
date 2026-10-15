// src/parte2/demo8-triaj.ts
//
// ===========================================================================
// DEMO 8: TRIAJUL DIN LAB 5, CA GRAF
// ===========================================================================
//
// Rulare:  pnpm demo8        (cere un model real)
//
// CE ARATAM
//   Trei tichete, fiecare pe alta ramura:
//     urgent    -> escaladeaza, apoi raspuns + nota in paralel
//     facturare -> regula din cod ridica prioritatea de la joasa la medie (daca modelul zice joasa)
//     idee      -> drum normal, fara escaladare
//   Pentru fiecare: jurnalul `pasi` (ce noduri au rulat, in ce ordine) si rezultatul.
//   La final: diagrama grafului.
//
// DE URMARIT
//   - raspuns_client si nota_interna ruleaza in acelasi pas (in paralel);
//     ordinea lor in jurnal poate varia.
//   - finalizeaza ruleaza o singura data, dupa ambele.
//   - Comportamentul modelului variaza: o alta rulare poate clasifica altfel.

import "../lib/env.js";
import { createModel, readProviderFromEnv } from "../lib/llm.js";
import { mermaidCurat, titlu } from "../lib/afisare.js";
import { creeazaGrafTriaj } from "../triaj/graf-triaj.js";
import { TICHETE } from "../triaj/schema.js";

const graf = creeazaGrafTriaj(createModel(readProviderFromEnv()));

async function main() {
  for (const [nume, t] of Object.entries(TICHETE)) {
    titlu(`DEMO 8: tichetul «${nume}»`);
    console.log(`> ${t.text}\n`);
    const r = await graf.invoke({ ticket: t.text });
    console.log("JURNAL (pasi):");
    for (const p of r.pasi) console.log(`  - ${p}`);
    console.log(`\ntriaj final: ${JSON.stringify(r.triaj)}   escaladat: ${r.escaladat}`);
    console.log(`\nRASPUNS CLIENT:\n${r.raspunsClient}\n\nNOTA INTERNA:\n${r.notaInterna}`);
  }
  titlu("Graful de triaj (lipeste in https://mermaid.live)");
  console.log(mermaidCurat((await graf.getGraphAsync()).drawMermaid()));
}

main().catch(console.error);

// src/parte1/demo4-semantic.ts
//
// ===========================================================================
// DEMO 4: CAUTARE DUPA SENS in Store (semantic search)
// ===========================================================================
//
// Rulare:  pnpm demo4         (embeddings reale: Google, ca in Lab 11; cere GOOGLE_API_KEY)
//          pnpm demo4:fals    (vectori FALSI, offline: arata mecanismul, nu calitatea)
//
// PROBLEMA
//   Fara index, search() cauta doar dupa filtre exacte. "cazare linistita" nu
//   gaseste "prefera hoteluri fara galagie": nu au niciun cuvant comun.
//
// ELEMENT NOU: index la crearea Store-ului
//   new InMemoryStore({ index: { embeddings, dims, fields: ["text"] } })
//   - embeddings: acelasi model ca in Lab 11 (cu taskType separat pentru
//                 documente si intrebari), dar INDEX SEPARAT de cartile din RAG
//   - dims:       numarul de dimensiuni. Store-ul NU il valideaza, il masuram noi
//   - fields:     ce camp se embedeaza. Doar `text`, nu si `categorie`
//   Costul: fiecare put() face un apel de embeddings, fiecare search() cu
//   query face inca unul.
//
// CE VEDEM
//   A. interogari cu scoruri: una care potriveste, una fara cuvinte comune,
//      una fara nicio legatura (si totusi primeste rezultate: search nu zice "nimic")
//   B. capcana: query pe un Store FARA index e ignorat in tacere
//   C. query + filter in aceeasi cautare

import "../lib/env.js";
import {
  creeazaEmbeddingsPentruMemorie,
  descrieEmbeddings,
} from "../lib/embeddings.js";
import {
  PRAG_SCOR,
  creeazaStoreSemantic,
  creeazaStoreSimplu,
  spatiuMemorii,
} from "../lib/store.js";
import { titlu } from "../lib/afisare.js";

//astea vor intra in embeddings si index-ul semantic
const MEMORII = [
  {
    text: "Prefera hoteluri fara galagie, departe de zone aglomerate",
    categorie: "preferinta",
  },
  { text: "Nu mananca fructe de mare", categorie: "restrictie" },
  { text: "Calatoreste des cu doi copii mici", categorie: "context" },
  {
    text: "Prefera sa mearga cu trenul, nu cu avionul",
    categorie: "preferinta",
  },
  {
    text: "Are un buget de maxim 80 de euro pe noapte",
    categorie: "preferinta",
  },
  { text: "Mananca vegetarian", categorie: "restrictie" },
];

async function main() {
  titlu("DEMO 4: cautare dupa sens");
  console.log(`  embeddings: ${descrieEmbeddings()}`);
  console.log(
    `  prag de scor: ${PRAG_SCOR}  (punct de pornire, de calibrat pe scorurile de mai jos)`,
  );
  if (process.env.EMBEDDINGS_PROVIDER === "fals") {
    console.log(
      "  ATENTIE: vectori FALSI. Lista de concepte e scrisa de noi, ca sa iasa exemplele.",
    );
    console.log(
      "           Demonstreaza mecanismul Store-ului, NU calitatea unui model real.",
    );
  }

  const embeddings = creeazaEmbeddingsPentruMemorie();
  const store = await creeazaStoreSemantic(embeddings);
  const ns = spatiuMemorii("ionel");
  for (const [i, m] of MEMORII.entries()) await store.put(ns, `m${i + 1}`, m); // indexam fiecare amintire in store-ul semantic
  console.log(`  indexate ${MEMORII.length} amintiri pentru ionel.`);

  const cauta = async (query: string, limit = 3) => {
    // cauta in store-ul semantic cu un prag de scor
    const rezultate = await store.search(ns, { query, limit }); // cautare semantica cu prag de scor
    console.log(`\n  query: "${query}"`); // afisam query-ul curent
    for (const r of rezultate) {
      // afisam fiecare rezultat cu scor si text
      const scor = r.score ?? NaN;
      const verdict =
        scor >= PRAG_SCOR ? "peste prag" : "SUB prag, ar fi ignorata"; // determinam daca rezultatul trece pragul de scor
      console.log(
        `    ${scor.toFixed(3)}  ${verdict.padEnd(24)} ${r.value.text}`,
      );
    }
  };

  titlu("A. interogari: potrivire, fara cuvinte comune, fara legatura");
  await cauta("cazare linistita"); // niciun cuvant comun cu "fara galagie"
  await cauta("ce nu are voie sa manance");
  await cauta("program de fotbal"); // nu exista nicio amintire despre asta
  console.log(
    '\n  Observa ultima interogare: a primit TOT 3 rezultate. search() nu spune niciodata "nimic".\n' +
      "  Fara un prag, agentul ar primi amintiri irelevante si le-ar folosi.",
  );

  titlu("B. capcana: query pe un Store FARA index");
  const faraIndex = creeazaStoreSimplu(); // store simplu, fara index semantic
  for (const [i, m] of MEMORII.entries())
    await faraIndex.put(ns, `m${i + 1}`, m); // adaugam amintirile in store-ul simplu, fara index semantic
  const orb = await faraIndex.search(ns, {
    query: "cazare linistita",
    limit: 3,
  });
  const faraScor = orb.every((r) => r.score === undefined);
  console.log(
    `  query "cazare linistita" pe store fara index => ${orb.length} rezultate, scor: ${faraScor ? "undefined la toate" : "?"}`,
  );
  console.log(
    "  Niciun cod de eroare. Query-ul a fost ignorat si am primit primele amintiri, in ordinea inserarii.",
  );
  console.log(
    '  Daca uiti `index`, cautarea "merge", dar nu mai cauta dupa sens.',
  );

  titlu("C. query + filter in aceeasi cautare");
  const doarRestrictii = await store.search(ns, {
    query: "ce nu poate manca",
    filter: { categorie: "restrictie" },
    limit: 3,
  });
  console.log('  query "ce nu poate manca" + filter {categorie:"restrictie"}:');
  for (const r of doarRestrictii)
    console.log(`    ${(r.score ?? NaN).toFixed(3)}  ${r.value.text}`);
  console.log("  Filtrul restrange candidatii, semantica ii ordoneaza.\n");
}

main().catch(console.error);

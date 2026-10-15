// src/lib/store.ts
//
// ===========================================================================
// STORE: fabrica de Store-uri si conventiile de namespace
// ===========================================================================
//
// ELEMENT NOU: InMemoryStore
//   Din ce pachet:  "@langchain/langgraph"
//   Ce e:           depozitul de LONG-TERM MEMORY din LangGraph: cheie-valoare,
//                   organizat pe NAMESPACE, citit din orice thread.
//   La ce e bun:    ce stim despre un utilizator, indiferent in ce conversatie
//                   ne-a spus. (SHORT-TERM MEMORY = checkpointer, pe thread.)
//   Limita:         tine totul in RAM. La restart dispare tot. In productie
//                   inlocuiesti cu PostgresStore (aceeasi API).
//
// CAPCANA VERIFICATA IN COD: `import { InMemoryStore } from "langchain"`
//   este ALTA clasa: depozitul simplu din @langchain/core, cu mget/mset.
//   NU are put/get/search pe namespace. Importa MEREU din "@langchain/langgraph".
//
// NAMESPACE-URI FOLOSITE IN LAB (cate unul pentru fiecare tip de long-term memory)
//   [userId, "memories"]    semantic memory, ca COLLECTION (multe fapte mici)
//   [userId, "profile"]     semantic memory, ca PROFILE (un singur document JSON)
//   [userId, "episodes"]    episodic memory (ce s-a intamplat data trecuta)
//   ["agent", "instructions"] procedural memory (regulile agentului, comune)

import { InMemoryStore, type BaseStore } from "@langchain/langgraph";
import type { Embeddings } from "@langchain/core/embeddings";

/**
 * Scorul minim al unei amintiri gasite prin semantic search.
 *
 * search() cu query intoarce MEREU primele `limit` rezultate, chiar daca
 * niciunul nu seamana cu intrebarea (verificat). Fara prag, agentul primeste
 * amintiri irelevante.
 *
 * 0.5 e un punct de pornire, NU un adevar. Scorurile depind de modelul de
 * embeddings. Ruleaza demo4, uita-te la scorurile reale, apoi ajusteaza.
 */
export const PRAG_SCOR = Number(process.env.PRAG_SCOR ?? 0.5);

/** Semantic memory, varianta collection: [userId, "memories"]. Primul element izoleaza utilizatorii. */
export function spatiuMemorii(userId: string): string[] {
  return [userId, "memories"];
}

/** Semantic memory, varianta profile: [userId, "profile"], un singur item cu cheia "principal". */
export function spatiuProfil(userId: string): string[] {
  return [userId, "profile"];
}

/** Episodic memory: [userId, "episodes"]. */
export function spatiuEpisoade(userId: string): string[] {
  return [userId, "episodes"];
}

/** Procedural memory: regulile agentului. Nu tin de un utilizator, deci nu incep cu userId. */
export const SPATIU_INSTRUCTIUNI = ["agent", "instructions"];

/** Store simplu: put/get/search/delete, fara semantic search. */
export function creeazaStoreSimplu(): InMemoryStore {
  return new InMemoryStore();
}

/**
 * Store cu semantic search (index).
 *
 * `dims` este numarul de dimensiuni al vectorilor. Store-ul NU il valideaza
 * (verificat: dims gresit nu da eroare, scorurile devin nesigure). Il MASURAM
 * noi, o data, din rezultatul modelului.
 *
 * `fields: ["text"]` = embedam doar campul `text`, nu si categoria.
 */
export async function creeazaStoreSemantic(embeddings: Embeddings): Promise<InMemoryStore> {
  const dims = (await embeddings.embedQuery("masurare dimensiuni")).length;
  return new InMemoryStore({ index: { embeddings, dims, fields: ["text"] } });
}

/**
 * Cauta amintirile unui utilizator si intoarce doar ce merita folosit.
 *
 * Doua situatii, pe care le tratam explicit (amandoua verificate):
 *   - Store CU index: rezultatele au `score`. Pastram doar ce trece de PRAG_SCOR.
 *   - Store FARA index: query-ul e IGNORAT in tacere si nimic nu are `score`.
 *     Atunci nu pretindem ca am cautat: intoarcem TOATE amintirile (pana la
 *     `limitFaraIndex`), iar `cautareDupaSens` e false, ca apelantul sa stie.
 */
export async function cautaAmintiri(
  store: BaseStore,
  userId: string,
  query: string,
  optiuni: { limit?: number; limitFaraIndex?: number } = {},
) {
  const limit = optiuni.limit ?? 5;
  const limitFaraIndex = optiuni.limitFaraIndex ?? 20;
  const ns = spatiuMemorii(userId);
  const q = query.trim();

  if (!q) return { amintiri: await store.search(ns, { limit: limitFaraIndex }), cautareDupaSens: false };

  const gasite = await store.search(ns, { query: q, limit });
  const areScor = gasite.some((i) => i.score !== undefined);
  if (!areScor) {
    // Fara index: query-ul a fost ignorat. Listam tot, cinstit.
    return { amintiri: await store.search(ns, { limit: limitFaraIndex }), cautareDupaSens: false };
  }
  // Cu index: un item salvat cu index false apare fara scor. Il pastram.
  const relevante = gasite.filter((i) => i.score === undefined || i.score >= PRAG_SCOR);
  return { amintiri: relevante, cautareDupaSens: true };
}

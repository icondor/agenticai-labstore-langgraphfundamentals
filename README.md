# Lab 12: Long-term memory (Store) + LangGraph fundamentals

Partea 1: long-term memory (75 de minute), cod in `src/parte1/`.
Partea 2: LangGraph fundamentals (105 minute), cod in `src/parte2/` si `src/triaj/`.

Folder de sine statator, ca `lab11-rag-biblioteca`: are propriul `package.json`.
Foloseste `src/lib/llm.ts` copiat din Lab 11 si aceeasi configuratie de embeddings.

## Taxonomia folosita (cea din documentatia LangGraph, "Memory")

| Termen | Unde e in cod |
|---|---|
| short-term memory: pe thread, salvata de checkpointer | `MemorySaver`, demo1 |
| long-term memory: intre thread-uri, in Store, pe namespace | `InMemoryStore`, demo2 |
| semantic memory (fapte), ca **collection** | `[userId, "memories"]`, `tools/memorie.ts` |
| semantic memory, ca **profile** | `[userId, "profile"]`, `lib/profil.ts`, demo6 |
| episodic memory (ce s-a intamplat) | `[userId, "episodes"]`, demo6 |
| procedural memory (cum lucreaza agentul) | `["agent", "instructions"]`, demo6 |
| scriere in **hot path** (prin tool, in conversatie) | demo3, demo5 |
| scriere in **background** (graf separat, dupa conversatie) | `grafuri/extractor-memorie.ts`, demo6 |
| **semantic search** (cautare dupa sens, cu index) | demo4. Atentie: alt sens al lui "semantic" decat semantic memory |

Accesul la Store se face prin **Runtime** (LangGraph 1.0): `runtime.store` si
`runtime.context`, in tool-uri, middleware si noduri de graf.

## Instalare

```bash
pnpm install
cp .env.example .env.local     # si completeaza cheile
```

## Comenzi

| Comanda | Ce face | Cere chei? |
|---|---|---|
| `pnpm verifica` | 61 de verificari: Store, tool-uri, middleware, checkpointer, profile, background | nu |
| `pnpm demo2` | Store fara LLM: put, get, search, delete, namespace, capcana de import | nu |
| `pnpm demo6` | tipurile de long-term memory, profile vs collection, scriere in background | nu |
| `pnpm demo4:fals` | semantic search cu vectori FALSI (doar mecanismul) | nu |
| `pnpm exercitiu` | solutia de referinta a exercitiului, cu model fals | nu |
| `pnpm exercitiu:schelet` | scheletul dat studentilor (se opreste la TODO) | nu |
| `pnpm demo1` | durerea: agentul uita cand schimbi thread-ul | model de chat |
| `pnpm demo3` | memorie prin tool-uri (hot path) | model de chat |
| `pnpm demo5` | memoria citita automat, prin middleware, plus stergere | model de chat |
| `pnpm demo4` | semantic search cu embeddings reale | GOOGLE_API_KEY |
| `pnpm verifica2` | 30 de verificari Partea 2: triaj, reducers, ReAct, memorie ca noduri, exercitiu | nu |
| `pnpm demo9` | reducers: LastValue vs ReducedValue, eroarea in paralel | nu |
| `pnpm demo7` | Partea 2: graful minim (stare, nod, muchii, compile, invoke, drawMermaid) | model de chat |
| `pnpm demo8` | triajul din Lab 5 ca graf: conditional edges, paralel, regula in cod | model de chat |
| `pnpm demo10` | bucla ReAct scrisa de mana, comparata cu createAgent | model de chat |
| `pnpm demo11` | memoria ca noduri: istoricul clientului din Store | model de chat |
| `pnpm exercitiu2:schelet` | scheletul exercitiului Partea 2 | model de chat |
| `pnpm exercitiu2` | solutia de referinta Partea 2 | model de chat |
| `pnpm tipuri` | `tsc --noEmit` | nu |

## Ordinea de predat

1. **demo1**: durerea (short-term memory nu ajunge).
2. **demo2**: Store-ul singur, fara model. Aici se invata API-ul.
3. **demo3**: agentul cu `salveazaMemorie` / `cautaMemorie` / `stergeMemorie`.
4. **demo5**: aceeasi memorie, citita de middleware. Compari cu demo3.
5. **demo6**: profile vs collection, hot path vs background.
6. **demo4**: semantic search. Ruleaza `pnpm demo4:fals` daca nu ai cheie.
7. **exercitiu**: studentii primesc `exercitiu/Exercitiu-Memorie.txt` si `src/exercitiu/schelet.ts`.

## Structura

```
src/
  lib/
    llm.ts                  modelul de chat, copiat din Lab 11
    embeddings.ts           embeddings ca in Lab 11, taskType separat document/intrebare
    embeddings-false.ts     vectori falsi, DOAR pentru verificare offline
    store.ts                fabrica de Store-uri, namespace-uri, PRAG_SCOR, cautaAmintiri
    profil.ts               semantic memory ca profile (get, merge, put)
    env.ts, afisare.ts
  tools/memorie.ts          salveazaMemorie, cautaMemorie, stergeMemorie (collection, hot path)
  middleware/memorie-automata.ts   citeste memoria la fiecare apel de model
  grafuri/extractor-memorie.ts     StateGraph care scrie profilul in background
  parte1/                   demo1 ... demo6, exercitiu-referinta.ts
  exercitiu/schelet.ts      punctul de pornire al studentilor
  triaj/                    Partea 2: schema (ca in Lab 5), graf-triaj, react-de-mana,
                            tools-suport, triaj-cu-memorie
  parte2/                   demo7 ... demo11, exercitiu2-referinta.ts
  exercitiu/schelet-parte2.ts
  verificare/test-parte1.ts, test-parte2.ts
exercitiu/Exercitiu-Memorie.txt    enuntul Partea 1
exercitiu/Exercitiu-Graf.txt       enuntul Partea 2
```

## Ce am verificat si ce NU

Verificat prin rulare, pe versiunile din `pnpm-lock.yaml` (`@langchain/langgraph` 1.5.0,
`@langchain/langgraph-checkpoint` 1.2.0, `@langchain/core` 1.2.17, `langchain` 1.5.16):
`tsc --noEmit` curat, esbuild pe toate fisierele rulabile, `pnpm verifica` 61/61, plus
demo2, demo4:fals, demo6, exercitiu si exercitiu:schelet. Printre lucrurile verificate:
- `put` pe aceeasi cheie INLOCUIESTE tot value-ul; `search` fara `limit` intoarce maxim 10
- `InMemoryStore` din `"langchain"` este ALTA clasa (mset/mget)
- `query` pe un Store fara `index` e ignorat in tacere; `cautaAmintiri` detecteaza asta si listeaza tot, cinstit
- cu `index`, `search` intoarce mereu `limit` rezultate: de aceea `PRAG_SCOR`
- `dims` gresit NU da eroare: de aceea il masuram
- o eroare aruncata intr-un tool NU opreste `createAgent`: devine ToolMessage cu status "error";
  o eroare aruncata in middleware urca pana la `invoke()`
- `ToolRuntime.store` e tipat ca `BaseStore<string, unknown>` din core: `put` nu compileaza;
  `LangGraphRunnableConfig` (RunnableConfig + Partial<Runtime>) compileaza
- graful extractor: `StateSchema` + `StateGraph(Stare, schemaContext)` + `compile({ store })`,
  nodul scrie cu `runtime.store` la `runtime.context.userId`

NEverificat (cer chei, le rulezi tu):
- demo 1, 3, 5 cu un model real: compileaza, dar comportamentul modelului nu l-am vazut
- demo 4 cu embeddings Google reale; `PRAG_SCOR=0.5` trebuie calibrat pe scorurile reale
- extractorul din demo6 cu un model real (`withStructuredOutput` pe modelul tau): doar tipurile sunt verificate

## Partea 2: ce am verificat si ce NU

Verificat (`pnpm verifica2`, 30/30, cu modele false, pe aceleasi versiuni): rutarea conditionala,
fan-out si fan-in, `InvalidUpdateError` fara reducer in paralel, `ReducedValue`, bucla ReAct
(human, ai, tool, ai), `GraphRecursionError` la `recursionLimit`, diagramele Mermaid (inclusiv a lui
createAgent), memoria ca noduri cu `compile({ store })` si `runtime.context`, exercitiul de referinta.
Tot ce e in `src/parte2/` compileaza (tsc, esbuild).

NEverificat: demo7, 8, 10, 11 si exercitiul cu un model real (cer cheie). Clasificarea si tool call-urile
unui model real variaza de la o rulare la alta.

## Limite cunoscute

- `InMemoryStore` pierde tot la restart. In productie: `PostgresStore` din
  `@langchain/langgraph-checkpoint-postgres/store` (clasa exista, verificat in tipuri). Nu l-am rulat.
- Deduplicarea collection-ului prinde doar text IDENTIC (litere mici, trim).
- Collection-ul nu rezolva contradictiile ("vegetarian" si "mananca peste" raman amandoua); profile-ul da.
- Delimitatorii din middleware reduc, nu elimina, riscul de memory poisoning.
- Nu exista expirare a amintirilor.

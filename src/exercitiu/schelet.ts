// src/exercitiu/schelet.ts
//
// ===========================================================================
// EXERCITIU, SCHELETUL STUDENTULUI: completezi cele trei tool-uri
// ===========================================================================
//
// Rulare:  pnpm exercitiu:schelet     (FARA cheie, FARA tokeni)
//
// Ce e deja facut: schemele tool-urilor, agentul, conversatiile cu model fals
// si afisarea Store-ului. Ce faci tu: corpul celor trei tool-uri (cauta TODO).
// Pana le completezi, rularea se opreste cu "TODO".
//
// Indicii:
//   - Store-ul si userId vin din al doilea argument al tool-ului (runtime):
//       runtime.store, runtime.context?.userId
//   - Daca lipseste oricare, ARUNCA o eroare clara.
//   - Namespace: [userId, "memories"]
//   - "Nu dubla": cheia calculata din text (hash), nu aleasa la intamplare.

import "../lib/env.js";
import { createHash } from "node:crypto";
import { createAgent, FakeToolCallingModel } from "langchain";
import { InMemoryStore, MemorySaver, type LangGraphRunnableConfig } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { afiseazaPasii, titlu } from "../lib/afisare.js";

const schemaContext = z.object({ userId: z.string() });

/** Gata facut: aceeasi propozitie (litere mici, fara spatii la capete) = aceeasi cheie. */
function cheiePentruText(text: string): string {
  return createHash("sha1").update(text.trim().toLowerCase()).digest("hex").slice(0, 8);
}

const salveazaMemorie = tool(
  async ({ text, categorie }: { text: string; categorie: string }, runtime: LangGraphRunnableConfig) => {
    // TODO 1: citeste store si userId din runtime (arunca daca lipsesc),
    //         calculeaza cheia, nu dubla, put(...) in [userId, "memories"].
    void text; void categorie; void runtime; void cheiePentruText;
    throw new Error("TODO 1: salveazaMemorie");
  },
  {
    name: "salveazaMemorie",
    description: "Salveaza o informatie stabila despre utilizator.",
    schema: z.object({ text: z.string(), categorie: z.enum(["preferinta", "restrictie", "context"]) }),
  },
);

const cautaMemorie = tool(
  async ({ query }: { query: string }, runtime: LangGraphRunnableConfig) => {
    // TODO 2: intoarce amintirile utilizatorului, cate una pe linie, cu id:
    //         "- [cheie] text (categorie)". Daca nu e nimic, spune asta.
    //         Atentie: store-ul de aici NU are index, deci query-ul nu cauta dupa sens.
    void query; void runtime;
    throw new Error("TODO 2: cautaMemorie");
  },
  {
    name: "cautaMemorie",
    description: "Citeste amintirile utilizatorului. Query gol = toate.",
    schema: z.object({ query: z.string() }),
  },
);

const stergeMemorie = tool(
  async ({ cheie }: { cheie: string }, runtime: LangGraphRunnableConfig) => {
    // TODO 3: sterge amintirea cu cheia data, DOAR din namespace-ul utilizatorului curent.
    void cheie; void runtime;
    throw new Error("TODO 3: stergeMemorie");
  },
  {
    name: "stergeMemorie",
    description: "Sterge o amintire dupa id.",
    schema: z.object({ cheie: z.string() }),
  },
);

// ---------------------------------------------------------------------------
// De aici in jos nu e nevoie sa modifici nimic (doar la bonus).
// ---------------------------------------------------------------------------
type Script = { name: string; args: Record<string, unknown>; id: string }[][];
const store = new InMemoryStore();
const checkpointer = new MemorySaver();

/** Un agent NOU pentru fiecare conversatie: modelul fals isi reseteaza scriptul. */
async function conversatie(userId: string, threadId: string, text: string, script: Script) {
  console.log(`\n[${userId} / ${threadId}] > ${text}`);
  const agent = createAgent({
    model: new FakeToolCallingModel({ toolCalls: script }),
    tools: [salveazaMemorie, cautaMemorie, stergeMemorie],
    contextSchema: schemaContext,
    store,
    checkpointer,
  });
  const r = await agent.invoke({ messages: [{ role: "user", content: text }] }, { configurable: { thread_id: threadId }, context: { userId } });
  afiseazaPasii(r.messages, { raspuns: false });
}

async function arataStore(userId: string) {
  const items = await store.search([userId, "memories"], { limit: 100 });
  console.log(`  Store[${userId}]: ${items.length} amintiri`);
  for (const i of items) console.log(`    [${i.key}] ${i.value.text} (${i.value.categorie})`);
}

async function main() {
  const A = "Prefera hoteluri linistite, fara galagie";
  const B = "Nu mananca fructe de mare";

  titlu("Punctul 1: conv-1, doua salvari");
  await conversatie("ionel", "conv-1", "Prefer hoteluri linistite. Nu mananc fructe de mare.", [
    [
      { name: "salveazaMemorie", args: { text: A, categorie: "preferinta" }, id: "1" },
      { name: "salveazaMemorie", args: { text: B, categorie: "restrictie" }, id: "2" },
    ],
    [],
  ]);
  await arataStore("ionel");

  titlu("Punctul 2: thread nou, acelasi utilizator");
  await conversatie("ionel", "conv-2", "Recomanda-mi un hotel la Roma.", [[{ name: "cautaMemorie", args: { query: "" }, id: "3" }], []]);

  titlu("Punctul 3: alt utilizator");
  await conversatie("ana", "conv-3", "Ce stii despre mine?", [[{ name: "cautaMemorie", args: { query: "" }, id: "4" }], []]);

  titlu("Punctul 4: aceeasi propozitie a doua oara");
  await conversatie("ionel", "conv-4", "Sa retii: prefer hoteluri linistite.", [[{ name: "salveazaMemorie", args: { text: A, categorie: "preferinta" }, id: "5" }], []]);
  await arataStore("ionel");

  titlu("Punctul 5: stergere");
  await conversatie("ionel", "conv-5", "Am inceput sa mananc fructe de mare, uita ce ti-am spus.", [
    [{ name: "stergeMemorie", args: { cheie: cheiePentruText(B) }, id: "6" }],
    [],
  ]);
  await arataStore("ionel");
  console.log();
}

main().catch((e) => console.error(`\nOPRIT: ${(e as Error).message}\n`));

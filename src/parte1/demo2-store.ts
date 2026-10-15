// src/parte1/demo2-store.ts
//
// ===========================================================================
// DEMO 2: STORE FARA LLM: put, get, search, delete, namespace
// ===========================================================================
//
// Rulare:  pnpm demo2        (FARA cheie, FARA tokeni, merge la toata lumea)
//
// DE CE FARA LLM
//   Inainte sa punem un model peste Store, vedem Store-ul singur. Daca intelegi
//   ce face put() si ce intoarce search(), restul labului e doar instalatorie.
//
// CE ARATAM, IN ORDINE
//   1. put + get: forma unui item (namespace, key, value, createdAt, updatedAt)
//   2. search: tot namespace-ul, dupa filtru, dupa prefix
//   3. izolare: ce salveaza ionel nu se vede de la ana
//   4. overwrite: acelasi key = inlocuire, nu adaugare
//   5. delete si listNamespaces
//   6. capcana: InMemoryStore din "langchain" NU e Store-ul de care avem nevoie

import "../lib/env.js";
import { InMemoryStore as StoreCorrect } from "@langchain/langgraph"; // alias corect pentru Store-ul pe care il vrem
import * as langchain from "langchain"; // aici avem si un InMemoryStore "fals" care NU e Store-ul corect
import { spatiuMemorii } from "../lib/store.js";
import { titlu } from "../lib/afisare.js";

async function main() {
  const store = new StoreCorrect();
  const ionel = spatiuMemorii("ionel");
  const ana = spatiuMemorii("ana");

  titlu("1. put + get: anatomia unui item");
  await store.put(ionel, "m1", {
    text: "Prefera hoteluri linistite",
    categorie: "preferinta",
  });
  await store.put(ionel, "m2", {
    text: "Nu mananca fructe de mare",
    categorie: "restrictie",
  });
  await store.put(ana, "m1", {
    text: "Calatoreste cu doi copii",
    categorie: "context",
  });

  const item = await store.get(ionel, "m1");
  console.log("get(['ionel','memories'], 'm1') =>");
  console.log(`  namespace: ${JSON.stringify(item?.namespace)}`);
  console.log(`  key:       ${item?.key}`);
  console.log(`  value:     ${JSON.stringify(item?.value)}`);
  console.log(`  createdAt: ${item?.createdAt.toISOString()}`);
  console.log(
    `  get pe cheie inexistenta => ${await store.get(ionel, "nu-exista")}  (null, nu eroare)`,
  );

  titlu("2. search: tot namespace-ul, cu filtru, pe prefix");
  const toate = await store.search(ionel);
  console.log(
    `  tot ['ionel','memories']:        ${toate.map((i) => i.key).join(", ")}`,
  );
  const restrictii = await store.search(ionel, {
    filter: { categorie: "restrictie" },
  });
  console.log(
    `  filter {categorie:'restrictie'}: ${restrictii.map((i) => i.key).join(", ")}`,
  );
  const prefix = await store.search(["ionel"]);
  console.log(
    `  prefix ['ionel']:                ${prefix.length} items (prefixul acopera tot ce e sub el)`,
  );
  console.log(
    "  search fara limit intoarce MAXIM 10 (implicit). Daca ai mai multe, pune limit explicit.",
  );

  titlu("3. izolare intre utilizatori");
  const alAnei = await store.search(ana);
  console.log(`  ana vede: ${alAnei.map((i) => i.value.text).join(" | ")}`);
  console.log(
    "  ana NU vede 'Nu mananca fructe de mare'. Izolarea e data de primul element al namespace-ului.",
  );

  titlu("4. overwrite: acelasi key inlocuieste");
  await store.put(ionel, "m1", {
    text: "Prefera hoteluri cu spa",
    categorie: "preferinta",
  });
  const dupa = await store.get(ionel, "m1");
  console.log(
    `  m1 acum: "${dupa?.value.text}"  (nu "linistite"; nu s-a adaugat un al doilea item)`,
  );
  console.log(`  items ionel: ${(await store.search(ionel)).length}`);
  console.log(
    "  put pe un key existent inlocuieste TOT value-ul (verificat: {a:1,b:2} + put({a:3}) => {a:3}), nu face merge pe campuri.",
  );

  titlu("5. delete si listNamespaces");
  await store.delete(ionel, "m2");
  console.log(
    `  dupa delete m2, items ionel: ${(await store.search(ionel)).length}`,
  );
  console.log(
    `  listNamespaces: ${JSON.stringify(await store.listNamespaces())}`,
  );

  titlu("6. CAPCANA: InMemoryStore din 'langchain' e alt obiect");

  // istoric, e folosit ca si cache simplu, pt embeddings, pt retrieval etc

  /*cel din @langchain/core / langchain e un cache cheie-valoare pentru componentele LangChain. 
  Cel din @langchain/langgraph e long-term memory pentru agenti. 
  Numele lor e identic din motive istorice, nu pentru ca fac acelasi lucru.
  */
  const gresit = new (
    langchain as unknown as { InMemoryStore: new () => Record<string, unknown> }
  ).InMemoryStore();
  console.log(
    `  din "langchain":          put=${typeof gresit.put}  search=${typeof gresit.search}  mset=${typeof gresit.mset}  mget=${typeof gresit.mget}`,
  );
  console.log(
    `  din "@langchain/langgraph": put=${typeof store.put}  search=${typeof store.search}`,
  );
  console.log(
    "  Primul e un depozit cheie-valoare simplu (mset/mget). Al doilea e Store-ul cu namespace.",
  );
  console.log(
    "  Daca autocomplete-ul iti importa din 'langchain', nu vei avea put/search.\n",
  );
}

main().catch(console.error);

// src/verificare/test-parte1.ts
//
// ===========================================================================
// VERIFICARE: Lab 12, Partea 1. Fara chei, fara cost, fara model real.
// ===========================================================================
//
// Rulare:  pnpm verifica
//
// Ce verifica:
//   - comportamentul Store-ului (inclusiv capcanele pe care le predam)
//   - tool-urile de memorie, prin agenti cu model fals
//   - middleware-ul de memorie automata (ce ajunge efectiv la model)
//   - checkpointer versus Store
//
// Ce NU verifica: calitatea unui model real (embeddings reale, LLM real).
// Demo 1, 3, 5 si Demo 4 fara `fals` cer chei si nu sunt acoperite aici.

import "../lib/env.js";
import { createAgent, FakeToolCallingModel } from "langchain";
import * as langchain from "langchain";
import { InMemoryStore, MemorySaver } from "@langchain/langgraph";
import { EmbeddingsFalse, DIMS_EMBEDDINGS_FALSE } from "../lib/embeddings-false.js";
import { PRAG_SCOR, creeazaStoreSemantic, creeazaStoreSimplu, spatiuMemorii, spatiuProfil } from "../lib/store.js";
import { actualizeazaProfil, citesteProfil } from "../lib/profil.js";
import { creeazaExtractor } from "../grafuri/extractor-memorie.js";
import { cautaMemorie, cheiePentruText, salveazaMemorie, schemaContext, stergeMemorie } from "../tools/memorie.js";
import { memorieAutomata } from "../middleware/memorie-automata.js";
import { textulMesajului } from "../lib/afisare.js";

let trecute = 0;
let picate = 0;

function verifica(nume: string, conditie: boolean, detaliu?: unknown) {
  if (conditie) {
    trecute++;
    console.log(`  ok    ${nume}`);
  } else {
    picate++;
    console.log(`  PICAT ${nume}${detaliu !== undefined ? `   (${JSON.stringify(detaliu)})` : ""}`);
  }
}

type Script = { name: string; args: Record<string, unknown>; id: string }[][];
type Mesaj = { getType(): string; content: unknown };

const mesajeTool = (mesaje: Mesaj[]) =>
  mesaje.filter((m) => m.getType() === "tool").map((m) => textulMesajului(m as never));

function agentCuTool(store: InMemoryStore, script: Script, checkpointer = new MemorySaver()) {
  return createAgent({
    model: new FakeToolCallingModel({ toolCalls: script }),
    tools: [salveazaMemorie, cautaMemorie, stergeMemorie],
    contextSchema: schemaContext,
    store,
    checkpointer,
  });
}

async function ruleaza(agent: ReturnType<typeof agentCuTool>, userId: string, thread: string, text = "x") {
  const r = await agent.invoke(
    { messages: [{ role: "user", content: text }] },
    { configurable: { thread_id: thread }, context: { userId } },
  );
  return r.messages as Mesaj[];
}

async function main() {
  // -- A. Store ----------------------------------------------------------
  console.log("\nA. Store");
  {
    const s = new InMemoryStore();
    await s.put(["ionel", "memories"], "m1", { text: "x", categorie: "preferinta" });
    await s.put(["ana", "memories"], "m1", { text: "y", categorie: "context" });

    const g = await s.get(["ionel", "memories"], "m1");
    verifica("get intoarce valoarea, cheia si namespace-ul", g?.value.text === "x" && g.key === "m1" && g.namespace[0] === "ionel");
    verifica("get pe cheie inexistenta intoarce null", (await s.get(["ionel", "memories"], "zz")) === null);
    verifica("createdAt este Date", g?.createdAt instanceof Date);

    const alAnei = await s.search(["ana", "memories"]);
    verifica("izolare: ana vede doar amintirile ei", alAnei.length === 1 && alAnei[0].value.text === "y");
    verifica("prefix ['ionel'] gaseste amintirile lui ionel", (await s.search(["ionel"])).length === 1);

    await s.put(["ionel", "memories"], "m1", { text: "nou" });
    const dupa = await s.get(["ionel", "memories"], "m1");
    verifica("put pe acelasi key INLOCUIESTE tot value-ul (nu face merge)", dupa?.value.text === "nou" && dupa.value.categorie === undefined, dupa?.value);

    await s.put(["f"], "k", { a: 1, b: 2 });
    await s.put(["f"], "k", { a: 3 });
    verifica("replace complet: {a:1,b:2} apoi {a:3} => {a:3}", JSON.stringify((await s.get(["f"], "k"))?.value) === '{"a":3}');

    await s.delete(["ionel", "memories"], "m1");
    verifica("delete sterge itemul", (await s.search(["ionel", "memories"])).length === 0);

    verifica("listNamespaces vede ambii utilizatori", (await s.listNamespaces()).length >= 1);

    for (let i = 0; i < 15; i++) await s.put(["multe"], `k${i}`, { text: `t${i}` });
    verifica("search fara limit intoarce MAXIM 10 (implicit)", (await s.search(["multe"])).length === 10);
    verifica("search cu limit 20 intoarce toate 15", (await s.search(["multe"], { limit: 20 })).length === 15);

    await s.put(["c"], "a", { tip: "x" });
    await s.put(["c"], "b", { tip: "y" });
    verifica("filter exact functioneaza", (await s.search(["c"], { filter: { tip: "y" } })).map((i) => i.key).join() === "b");

    let aruncat = false;
    try {
      await s.put([], "k", { a: 1 });
    } catch {
      aruncat = true;
    }
    verifica("namespace gol este refuzat", aruncat);

    // Capcana: InMemoryStore din "langchain"
    const gresit = new (langchain as unknown as { InMemoryStore: new () => Record<string, unknown> }).InMemoryStore();
    verifica("CAPCANA: InMemoryStore din 'langchain' nu are put/search", typeof gresit.put === "undefined" && typeof gresit.search === "undefined");
    verifica("CAPCANA: ... ci mset/mget", typeof gresit.mset === "function" && typeof gresit.mget === "function");

    // Capcana: query fara index
    const faraIndex = new InMemoryStore();
    await faraIndex.put(["u"], "a", { text: "alpha" });
    await faraIndex.put(["u"], "b", { text: "beta" });
    const orb = await faraIndex.search(["u"], { query: "ceva complet diferit" });
    verifica("CAPCANA: query fara index e ignorat in tacere (2 rezultate, fara scor)", orb.length === 2 && orb.every((r) => r.score === undefined));
  }

  // -- B. Cautare semantica (embeddings false) ---------------------------
  console.log("\nB. Cautare semantica (vectori falsi, doar mecanismul)");
  {
    const emb = new EmbeddingsFalse();
    const s = await creeazaStoreSemantic(emb);
    verifica("dims masurat = dims declarat al embeddings-urilor false", s.indexConfig?.dims === DIMS_EMBEDDINGS_FALSE, s.indexConfig?.dims);

    const ns = spatiuMemorii("ionel");
    await s.put(ns, "a", { text: "Prefera hoteluri fara galagie", categorie: "preferinta" });
    await s.put(ns, "b", { text: "Nu mananca fructe de mare", categorie: "restrictie" });
    await s.put(ns, "c", { text: "Calatoreste cu doi copii", categorie: "context" });

    const r = await s.search(ns, { query: "cazare linistita", limit: 3 });
    verifica("'cazare linistita' gaseste 'fara galagie' pe primul loc", r[0]?.key === "a", r.map((x) => x.key));
    verifica("scorul primului rezultat >= PRAG_SCOR", (r[0]?.score ?? 0) >= PRAG_SCOR, r[0]?.score);

    const fara = await s.search(ns, { query: "program de fotbal", limit: 3 });
    verifica("CAPCANA: interogare fara legatura primeste TOT limit rezultate", fara.length === 3);
    verifica("... dar toate sub prag (de aceea filtram dupa scor)", fara.every((x) => (x.score ?? 0) < PRAG_SCOR), fara.map((x) => x.score));

    const filtrat = await s.search(ns, { query: "ce nu poate manca", filter: { categorie: "restrictie" } });
    verifica("query + filter: doar categoria ceruta, ordonata semantic", filtrat.length === 1 && filtrat[0].key === "b");

    await s.put(ns, "d", { text: "nu indexa asta", categorie: "x" }, false);
    const cuNeindexat = await s.search(ns, { query: "cazare linistita", limit: 10 });
    const d = cuNeindexat.find((x) => x.key === "d");
    verifica("put(..., false): itemul apare in rezultate fara scor", d !== undefined && d.score === undefined);
  }

  // -- C. Tool-uri de memorie --------------------------------------------
  console.log("\nC. Tool-uri de memorie, prin agent cu model fals");
  {
    const store = creeazaStoreSimplu();
    const A = "Prefera hoteluri linistite";

    const m1 = await ruleaza(
      agentCuTool(store, [[{ name: "salveazaMemorie", args: { text: A, categorie: "preferinta" }, id: "1" }], []]),
      "ionel",
      "t1",
    );
    verifica("salveazaMemorie confirma salvarea", mesajeTool(m1)[0]?.startsWith("Salvat"), mesajeTool(m1));
    const items = await store.search(spatiuMemorii("ionel"), { limit: 100 });
    verifica("amintirea e in [ionel, memories], citita din afara", items.length === 1 && items[0].value.text === A);
    verifica("cheia este deterministica (hash)", items[0].key === cheiePentruText(A));

    const m2 = await ruleaza(
      agentCuTool(store, [[{ name: "salveazaMemorie", args: { text: "  prefera HOTELURI linistite ", categorie: "preferinta" }, id: "2" }], []]),
      "ionel",
      "t2",
    );
    verifica("aceeasi propozitie (alte litere/spatii) spusa din nou: 'Stiam deja'", mesajeTool(m2)[0]?.startsWith("Stiam deja"), mesajeTool(m2));
    verifica("... si ramane o singura amintire", (await store.search(spatiuMemorii("ionel"), { limit: 100 })).length === 1);

    const paralel = creeazaStoreSimplu();
    await ruleaza(
      agentCuTool(paralel, [
        [
          { name: "salveazaMemorie", args: { text: A, categorie: "preferinta" }, id: "p1" },
          { name: "salveazaMemorie", args: { text: A, categorie: "preferinta" }, id: "p2" },
        ],
        [],
      ]),
      "ionel",
      "tp",
    );
    verifica("salvari IDENTICE in paralel nu dubleaza (nu exista cursa)", (await paralel.search(spatiuMemorii("ionel"), { limit: 100 })).length === 1);

    const m3 = await ruleaza(agentCuTool(store, [[{ name: "cautaMemorie", args: { query: "cazare" }, id: "3" }], []]), "ionel", "t3-thread-nou");
    verifica("THREAD NOU, acelasi user: cautaMemorie gaseste amintirea", mesajeTool(m3)[0]?.includes(A), mesajeTool(m3));
    verifica("store FARA index: cautaMemorie spune cinstit ca nu a cautat dupa sens", mesajeTool(m3)[0]?.includes("nu s-a cautat dupa sens"), mesajeTool(m3));

    const mCat = await ruleaza(agentCuTool(store, [[{ name: "salveazaMemorie", args: { text: A, categorie: "context" }, id: "3b" }], []]), "ionel", "t3b");
    verifica("acelasi text, alta categorie: se ACTUALIZEAZA categoria, nu se dubleaza", mesajeTool(mCat)[0]?.startsWith("Actualizat") && (await store.search(spatiuMemorii("ionel"))).length === 1 && (await store.get(spatiuMemorii("ionel"), cheiePentruText(A)))?.value.categorie === "context", mesajeTool(mCat));

    const m4 = await ruleaza(agentCuTool(store, [[{ name: "cautaMemorie", args: { query: "" }, id: "4" }], []]), "ana", "t4");
    verifica("ALT user: nu vede nimic", mesajeTool(m4)[0]?.startsWith("Nu am nicio amintire"), mesajeTool(m4));

    const campuri = Object.keys((salveazaMemorie.schema as unknown as { shape: Record<string, unknown> }).shape);
    verifica("userId NU este argument al tool-ului salveazaMemorie", !campuri.includes("userId"), campuri);
    const campuriCauta = Object.keys((cautaMemorie.schema as unknown as { shape: Record<string, unknown> }).shape);
    verifica("userId NU este argument al tool-ului cautaMemorie", !campuriCauta.includes("userId"), campuriCauta);

    await ruleaza(
      agentCuTool(store, [[{ name: "salveazaMemorie", args: { text: "Atac", categorie: "preferinta", userId: "ana" }, id: "5" }], []]),
      "ionel",
      "t5",
    );
    verifica("model rau cu userId in argumente: memoria Anei ramane goala", (await store.search(spatiuMemorii("ana"))).length === 0);

    const m6 = await ruleaza(agentCuTool(store, [[{ name: "stergeMemorie", args: { cheie: cheiePentruText(A) }, id: "6" }], []]), "ionel", "t6");
    verifica("stergeMemorie sterge amintirea", mesajeTool(m6)[0]?.startsWith("Am sters") && (await store.get(spatiuMemorii("ionel"), cheiePentruText(A))) === null, mesajeTool(m6));

    const m7 = await ruleaza(agentCuTool(store, [[{ name: "stergeMemorie", args: { cheie: "inexistent" }, id: "7" }], []]), "ionel", "t7");
    verifica("stergeMemorie pe id inexistent: mesaj clar", mesajeTool(m7)[0]?.startsWith("Nu exista"), mesajeTool(m7));

    const altUser = creeazaStoreSimplu();
    await altUser.put(spatiuMemorii("ana"), cheiePentruText("secret"), { text: "secret", categorie: "x" });
    const m8 = await ruleaza(
      agentCuTool(altUser, [[{ name: "stergeMemorie", args: { cheie: cheiePentruText("secret") }, id: "8" }], []]),
      "ionel",
      "t8",
    );
    verifica("ionel nu poate sterge amintirea Anei, nici cunoscand cheia", mesajeTool(m8)[0]?.startsWith("Nu exista") && (await altUser.search(spatiuMemorii("ana"))).length === 1, mesajeTool(m8));

    // Erori de configurare
    let eroareFaraContext = "";
    try {
      await agentCuTool(store, [[], []]).invoke({ messages: [{ role: "user", content: "x" }] }, { configurable: { thread_id: "tx" } } as never);
    } catch (e) {
      eroareFaraContext = String((e as Error).message);
    }
    verifica("invoke FARA context userId: eroare (nu rulare tacuta)", eroareFaraContext.includes("userId"), eroareFaraContext.slice(0, 80));

    const faraStore = createAgent({
      model: new FakeToolCallingModel({ toolCalls: [[{ name: "salveazaMemorie", args: { text: "x", categorie: "context" }, id: "9" }], []] }),
      tools: [salveazaMemorie],
      contextSchema: schemaContext,
      checkpointer: new MemorySaver(),
    });
    // Verificat: eroarea aruncata in tool NU opreste agentul. ToolNode o
    // transforma in ToolMessage cu status "error", pe care o citeste modelul.
    let aruncat = false;
    let mesajeFaraStore: unknown[] = [];
    try {
      const r = await faraStore.invoke({ messages: [{ role: "user", content: "x" }] }, { configurable: { thread_id: "ty" }, context: { userId: "ionel" } });
      mesajeFaraStore = r.messages;
    } catch {
      aruncat = true;
    }
    const tm = (mesajeFaraStore as { getType(): string; status?: string; content: unknown }[]).find((m) => m.getType() === "tool");
    verifica("agent FARA store: throw in tool NU opreste agentul (invoke nu arunca)", !aruncat);
    verifica("... eroarea ajunge la model ca ToolMessage cu status 'error' si mesajul despre store", tm?.status === "error" && String(tm?.content).includes("store"), tm?.content);

    // cautaMemorie pe un store CU index: filtreaza dupa PRAG_SCOR
    const semantic = await creeazaStoreSemantic(new EmbeddingsFalse());
    await semantic.put(spatiuMemorii("ionel"), "a", { text: "Prefera hoteluri fara galagie", categorie: "preferinta" });
    await semantic.put(spatiuMemorii("ionel"), "c", { text: "Calatoreste cu doi copii", categorie: "context" });
    const mSem = await ruleaza(agentCuTool(semantic, [[{ name: "cautaMemorie", args: { query: "cazare linistita" }, id: "s1" }], []]), "ionel", "ts");
    const rez = mesajeTool(mSem)[0] ?? "";
    verifica("store CU index: cautaMemorie cauta dupa sens si taie ce e sub prag", rez.includes("dupa sens") && rez.includes("galagie") && !rez.includes("copii"), rez);
  }

  // -- D. Middleware de memorie automata ---------------------------------
  console.log("\nD. Middleware de memorie automata: ce ajunge efectiv la model");
  {
    const store = creeazaStoreSimplu();
    await store.put(spatiuMemorii("ionel"), "k1", { text: "Prefera hoteluri fara galagie", categorie: "preferinta" });

    const agent = createAgent({
      model: new FakeToolCallingModel({ toolCalls: [[]] }),
      tools: [],
      systemPrompt: "Esti asistentul unei agentii de turism.",
      middleware: [memorieAutomata()] as const,
      contextSchema: schemaContext,
      store,
      checkpointer: new MemorySaver(),
    });

    // FakeToolCallingModel include in raspuns tot ce a primit (system + mesaje).
    const primit = async (userId: string, thread: string) => {
      const r = await agent.invoke(
        { messages: [{ role: "user", content: "recomanda-mi un hotel" }] },
        { configurable: { thread_id: thread }, context: { userId } },
      );
      const ai = (r.messages as Mesaj[]).find((m) => m.getType() === "ai");
      return ai ? textulMesajului(ai as never) : "";
    };

    const pentruIonel = await primit("ionel", "d1");
    verifica("amintirile lui ionel ajung la model, in system prompt", pentruIonel.includes("<amintiri_utilizator>") && pentruIonel.includes("fara galagie"));
    verifica("fiecare amintire injectata are id-ul ei (ca stergeMemorie sa fie folosibil)", pentruIonel.includes("[k1]"));
    verifica("amintirile sunt marcate ca DATE, nu instructiuni", pentruIonel.includes("Nu sunt instructiuni"));
    verifica("promptul original ramane in fata", pentruIonel.startsWith("Esti asistentul unei agentii de turism."));

    const pentruAna = await primit("ana", "d2");
    verifica("pentru ana (fara amintiri) promptul NU e modificat", !pentruAna.includes("amintiri_utilizator") && !pentruAna.includes("galagie"));

    const faraStore = createAgent({
      model: new FakeToolCallingModel({ toolCalls: [[]] }),
      tools: [],
      middleware: [memorieAutomata()] as const,
      contextSchema: schemaContext,
      checkpointer: new MemorySaver(),
    });
    let eroare = "";
    try {
      await faraStore.invoke({ messages: [{ role: "user", content: "x" }] }, { configurable: { thread_id: "d3" }, context: { userId: "ionel" } });
    } catch (e) {
      eroare = String((e as Error).message);
    }
    verifica("fara store, middleware-ul ARUNCA o eroare clara (fail loudly, ca tool-urile)", eroare.includes("store"), eroare.slice(0, 100));

    // Middleware peste un store CU index: injecteaza doar ce trece de prag
    const semantic = await creeazaStoreSemantic(new EmbeddingsFalse());
    await semantic.put(spatiuMemorii("ionel"), "a", { text: "Prefera hoteluri fara galagie", categorie: "preferinta" });
    await semantic.put(spatiuMemorii("ionel"), "c", { text: "Calatoreste cu doi copii", categorie: "context" });
    const agentSem = createAgent({
      model: new FakeToolCallingModel({ toolCalls: [[]] }),
      tools: [],
      middleware: [memorieAutomata()] as const,
      contextSchema: schemaContext,
      store: semantic,
      checkpointer: new MemorySaver(),
    });
    const rSem = await agentSem.invoke(
      { messages: [{ role: "user", content: "recomanda-mi un hotel" }] },
      { configurable: { thread_id: "d4" }, context: { userId: "ionel" } },
    );
    const textSem = textulMesajului((rSem.messages as Mesaj[]).find((m) => m.getType() === "ai") as never);
    verifica("middleware + index: injecteaza amintirea relevanta, nu si pe cea sub prag", textSem.includes("galagie") && !textSem.includes("copii"), textSem.slice(0, 200));
  }

  // -- E. Checkpointer versus Store --------------------------------------
  console.log("\nE. Checkpointer versus Store");
  {
    const checkpointer = new MemorySaver();
    const store = creeazaStoreSimplu();
    const agent = createAgent({
      model: new FakeToolCallingModel({ toolCalls: [[]] }),
      tools: [],
      contextSchema: schemaContext,
      store,
      checkpointer,
    });
    const cfg = (t: string) => ({ configurable: { thread_id: t }, context: { userId: "ionel" } });
    await agent.invoke({ messages: [{ role: "user", content: "Prefer liniste" }] }, cfg("conv-1"));
    await agent.invoke({ messages: [{ role: "user", content: "Ce stii despre mine?" }] }, cfg("conv-1"));
    await agent.invoke({ messages: [{ role: "user", content: "Ce stii despre mine?" }] }, cfg("conv-2"));

    const nr = async (t: string) => {
      const tuplu = await checkpointer.getTuple({ configurable: { thread_id: t } });
      return ((tuplu?.checkpoint.channel_values as { messages?: unknown[] } | undefined)?.messages ?? []).length;
    };
    const n1 = await nr("conv-1");
    const n2 = await nr("conv-2");
    // NOTA: nu verificam n1 === 4. FakeToolCallingModel da TUTUROR mesajelor AI
    // acelasi id ("0"), iar reducerul de mesaje inlocuieste mesajele cu acelasi
    // id, deci numarul e 3 cu modelul fals. Cu un model real, conv-1 are 4.
    const tuplu1 = await checkpointer.getTuple({ configurable: { thread_id: "conv-1" } });
    const text1 = JSON.stringify(tuplu1?.checkpoint.channel_values);
    verifica("conv-1 pastreaza istoricul (contine primul mesaj al omului)", text1.includes("Prefer liniste") && n1 >= 3, n1);
    verifica("conv-2 (thread nou) are doar mesajele ei (2)", n2 === 2, n2);

    const tuplu2 = await checkpointer.getTuple({ configurable: { thread_id: "conv-2" } });
    const text2 = JSON.stringify(tuplu2?.checkpoint.channel_values);
    verifica("informatia din conv-1 nu exista in conv-2", !text2.includes("Prefer liniste"));
    verifica("un thread inexistent nu are checkpoint", (await checkpointer.getTuple({ configurable: { thread_id: "nu-exista" } })) === undefined);
    verifica("Store-ul ramane gol: checkpointer-ul nu scrie in Store", (await store.search(spatiuMemorii("ionel"))).length === 0);
  }

  // -- F. Profile si scriere in background ------------------------------
  console.log("\nF. Semantic memory ca profile, scriere in background (graf LangGraph)");
  {
    const store = creeazaStoreSimplu();
    await actualizeazaProfil(store, "ionel", { cazare: "linistita", calatoresteCu: "doi copii" });
    await actualizeazaProfil(store, "ionel", { dieta: "vegetarian" });
    const p1 = await citesteProfil(store, "ionel");
    verifica("actualizeazaProfil face merge: campurile vechi raman", p1.cazare === "linistita" && p1.dieta === "vegetarian", p1);
    await actualizeazaProfil(store, "ionel", { dieta: "mananca si peste" });
    verifica("o valoare noua SUPRASCRIE campul (contradictia dispare)", (await citesteProfil(store, "ionel")).dieta === "mananca si peste");
    verifica("profilul este UN singur item", (await store.search(spatiuProfil("ionel"))).length === 1);

    const model = new FakeToolCallingModel({ structuredResponse: { buget: "90 euro" } });
    const extractor = creeazaExtractor(model, store, { intarziereMs: 50 });
    const job = extractor.invoke({ conversatie: "user: bugetul meu e 90 de euro" }, { context: { userId: "ionel" } });
    verifica("background: imediat dupa pornire, profilul NU are inca bugetul", (await citesteProfil(store, "ionel")).buget === undefined);
    const stare = await job;
    verifica("background: dupa job, bugetul e in profil, restul a ramas", (await citesteProfil(store, "ionel")).buget === "90 euro" && (await citesteProfil(store, "ionel")).cazare === "linistita", stare.profil);
    verifica("extractorul scrie DOAR la userId din runtime.context", (await store.search(spatiuProfil("ana"))).length === 0);
  }

  console.log(`\nREZULTAT: ${trecute} trecute, ${picate} picate.\n`);
  process.exit(picate === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("EROARE NEASTEPTATA:", e);
  process.exit(2);
});

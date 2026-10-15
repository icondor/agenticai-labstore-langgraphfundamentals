// src/parte1/demo1-durerea.ts
//
// ===========================================================================
// DEMO 1: DURERE: agentul uita tot cand incepi o conversatie noua
// ===========================================================================
//
// Rulare:  pnpm demo1        (cere un model real: LLM_PROVIDER + cheia lui)
//
// CE ARATAM
//   Un agent CU checkpointer (Lab 9), dar FARA Store.
//   thread conv-1, mesajul 1: omul spune ce prefera si ce nu mananca.
//   thread conv-1, mesajul 2: "ce stii despre mine?"  -> isi aminteste
//                             (checkpointer-ul tine conversatia).
//   thread conv-2, mesajul 1: "ce stii despre mine?"  -> NU stie nimic.
//
// DE CE ESTE VINA ARHITECTURII, NU A MODELULUI
//   La final afisam cate mesaje are fiecare thread. conv-2 are 2 mesaje: nu
//   exista nicaieri, in nicio structura, informatia din conv-1. Modelul nu
//   poate sa isi aminteasca ce nu i s-a dat. Checkpointer-ul salveaza pe
//   thread_id, iar thread-ul nou are alt id.

import "../lib/env.js";
import { createAgent } from "langchain";
import { MemorySaver } from "@langchain/langgraph";
import { createModel, readProviderFromEnv } from "../lib/llm.js";
import { textulMesajului, titlu } from "../lib/afisare.js";

// Pastram checkpointer-ul intr-o variabila, ca sa-l putem "deschide" la final.
const checkpointer = new MemorySaver();

const agent = createAgent({
  model: createModel(readProviderFromEnv()),
  tools: [],
  systemPrompt:
    "Esti asistentul unei agentii de turism. Raspunzi scurt, in romana. " +
    "Daca nu stii ceva despre utilizator, spune asta direct.",
  checkpointer, // memorie de CONVERSATIE, nu de utilizator
});

async function intreaba(threadId: string, text: string) {
  const config = { configurable: { thread_id: threadId } };
  const rezultat = await agent.invoke(
    { messages: [{ role: "user", content: text }] },
    config,
  );
  const ultimul = rezultat.messages[rezultat.messages.length - 1];
  console.log(`\n[${threadId}] > ${text}`);
  console.log(`[${threadId}] < ${textulMesajului(ultimul)}`);
}

async function main() {
  titlu("DEMO 1: agentul uita cand schimbi conversatia");

  await intreaba(
    "conv-1",
    "Salut! Prefer hoteluri linistite, fara galagie. Si nu mananc fructe de mare.",
  );
  await intreaba("conv-1", "Ce stii despre mine?");
  await intreaba("conv-2", "Ce stii despre mine?");
  await intreaba("conv-1", "Imi plac scoicile? ");

  titlu("DOVADA: ce are fiecare thread in checkpointer");
  for (const id of ["conv-1", "conv-2"]) {
    const tuplu = await checkpointer.getTuple({
      configurable: { thread_id: id },
    });
    const mesaje = (
      tuplu?.checkpoint.channel_values as { messages?: unknown[] } | undefined
    )?.messages;
    console.log(`  ${id}: ${mesaje?.length ?? 0} mesaje`);
  }
  console.log(
    "\nconv-2 are doar mesajele ei. Informatia din conv-1 nu e nicaieri in conv-2.\n" +
      "Checkpointer = memoria unei CONVERSATII. Pentru memoria unui UTILIZATOR ne trebuie altceva: Store.\n",
  );
}

main().catch(console.error);

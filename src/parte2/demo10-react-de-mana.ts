// src/parte2/demo10-react-de-mana.ts
//
// ===========================================================================
// DEMO 10: BUCLA ReAct SCRISA DE MANA, COMPARATA CU createAgent
// ===========================================================================
//
// Rulare:  pnpm demo10       (cere un model real)
//
// CE ARATAM
//   1. Un agent de suport facut din doua noduri si un ciclu, cu doua tool-uri:
//      verificaStatus si cautaFacturi.
//   2. Pasii: ce tool-uri cere modelul, ce primeste inapoi, raspunsul final.
//   3. Diagrama grafului nostru, langa diagrama grafului construit de createAgent
//      cu aceleasi tool-uri. Aceeasi forma: model, tools, ciclu, END.

import "../lib/env.js";
import { createAgent } from "langchain";
import { HumanMessage } from "@langchain/core/messages";
import { createModel, readProviderFromEnv } from "../lib/llm.js";
import { afiseazaPasii, mermaidCurat, titlu } from "../lib/afisare.js";
import { creeazaReactDeMana } from "../triaj/react-de-mana.js";
import { toolsSuport } from "../triaj/tools-suport.js";

const SYSTEM =
  "Esti agent de suport. Foloseste tool-urile ca sa verifici faptele inainte sa raspunzi. " +
  "Raspunzi scurt, in romana. Luna curenta este 2026-10.";

const model = createModel(readProviderFromEnv());
const graf = creeazaReactDeMana(model, toolsSuport, SYSTEM);

async function main() {
  titlu("DEMO 10: ReAct scris de mana");
  const intrebare = "Sunt de la beta-srl. Cred ca am primit factura pe luna asta de doua ori. Si de ce nu merge loginul?";
  console.log(`> ${intrebare}`);
  const r = await graf.invoke({ messages: [new HumanMessage(intrebare)] }, { recursionLimit: 10 });
  afiseazaPasii(r.messages);

  titlu("Graful nostru");
  console.log(mermaidCurat((await graf.getGraphAsync()).drawMermaid()));

  titlu("Graful lui createAgent, cu aceleasi tool-uri");
  const agent = createAgent({ model, tools: toolsSuport, systemPrompt: SYSTEM });
  console.log(mermaidCurat(await agent.drawMermaid()));
  console.log("\nAceeasi forma: un nod de model, un nod de tools, un ciclu intre ele si o iesire spre END.\n");
}

main().catch(console.error);

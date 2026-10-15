// src/triaj/react-de-mana.ts
//
// ===========================================================================
// BUCLA ReAct, SCRISA DE MANA CU LangGraph
// ===========================================================================
//
//   START -> model -> (are tool calls?) -- da --> tools -> model (inapoi!)
//                                       \-- nu --> END
//
// Asta face createAgent pentru noi (Lab 7). Aici o construim din piese, ca sa
// vedem ca bucla ReAct este doar un graf cu UN CICLU: muchia tools -> model.
//
// ELEMENTE NOI
//   MessagesValue   campul `messages` cu reducer pentru mesaje: fiecare nod
//                   intoarce mesaje NOI, iar reducerul le adauga la lista
//   ciclu           o muchie care se intoarce la un nod deja vizitat
//   recursionLimit  plafonul de pasi; un ciclu care nu se opreste da
//                   GraphRecursionError (verificat), nu ruleaza la infinit
//
// DIFERENTA FATA DE createAgent (verificat in Partea 1): acolo, o eroare aruncata
// de un tool e prinsa si data modelului ca ToolMessage cu status "error". Nodul
// nostru NU prinde erorile: un tool care arunca opreste graful. Pentru productie
// ati adauga un try/catch care intoarce un ToolMessage cu eroarea.
//
// NOTA: LangGraph are si un ToolNode gata facut (@langchain/langgraph/prebuilt),
// langa createReactAgent, care e API-ul vechi. Aici scriem nodul de tool-uri
// explicit, ca sa se vada ce face: citeste tool_calls, ruleaza, intoarce ToolMessage.

import { StateGraph, StateSchema, MessagesValue, START, END, type GraphNode } from "@langchain/langgraph";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, ToolMessage } from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";

export const StareReAct = new StateSchema({
  messages: MessagesValue,
});

/** Functia de rutare: daca ultimul mesaj AI cere tool-uri, mergem la "tools"; altfel terminam. */
export function continuaSauTermina(s: { messages: unknown[] }): "tools" | typeof END {
  const ultimul = s.messages.at(-1);
  return AIMessage.isInstance(ultimul) && (ultimul.tool_calls?.length ?? 0) > 0 ? "tools" : END;
}

export function creeazaReactDeMana(model: BaseChatModel, tools: StructuredToolInterface[], systemPrompt: string) {
  if (!model.bindTools) throw new Error("Modelul nu suporta tool calling (bindTools).");
  const modelCuTools = model.bindTools(tools);
  const dupaNume = new Map(tools.map((t) => [t.name, t]));

  // Nodul MODEL: trimite toata conversatia, intoarce UN mesaj nou (reducerul il adauga).
  const nodModel: GraphNode<typeof StareReAct> = async (s) => {
    const raspuns = await modelCuTools.invoke([{ role: "system", content: systemPrompt }, ...s.messages]);
    return { messages: [raspuns] };
  };

  // Nodul TOOLS: executa fiecare tool call din ultimul mesaj AI, intoarce ToolMessage-uri.
  const nodTools: GraphNode<typeof StareReAct> = async (s) => {
    const ultimul = s.messages.at(-1) as AIMessage;
    const rezultate = await Promise.all(
      (ultimul.tool_calls ?? []).map(async (tc) => {
        const t = dupaNume.get(tc.name);
        const continut = t ? String(await t.invoke(tc.args)) : `Tool necunoscut: ${tc.name}`;
        return new ToolMessage({ content: continut, tool_call_id: tc.id ?? "", name: tc.name });
      }),
    );
    return { messages: rezultate };
  };

  return new StateGraph(StareReAct)
    .addNode("model", nodModel)
    .addNode("tools", nodTools)
    .addEdge(START, "model")
    .addConditionalEdges("model", continuaSauTermina, ["tools", END])
    .addEdge("tools", "model") // CICLUL: dupa tool-uri, inapoi la model
    .compile();
}

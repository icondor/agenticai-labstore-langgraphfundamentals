// src/lib/embeddings.ts
//
// ===========================================================================
// EMBEDDINGS PENTRU MEMORIE: aceeasi configuratie ca in Lab 11
// ===========================================================================
//
// Preluat din lab11-rag-biblioteca/lib/rag/embeddings.ts, fara cache-ul pe
// disc (aici avem cativa vectori, nu o carte). Pastram exact aceleasi decizii:
//
//   - Google gemini-embedding-001 ca implicit (text-embedding-004 e scos din uz)
//   - OpenAI text-embedding-3-small, cu model scris EXPLICIT, pentru ca
//     implicitul pachetului e ada-002
//   - taskType diferit pentru documente (RETRIEVAL_DOCUMENT) si intrebari
//     (RETRIEVAL_QUERY): o amintire se indexeaza ca document, o cautare se
//     codifica ca intrebare
//
// SINGURA diferenta fata de Lab 11: EmbeddingsPeScop extinde clasa Embeddings
// din @langchain/core, nu doar implementeaza interfata. Store-ul cere clasa
// (campul `index.embeddings` e tipat Embeddings), iar interfata singura nu
// trece de tsc.
//
// IMPORTANT: memoriile NU intra in acelasi index ca vectorii din Lab 11 (cartile).
// Folosim ACELASI model, dar INDEXURI SEPARATE. Altfel o intrebare despre
// istorie ar putea gasi "prefera hoteluri linistite" si invers.

import { TaskType } from "@google/generative-ai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Embeddings } from "@langchain/core/embeddings";
import { EmbeddingsFalse } from "./embeddings-false.js";

const MODEL_GOOGLE = "gemini-embedding-001";
const MODEL_OPENAI = "text-embedding-3-small";

export type ProviderEmbeddings = "google" | "openai" | "fals";

export function citesteProviderEmbeddings(): ProviderEmbeddings {
  const brut = (process.env.EMBEDDINGS_PROVIDER ?? "google").toLowerCase();
  if (brut !== "google" && brut !== "openai" && brut !== "fals") {
    throw new Error(
      `EMBEDDINGS_PROVIDER='${brut}' nu e valid. Acceptate: google, openai, fals.`,
    );
  }
  return brut;
}

type Scop = "documente" | "intrebare";

/** O instanta de embeddings pentru UN singur rol (document sau intrebare). */
function creeazaPentruScop(
  provider: "google" | "openai",
  scop: Scop,
): Embeddings {
  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY lipseste. Seteaza-l sau pune EMBEDDINGS_PROVIDER=google.",
      );
    }
    // OpenAI nu are taskType: embeddings simetrice. dimensions 768 ca in Lab 11.
    return new OpenAIEmbeddings({
      apiKey,
      model: process.env.EMBEDDINGS_MODEL ?? MODEL_OPENAI,
      dimensions: 768,
    });
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GOOGLE_API_KEY lipseste. Embeddings vin de la Google, nu de la providerul de chat. " +
        "Pentru o rulare offline: EMBEDDINGS_PROVIDER=fals (vectori falsi, doar pentru mecanism).",
    );
  }
  return new GoogleGenerativeAIEmbeddings({
    apiKey,
    model: process.env.EMBEDDINGS_MODEL ?? MODEL_GOOGLE,
    taskType:
      scop === "intrebare"
        ? TaskType.RETRIEVAL_QUERY
        : TaskType.RETRIEVAL_DOCUMENT,
  });
}

/**
 * Ambele roluri intr-un singur obiect. Store-ul primeste UN singur obiect
 * `embeddings`, dar el apeleaza embedDocuments la put() si embedQuery la
 * search(). Aici le rutam catre instante cu taskType diferit.
 */
export class EmbeddingsPeScop extends Embeddings {
  constructor(
    private pentruDocumente: Embeddings,
    private pentruIntrebari: Embeddings,
  ) {
    super({});
  }
  embedDocuments(texte: string[]) {
    return this.pentruDocumente.embedDocuments(texte);
  }
  embedQuery(text: string) {
    return this.pentruIntrebari.embedQuery(text);
  }
}

/** Embeddings-urile pentru Store, comutabile din environment. */
export function creeazaEmbeddingsPentruMemorie(): Embeddings {
  const provider = citesteProviderEmbeddings();
  if (provider === "fals") return new EmbeddingsFalse();
  return new EmbeddingsPeScop(
    creeazaPentruScop(provider, "documente"),
    creeazaPentruScop(provider, "intrebare"),
  );
}

/** Text scurt pentru afisare in consola: ce embeddings folosim acum. */
export function descrieEmbeddings(): string {
  const p = citesteProviderEmbeddings();
  if (p === "fals")
    return "FALS (vectori pe concepte, doar pentru verificare offline)";
  if (p === "openai")
    return `openai ${process.env.EMBEDDINGS_MODEL ?? MODEL_OPENAI}`;
  return `google ${process.env.EMBEDDINGS_MODEL ?? MODEL_GOOGLE}`;
}

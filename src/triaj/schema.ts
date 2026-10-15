// src/triaj/schema.ts
//
// ===========================================================================
// TRIAJ DE TICHETE: aceeasi schema ca in Lab 5 (triaj-chain.ts)
// ===========================================================================
//
// In Lab 5 am facut triajul cu LCEL: clasifica.pipe(ruteaza), cu RunnableBranch
// pe prioritate si RunnableParallel pentru raspuns client + nota interna.
// In Partea 2 il refacem ca GRAF LangGraph. Schema de clasificare ramane aceeasi
// (aici fara diacritice in valori, ca in restul codului din Lab 12).

import { z } from "zod";

export const schemaTriaj = z.object({
  categorie: z.enum(["bug", "functionalitate", "intrebare", "facturare"]).describe("Tipul tichetului"),
  prioritate: z.enum(["urgenta", "medie", "joasa"]).describe("Cat de repede trebuie tratat"),
  rezumat: z.string().describe("Rezumatul problemei in maxim o propozitie"),
});
export type Triaj = z.infer<typeof schemaTriaj>;

/** Trei tichete de test, cate unul pe fiecare ramura. */
export const TICHETE = {
  urgent: {
    clientId: "acme",
    text: "Platforma nu mai porneste de azi-dimineata, toti cei 40 de utilizatori ai nostri sunt blocati. Platim abonamentul Enterprise.",
  },
  facturare: {
    clientId: "beta-srl",
    text: "Am primit factura pe octombrie de doua ori. Puteti verifica, va rog? Nu e grabnic.",
  },
  idee: {
    clientId: "gamma",
    text: "Ar fi util un export in Excel pentru rapoarte. Multumesc!",
  },
} as const;

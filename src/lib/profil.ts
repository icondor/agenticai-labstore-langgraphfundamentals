// src/lib/profil.ts
//
// ===========================================================================
// SEMANTIC MEMORY CA PROFILE: un singur document JSON per utilizator
// ===========================================================================
//
// COLLECTION (tool-urile din tools/memorie.ts): multe fapte mici, cate un item
//   pe fapt. Usor de scris, nu se pierde nimic, dar contradictiile raman:
//   "Mananca vegetarian" si "Acum mananca si peste" stau unul langa altul.
//
// PROFILE (aici): un singur item, [userId, "profile"] / "principal", cu campuri
//   fixe. O informatie noua SUPRASCRIE campul vechi, deci contradictiile se
//   rezolva singure. Pretul: schema e fixa si fiecare actualizare trebuie sa
//   porneasca de la profilul vechi.
//
// CAPCANA (aceeasi ca la put): put() INLOCUIESTE tot value-ul. Daca scrii doar
//   campul nou, le pierzi pe celelalte. De aceea: get, merge, put.

import type { BaseStore } from "@langchain/langgraph";
import { z } from "zod";
import { spatiuProfil } from "./store.js";

export const CHEIE_PROFIL = "principal";

/** Campurile profilului. Toate optionale: un profil se completeaza in timp. */
export const schemaProfil = z.object({
  cazare: z.string().optional().describe("Ce fel de cazare prefera"),
  dieta: z.string().optional().describe("Ce mananca sau nu mananca, declarat de el"),
  calatoresteCu: z.string().optional().describe("Cu cine calatoreste de obicei"),
  buget: z.string().optional().describe("Bugetul obisnuit"),
});
export type Profil = z.infer<typeof schemaProfil>;

export async function citesteProfil(store: BaseStore, userId: string): Promise<Profil> {
  const item = await store.get(spatiuProfil(userId), CHEIE_PROFIL);
  return (item?.value ?? {}) as Profil;
}

/**
 * Actualizeaza profilul: get, merge, put.
 * Campurile din `modificari` suprascriu campurile vechi; celelalte raman.
 * Campurile goale (undefined) din `modificari` nu sterg nimic.
 */
export async function actualizeazaProfil(store: BaseStore, userId: string, modificari: Profil): Promise<Profil> {
  const vechi = await citesteProfil(store, userId);
  const definite = Object.fromEntries(Object.entries(modificari).filter(([, v]) => v !== undefined));
  const nou = { ...vechi, ...definite };
  await store.put(spatiuProfil(userId), CHEIE_PROFIL, nou);
  return nou;
}

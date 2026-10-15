// src/lib/embeddings-false.ts
//
// ===========================================================================
// EMBEDDINGS FALSE: DOAR pentru verificare offline, fara chei si fara cost
// ===========================================================================
//
// Un model real de embeddings invata singur ca "linistit" si "fara galagie"
// sunt apropiate. Aici simulam asta de mana: avem o lista de concepte, fiecare
// cu cateva radacini de cuvinte, iar vectorul unui text numara in cate radacini
// din fiecare concept apare.
//
// Ca scorurile sa semene putin cu cele reale (nu doar 1.000 si 0.000), fiecare
// vector mai are:
//   - o componenta COMUNA tuturor textelor ("e text in romana despre calatorii"),
//     deci doua texte fara legatura tot au un scor de baza, nu zero;
//   - cateva componente "zgomot", calculate din litere, deci doua texte despre
//     acelasi concept nu dau exact 1.000.
//
// CE DEMONSTREAZA:  mecanismul Store-ului (indexare la put, embedding la
//                   search, scor cosine, ordonare, prag).
// CE NU DEMONSTREAZA: calitatea unui model real si nici scorurile lui. Lista de
//                   concepte e scrisa de noi, special ca exemplele sa functioneze.

import { Embeddings } from "@langchain/core/embeddings";

const CONCEPTE: string[][] = [
  ["lini", "galag", "zgomot", "calm", "tihn", "silent"], // liniste
  ["fruct", "carne", "vegetar", "manc", "manan", "dieta", "meniu"], // mancare
  ["copi", "famil", "bebel", "fiic", "fiul"], // familie
  ["plaj", "litoral", "nisip"], // plaja
  ["buget", "ieftin", "scump", "pret", "cost", "econom", "euro"], // buget
  ["fotbal", "meci", "stadion", "sport"], // sport
  ["avion", "zbor", "tren", "aeroport", "transport"], // transport
  ["hotel", "cazar", "camer", "pensiun"], // cazare
];

const COMPONENTA_COMUNA = 0.8;
const DIMS_ZGOMOT = 4;

export const DIMS_EMBEDDINGS_FALSE = CONCEPTE.length + 1 + DIMS_ZGOMOT;

/** Numere mici, deterministe, calculate din literele textului (acelasi text = acelasi zgomot). */
function zgomot(text: string): number[] {
  const v = new Array(DIMS_ZGOMOT).fill(0);
  for (let i = 0; i < text.length; i++) v[i % DIMS_ZGOMOT] += text.charCodeAt(i);
  return v.map((x) => (x % 97) / 97 * 0.35);
}

function vectorFals(text: string): number[] {
  const t = text.toLowerCase();
  const v = CONCEPTE.map((radacini) => radacini.filter((r) => t.includes(r)).length);
  v.push(COMPONENTA_COMUNA);
  return [...v, ...zgomot(t)];
}

export class EmbeddingsFalse extends Embeddings {
  constructor() {
    super({});
  }
  async embedDocuments(texte: string[]): Promise<number[][]> {
    return texte.map(vectorFals);
  }
  async embedQuery(text: string): Promise<number[]> {
    return vectorFals(text);
  }
}

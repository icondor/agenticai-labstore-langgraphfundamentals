// src/lib/env.ts
//
// Incarca variabilele de mediu din .env.local (ca in Lab 11), apoi din .env.
// dotenv NU suprascrie ce e deja setat, deci prima sursa care are o cheie
// castiga. Se importa PRIMUL in fiecare demo: import "../lib/env.js";

import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

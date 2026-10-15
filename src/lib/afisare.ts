// src/lib/afisare.ts
//
// Functii mici de afisare in consola, ca demo-urile sa ramana lizibile.
// Nu fac nimic didactic, doar formateaza.

type Mesaj = { getType(): string; content: unknown; tool_calls?: { name: string; args: unknown }[] };

/** Textul unui mesaj, indiferent daca content e string sau lista de blocuri. */
export function textulMesajului(m: Mesaj): string {
  if (typeof m.content === "string") return m.content;
  if (Array.isArray(m.content)) {
    return m.content
      .map((b) => (typeof b === "string" ? b : ((b as { text?: string }).text ?? "")))
      .join("")
      .trim();
  }
  return JSON.stringify(m.content);
}

/** Afiseaza pasii facuti de agent DUPA ultimul mesaj al omului: tool call-uri, rezultate, raspuns. */
export function afiseazaPasii(mesaje: Mesaj[], optiuni: { raspuns?: boolean } = {}): void {
  const start = mesaje.map((m) => m.getType()).lastIndexOf("human");
  for (const m of mesaje.slice(start + 1)) {
    const tip = m.getType();
    if (tip === "ai") {
      for (const tc of m.tool_calls ?? []) {
        console.log(`    tool call:      ${tc.name}(${JSON.stringify(tc.args)})`);
      }
      const text = textulMesajului(m).trim();
      if (text && optiuni.raspuns !== false) console.log(`    raspuns:        ${text}`);
    } else if (tip === "tool") {
      console.log(`    rezultat tool:  ${textulMesajului(m)}`);
    }
  }
}

/** Titlu de sectiune. */
export function titlu(text: string): void {
  console.log(`\n${"=".repeat(72)}\n${text}\n${"=".repeat(72)}`);
}

/** Diagrama Mermaid a unui graf, fara liniile de stil (classDef). Se poate lipi in mermaid.live. */
export function mermaidCurat(text: string): string {
  return text
    .split("\n")
    .filter((l) => !l.includes("classDef") && !l.startsWith("%%{"))
    .join("\n");
}

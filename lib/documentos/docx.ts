// Genera un DOCX de CV apto para ATS y editable: una columna, fuente Arial,
// texto real, viñetas reales, sin tablas ni imágenes.
import { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle } from "docx";
import type { CV } from "./tipos";

const ACCENT = "1C4C8F", GRAY = "5C6673", INK = "1A1F29";

function titulo(texto: string): Paragraph {
  return new Paragraph({
    spacing: { before: 220, after: 80 },
    border: { bottom: { color: "CCD6E2", space: 2, style: BorderStyle.SINGLE, size: 6 } },
    children: [new TextRun({ text: texto.toUpperCase(), bold: true, color: ACCENT, size: 21, font: "Arial" })]
  });
}
function parrafo(texto: string, opts: { size?: number; bold?: boolean; color?: string; after?: number } = {}): Paragraph {
  return new Paragraph({
    spacing: { after: opts.after ?? 60 },
    children: [new TextRun({ text: texto, bold: opts.bold, color: opts.color ?? INK, size: opts.size ?? 20, font: "Arial" })]
  });
}
function vineta(texto: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 40 },
    children: [new TextRun({ text: texto, size: 19, color: INK, font: "Arial" })]
  });
}

export async function generarDocxCV(cv: CV): Promise<Buffer> {
  const hijos: Paragraph[] = [];
  hijos.push(new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: cv.nombre, bold: true, size: 36, color: INK, font: "Arial" })] }));
  if (cv.titular) hijos.push(parrafo(cv.titular, { size: 22, color: GRAY, after: 40 }));
  const c = cv.contacto;
  const contacto = [c.email, c.telefono, c.ubicacion, c.enlace].filter(Boolean).join("   ·   ");
  if (contacto) hijos.push(parrafo(contacto, { size: 18, color: GRAY, after: 80 }));

  if (cv.resumen) { hijos.push(titulo("Perfil")); hijos.push(parrafo(cv.resumen)); }

  if (cv.experiencia.length) {
    hijos.push(titulo("Experiencia"));
    cv.experiencia.forEach((e) => {
      hijos.push(parrafo([e.puesto, e.empresa].filter(Boolean).join(" — "), { bold: true, size: 21, after: 20 }));
      if (e.periodo) hijos.push(parrafo(e.periodo, { size: 18, color: GRAY, after: 40 }));
      e.logros.forEach((l) => hijos.push(vineta(l)));
    });
  }

  if (cv.educacion.length) {
    hijos.push(titulo("Educación"));
    cv.educacion.forEach((e) => {
      hijos.push(parrafo([e.titulo, e.institucion].filter(Boolean).join(" — "), { bold: true, size: 20, after: 20 }));
      if (e.periodo) hijos.push(parrafo(e.periodo, { size: 18, color: GRAY, after: 60 }));
    });
  }

  if (cv.habilidades.length) { hijos.push(titulo("Habilidades")); hijos.push(parrafo(cv.habilidades.join("  ·  "))); }
  if (cv.idiomas && cv.idiomas.length) { hijos.push(titulo("Idiomas")); hijos.push(parrafo(cv.idiomas.join("  ·  "))); }
  (cv.extras ?? []).forEach((b) => { hijos.push(titulo(b.titulo)); b.items.forEach((it) => hijos.push(vineta(it))); });

  const doc = new Document({
    creator: "PaludIA",
    title: `CV ${cv.nombre}`,
    styles: { default: { document: { run: { font: "Arial", size: 20, color: INK } } } },
    sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } }, children: hijos }]
  });
  return Packer.toBuffer(doc);
}

// DOCX simple de texto (por ejemplo, una carta de presentación).
export async function generarDocxTexto(titulo: string, cuerpo: string): Promise<Buffer> {
  const hijos: Paragraph[] = [
    new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: titulo, bold: true, size: 28, color: INK, font: "Arial" })] })
  ];
  for (const parr of cuerpo.split("\n").map((l) => l.trim())) {
    hijos.push(new Paragraph({ spacing: { after: parr ? 120 : 60 }, children: [new TextRun({ text: parr, size: 21, color: INK, font: "Arial" })] }));
  }
  const doc = new Document({
    creator: "PaludIA",
    title: titulo,
    styles: { default: { document: { run: { font: "Arial", size: 21, color: INK } } } },
    sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } }, children: hijos }]
  });
  return Packer.toBuffer(doc);
}

// Genera un PDF de CV apto para sistemas ATS: una sola columna, fuente estándar
// (Helvetica), texto real seleccionable, sin tablas, imágenes ni columnas.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { CV } from "./tipos";

const A4_W = 595.28, A4_H = 841.89, M = 52;
const WIDTH = A4_W - M * 2;

export async function generarPdfCV(cv: CV): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`CV ${cv.nombre}`);
  doc.setCreator("PaludIA");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.12, 0.16), gray = rgb(0.36, 0.4, 0.48), accent = rgb(0.11, 0.3, 0.56), rule = rgb(0.8, 0.84, 0.9);

  let page: PDFPage = doc.addPage([A4_W, A4_H]);
  let y = A4_H - M;
  const nueva = () => { page = doc.addPage([A4_W, A4_H]); y = A4_H - M; };
  const asegurar = (h: number) => { if (y - h < M) nueva(); };

  const wrap = (text: string, f: PDFFont, size: number, max = WIDTH): string[] => {
    const out: string[] = [];
    for (const raw of text.split("\n")) {
      const words = raw.split(/\s+/).filter(Boolean);
      let line = "";
      for (const w of words) {
        const test = line ? line + " " + w : w;
        if (f.widthOfTextAtSize(test, size) > max && line) { out.push(line); line = w; }
        else line = test;
      }
      out.push(line);
    }
    return out;
  };
  const linea = (text: string, f: PDFFont, size: number, color = ink, x = M, gap = 3, max = WIDTH) => {
    for (const ln of wrap(text, f, size, max)) {
      asegurar(size + gap);
      page.drawText(ln, { x, y: y - size, size, font: f, color });
      y -= size + gap;
    }
  };
  const bullet = (text: string, size = 9.5) => {
    const lines = wrap(text, font, size, WIDTH - 14);
    lines.forEach((ln, i) => {
      asegurar(size + 3);
      if (i === 0) page.drawText("•", { x: M, y: y - size, size, font, color: accent });
      page.drawText(ln, { x: M + 14, y: y - size, size, font, color: ink });
      y -= size + 3;
    });
  };
  const seccion = (titulo: string) => {
    y -= 10; asegurar(20);
    page.drawText(titulo.toUpperCase(), { x: M, y: y - 10.5, size: 10.5, font: bold, color: accent });
    y -= 14;
    page.drawLine({ start: { x: M, y }, end: { x: M + WIDTH, y }, thickness: 0.6, color: rule });
    y -= 9;
  };

  // Encabezado
  linea(cv.nombre, bold, 19, ink, M, 3);
  if (cv.titular) linea(cv.titular, font, 11, gray, M, 3);
  const c = cv.contacto;
  const contacto = [c.email, c.telefono, c.ubicacion, c.enlace].filter(Boolean).join("   ·   ");
  if (contacto) { y -= 2; linea(contacto, font, 9, gray, M, 3); }

  if (cv.resumen) { seccion("Perfil"); linea(cv.resumen, font, 10, ink, M, 3); }

  if (cv.experiencia.length) {
    seccion("Experiencia");
    cv.experiencia.forEach((e, idx) => {
      if (idx > 0) y -= 5;
      asegurar(28);
      const encabezado = [e.puesto, e.empresa].filter(Boolean).join(" — ");
      linea(encabezado, bold, 10.5, ink, M, 2);
      if (e.periodo) linea(e.periodo, font, 9, gray, M, 3);
      e.logros.forEach((l) => bullet(l));
    });
  }

  if (cv.educacion.length) {
    seccion("Educación");
    cv.educacion.forEach((e) => {
      asegurar(16);
      linea([e.titulo, e.institucion].filter(Boolean).join(" — "), bold, 10, ink, M, 2);
      if (e.periodo) linea(e.periodo, font, 9, gray, M, 3);
    });
  }

  if (cv.habilidades.length) { seccion("Habilidades"); linea(cv.habilidades.join("  ·  "), font, 10, ink, M, 3); }
  if (cv.idiomas && cv.idiomas.length) { seccion("Idiomas"); linea(cv.idiomas.join("  ·  "), font, 10, ink, M, 3); }
  (cv.extras ?? []).forEach((b) => { seccion(b.titulo); b.items.forEach((it) => bullet(it)); });

  return doc.save();
}

// PDF simple de texto (por ejemplo, una carta de presentación).
export async function generarPdfTexto(titulo: string, cuerpo: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(titulo); doc.setCreator("PaludIA");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.12, 0.16);
  let page: PDFPage = doc.addPage([A4_W, A4_H]);
  let y = A4_H - M;
  const nueva = () => { page = doc.addPage([A4_W, A4_H]); y = A4_H - M; };
  const esc = (text: string, f: PDFFont, size: number, gap: number) => {
    for (const raw of text.split("\n")) {
      const words = raw.split(/\s+/).filter(Boolean);
      let line = "";
      const flush = () => {
        if (y - (size + gap) < M) nueva();
        page.drawText(line, { x: M, y: y - size, size, font: f, color: ink });
        y -= size + gap;
      };
      for (const w of words) {
        const test = line ? line + " " + w : w;
        if (f.widthOfTextAtSize(test, size) > WIDTH && line) { flush(); line = w; } else line = test;
      }
      flush();
    }
  };
  esc(titulo, bold, 15, 10);
  y -= 4;
  esc(cuerpo, font, 10.5, 5);
  return doc.save();
}

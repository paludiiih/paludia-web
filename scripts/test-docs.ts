import { writeFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { generarPdfCV } from "../lib/documentos/pdf";
import { generarDocxCV } from "../lib/documentos/docx";
import { sanearCV } from "../lib/documentos/tipos";

const cv = sanearCV({
  nombre: "Thiago Paludi",
  titular: "Atención al cliente · Ventas",
  contacto: { email: "ejemplo@correo.com", telefono: "+54 342 500 0000", ubicacion: "Santa Fe, Argentina" },
  resumen: "Repartidor y ex ayudante de albañil con fuerte orientación al cliente, puntualidad y manejo avanzado de tecnología. Busco un rol de atención al cliente donde aplicar mi trato cordial y mi capacidad de resolver problemas.",
  experiencia: [
    { puesto: "Repartidor", empresa: "PedidosYa", periodo: "dic. 2025 – actualidad", logros: ["Entregas puntuales con altas calificaciones de clientes.", "Resolución de incidencias de pedidos en el momento."] },
    { puesto: "Ayudante de albañil", empresa: "Obras particulares", periodo: "ene. 2024 – ago. 2025", logros: ["Trabajo en equipo bajo plazos ajustados.", "Cuidado de materiales y seguridad en obra."] }
  ],
  educacion: [{ titulo: "Secundario completo", institucion: "Escuela Constituyentes", periodo: "2025" }],
  habilidades: ["Atención al cliente", "Trabajo en equipo", "Edición de video", "Manejo avanzado de PC", "Uso de IA"],
  idiomas: ["Español (nativo)"],
  extras: [{ titulo: "Otros datos", items: ["Licencia de moto y moto propia."] }]
});

async function main() {
  const pdf = await generarPdfCV(cv);
  writeFileSync("/tmp/cv_test.pdf", pdf);
  const docx = await generarDocxCV(cv);
  writeFileSync("/tmp/cv_test.docx", docx);

  const head = Buffer.from(pdf.slice(0, 5)).toString("latin1");
  const reloaded = await PDFDocument.load(pdf);
  console.log("PDF firma:", head, "| páginas:", reloaded.getPageCount(), "| bytes:", pdf.length);
  const dHead = Buffer.from(docx.slice(0, 2)).toString("latin1");
  console.log("DOCX firma:", dHead, "(PK = zip válido) | bytes:", docx.length);
  console.log(head === "%PDF-" && dHead === "PK" ? "OK: ambos archivos son válidos" : "FALLA: firma inválida");
}
main().catch((e) => { console.error(e); process.exit(1); });

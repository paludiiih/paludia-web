import { sanearCV } from "@/lib/documentos/tipos";
import { generarPdfCV, generarPdfTexto } from "@/lib/documentos/pdf";
import { generarDocxCV, generarDocxTexto } from "@/lib/documentos/docx";
import { ApiError, errorResponse, getContext } from "@/lib/usage";

export const maxDuration = 30;

const TIPOS = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
} as const;

function nombreArchivo(base: string, ext: string) {
  const limpio = base.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9 _-]/g, "").trim().replace(/\s+/g, "_").slice(0, 60) || "documento";
  return `${limpio}.${ext}`;
}

export async function POST(req: Request) {
  try {
    await getContext(); // solo usuarios con sesión; no consume cupo (generar el archivo es gratis)
    const body = await req.json().catch(() => ({}));
    const formato = body.formato === "docx" ? "docx" : "pdf";
    const tipo = body.tipo === "carta" ? "carta" : "cv";

    let bytes: Uint8Array;
    let base: string;
    if (tipo === "carta") {
      const carta = String(body.carta ?? "").trim();
      if (!carta) throw new ApiError(400, "No hay carta para descargar.");
      const nombre = String(body.nombre ?? "").trim().slice(0, 120);
      base = "Carta de presentacion" + (nombre ? " - " + nombre : "");
      bytes = formato === "docx" ? await generarDocxTexto("Carta de presentación", carta) : await generarPdfTexto("Carta de presentación", carta);
    } else {
      const cv = sanearCV(body.cv);
      base = "CV - " + cv.nombre;
      bytes = formato === "docx" ? await generarDocxCV(cv) : await generarPdfCV(cv);
    }

    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": TIPOS[formato],
        "Content-Disposition": `attachment; filename="${nombreArchivo(base, formato)}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (e) {
    return errorResponse(e);
  }
}

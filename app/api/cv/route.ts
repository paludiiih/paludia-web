import Anthropic from "@anthropic-ai/sdk";
import { COSTOS } from "@/lib/plans";
import { sanearCV } from "@/lib/documentos/tipos";
import { ApiError, consumir, devolver, errorResponse, getContext, sumarGasto } from "@/lib/usage";

export const maxDuration = 60;

const MAX_INFO = 8000, MAX_OFERTA = 4000;

function sistema(conCarta: boolean) {
  return [
    "Sos un asistente experto en currículums (CV) y selección de personal en Argentina.",
    "Transformá la información del usuario en un CV profesional, claro y optimizado para sistemas ATS, adaptado a la oferta laboral.",
    "REGLAS ESTRICTAS: No inventes experiencia, formación, fechas, títulos, datos de contacto ni habilidades que el usuario no haya mencionado. Podés mejorar la redacción, ordenar, resumir y resaltar lo relevante, y usar palabras clave de la oferta SOLO si corresponden a algo que el usuario realmente tiene o hizo. Si falta un dato, dejá el campo vacío; nunca lo completes con algo inventado.",
    "Escribí en español neutro y profesional. Los logros de experiencia, en viñetas que empiecen con un verbo de acción.",
    "Respondé ÚNICAMENTE con un objeto JSON válido, sin texto adicional ni markdown, con esta forma:",
    `{"cv":{"nombre":"","titular":"","contacto":{"email":"","telefono":"","ubicacion":"","enlace":""},"resumen":"","experiencia":[{"puesto":"","empresa":"","periodo":"","logros":[""]}],"educacion":[{"titulo":"","institucion":"","periodo":""}],"habilidades":[""],"idiomas":[""],"extras":[{"titulo":"","items":[""]}]},"carta":${conCarta ? '""' : "null"}}`,
    conCarta
      ? "En 'carta' escribí una carta de presentación breve (130 a 200 palabras), honesta y adaptada a la oferta, sin inventar datos."
      : "Dejá 'carta' en null."
  ].join("\n");
}

export async function POST(req: Request) {
  let ctx: Awaited<ReturnType<typeof getContext>> | null = null;
  let consumido = false;
  try {
    ctx = await getContext();
    if (!process.env.ANTHROPIC_API_KEY) throw new ApiError(503, "El creador de CV todavía no está activado. Falta conectar la clave de la IA.");
    const body = await req.json().catch(() => ({}));
    const info = String(body.info ?? "").trim();
    const oferta = String(body.oferta ?? "").trim();
    const conCarta = Boolean(body.carta);
    if (info.length < 20) throw new ApiError(400, "Contanos tu experiencia o pegá tu CV actual (al menos unas líneas).");
    if (info.length > MAX_INFO) throw new ApiError(400, `Tu información es muy larga. Máximo ${MAX_INFO.toLocaleString("es-AR")} caracteres.`);
    if (oferta.length > MAX_OFERTA) throw new ApiError(400, `La oferta es muy larga. Máximo ${MAX_OFERTA.toLocaleString("es-AR")} caracteres.`);

    const datos = {
      nombre: String(body.nombre ?? "").trim().slice(0, 120),
      email: String(body.email ?? "").trim().slice(0, 120),
      telefono: String(body.telefono ?? "").trim().slice(0, 60),
      ubicacion: String(body.ubicacion ?? "").trim().slice(0, 120)
    };

    const { admin, user, plan } = ctx;
    const uso = await consumir(admin, user.id, plan, "cv");
    consumido = true;

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      ...(process.env.ANTHROPIC_WORKSPACE_ID ? { defaultHeaders: { "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID } } : {})
    });
    const contactoLineas = [
      datos.nombre && `Nombre: ${datos.nombre}`,
      datos.email && `Email: ${datos.email}`,
      datos.telefono && `Teléfono: ${datos.telefono}`,
      datos.ubicacion && `Ubicación: ${datos.ubicacion}`
    ].filter((x): x is string => Boolean(x));
    const prompt = [
      contactoLineas.join("\n"),
      "INFORMACIÓN / CV ACTUAL DEL USUARIO:\n" + info,
      oferta ? "OFERTA LABORAL A LA QUE SE POSTULA:\n" + oferta : "No se proporcionó una oferta específica; hacé un CV general y prolijo."
    ].filter((x) => x.length > 0).join("\n\n");

    let resp;
    try {
      resp = await client.messages.create({
        model: plan.modeloChat,
        max_tokens: 3600,
        system: sistema(conCarta),
        messages: [{ role: "user", content: prompt }]
      });
    } catch (err) {
      console.error("cv IA", err);
      const status = (err as { status?: number })?.status;
      throw new ApiError(status === 429 || status === 529 ? 503 : 502,
        status === 429 || status === 529
          ? "La IA está muy ocupada en este momento. Volvé a intentar en un minuto; no se descontó el cupo."
          : "La IA no pudo generar el CV. Volvé a intentar; no se descontó el cupo.");
    }

    const precio = COSTOS.chat[plan.modeloChat] ?? { entrada: 4, salida: 20 };
    await sumarGasto(admin, (resp.usage.input_tokens * precio.entrada + resp.usage.output_tokens * precio.salida) / 1e6);

    const texto = resp.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
    const limpio = texto.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    const ini = limpio.indexOf("{"), fin = limpio.lastIndexOf("}");
    let parsed: { cv?: unknown; carta?: unknown } = {};
    try { parsed = JSON.parse(limpio.slice(ini, fin + 1)); } catch { throw new ApiError(502, "La IA no devolvió un CV válido. Volvé a intentar; no se descontó el cupo.", {}); }

    const cv = sanearCV(parsed.cv);
    if (datos.nombre) cv.nombre = datos.nombre;
    if (datos.email) cv.contacto.email = datos.email;
    if (datos.telefono) cv.contacto.telefono = datos.telefono;
    if (datos.ubicacion) cv.contacto.ubicacion = datos.ubicacion;
    const carta = conCarta && typeof parsed.carta === "string" ? parsed.carta.trim().slice(0, 4000) : null;

    return Response.json({ cv, carta, used: uso.used, limit: uso.limit, resetsAt: uso.resetsAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (consumido && ctx) await devolver(ctx.admin, ctx.user.id, "cv");
    return errorResponse(e);
  }
}

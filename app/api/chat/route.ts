import Anthropic from "@anthropic-ai/sdk";
import { COSTOS } from "@/lib/plans";
import { ApiError, consumir, conversacion, devolver, errorResponse, getContext, sumarGasto } from "@/lib/usage";

export const maxDuration = 60;

const MAX_HISTORIAL = 30; // mensajes anteriores que se envían como contexto
const MAX_CARACTERES = 8000; // largo máximo de cada mensaje del usuario
const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGEN_BYTES = 4_500_000; // ~4,5 MB por foto (límite de la API)

// Acepta una foto como "data:image/...;base64,...." y la valida.
function leerImagen(v: unknown): { media_type: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string } | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const m = /^data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=]+)$/.exec(v.trim());
  if (!m) throw new ApiError(400, "La foto no tiene un formato válido.");
  const media_type = m[1].toLowerCase();
  const data = m[2];
  if (!TIPOS_IMAGEN.includes(media_type)) throw new ApiError(400, "Formato de foto no permitido. Usá JPG, PNG o WebP.");
  if (data.length * 0.75 > MAX_IMAGEN_BYTES) throw new ApiError(400, "La foto es muy pesada. Probá con una más chica.");
  return { media_type: media_type as "image/jpeg", data };
}

function reglas(busquedaWeb: boolean, instrucciones: string) {
  const ahora = new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "full", timeStyle: "short" });
  return [
    "Sos PaludIA, un asistente de inteligencia artificial. Respondé en español rioplatense (voseo), con claridad, calidez y precisión, salvo que el usuario escriba en otro idioma.",
    `Fecha y hora actual en Argentina: ${ahora}.`,
    "Usá Markdown cuando ayude (títulos cortos, listas, tablas, bloques de código). A preguntas simples, respuestas breves; a temas complejos, respuestas completas y ordenadas.",
    "Tu especialidad es el ecommerce y el marketing digital. Ayudás a emprendedores a: encontrar productos ganadores, elegir nichos, analizar la competencia, calcular precios y márgenes, armar una tienda (Shopify, Tiendanube, WooCommerce), escribir descripciones y fichas de producto, crear anuncios para Meta e Instagram, guiones para videos UGC, estrategias de envío y proveedores (dropshipping, importación, mayoristas), y atención al cliente. Pensá siempre en el mercado al que vende la persona (por defecto Argentina, en pesos) y en que el negocio sea rentable y legal.",
    "Cuando te pidan «productos ganadores» o ideas de producto, dá criterios concretos (margen, demanda, problema que resuelve, facilidad de envío, estacionalidad) y ejemplos de categorías; aclará que la validación final se hace mirando datos reales de ventas y anuncios.",
    "Respondé con amplitud sobre negocios, tecnología, programación, redacción y creatividad. Ante temas polémicos o sensibles legítimos, informá con equilibrio en vez de negarte. No ayudás con actividades ilegales ni con productos prohibidos, falsificados o peligrosos.",
    "No inventes datos, cifras, proveedores ni enlaces. Un enlace solo lo das si la búsqueda web lo devolvió. Si no estás seguro, decilo.",
    busquedaWeb
      ? "Tenés búsqueda web: usala para buscar productos en tiendas y marketplaces, precios actuales, proveedores, tendencias y datos de la competencia, y citá siempre las fuentes con sus enlaces reales."
      : "No tenés acceso a internet en este plan, así que no podés mirar tiendas ni precios en vivo: respondé con tu conocimiento y criterios, aclaralo, y sugerí pasar al plan Pro para que pueda buscar en tiendas e internet.",
    "El usuario puede subir fotos con el clip al lado del cuadro de texto, y vos las ves y las analizás. Si suben la foto de un producto, identificá qué es y ofrecé ayuda concreta de ecommerce (ficha, anuncios, precio, nicho). Si suben un anuncio, una captura o una etiqueta, leé lo que diga y dá tu análisis. No generás ni editás imágenes; si lo piden, aclaralo con amabilidad.",
    instrucciones.trim() ? `Preferencias del usuario (respetalas):\n${instrucciones.trim().slice(0, 4000)}` : ""
  ].filter(Boolean).join("\n");
}

export async function POST(req: Request) {
  let ctx: Awaited<ReturnType<typeof getContext>> | null = null;
  let consumido = false;
  try {
    ctx = await getContext();
    if (!process.env.ANTHROPIC_API_KEY) throw new ApiError(503, "El chat con IA todavía no está activado. Falta conectar la clave de la IA.");
    const body = await req.json().catch(() => ({}));
    const texto = String(body.message ?? "").trim();
    const imagen = leerImagen(body.image);
    if (!texto && !imagen) throw new ApiError(400, "Escribí un mensaje o subí una foto.");
    if (texto.length > MAX_CARACTERES) throw new ApiError(400, `El mensaje es muy largo. Máximo ${MAX_CARACTERES.toLocaleString("es-AR")} caracteres.`);

    const { supabase, admin, user, plan } = ctx;
    const uso = await consumir(admin, user.id, plan, "mensaje");
    consumido = true;
    const titulo = texto || "Foto";
    const contenidoUsuario = texto || "📷 Foto";
    const convId = await conversacion(supabase, user.id, body.conversationId || undefined, titulo);

    const [{ data: previos }, { data: settings }] = await Promise.all([
      supabase.from("messages").select("role, content").eq("conversation_id", convId).order("created_at", { ascending: false }).limit(MAX_HISTORIAL),
      supabase.from("user_settings").select("instructions").eq("user_id", user.id).maybeSingle()
    ]);
    await supabase.from("messages").insert({ conversation_id: convId, user_id: user.id, role: "user", content: contenidoUsuario, meta: imagen ? { kind: "foto" } : undefined });

    const historial: { role: "user" | "assistant"; content: string }[] = (previos ?? [])
      .reverse()
      .filter((m) => m.content && m.content.trim())
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    while (historial.length && historial[0].role !== "user") historial.shift();
    const mensajes: Anthropic.MessageParam[] = [];
    for (const m of historial) {
      const prev = mensajes.at(-1);
      if (prev && prev.role === m.role && typeof prev.content === "string") prev.content = `${prev.content}\n\n${m.content}`;
      else mensajes.push({ role: m.role, content: m.content });
    }
    // Mensaje nuevo del usuario: con la foto como bloque de imagen si la hay.
    const bloques: Anthropic.ContentBlockParam[] = [];
    if (imagen) bloques.push({ type: "image", source: { type: "base64", media_type: imagen.media_type, data: imagen.data } });
    bloques.push({ type: "text", text: texto || "Mirá esta foto y ayudame." });
    const ultimo = mensajes.at(-1);
    if (ultimo && ultimo.role === "user") {
      const prevBloques = typeof ultimo.content === "string" ? [{ type: "text", text: ultimo.content } as Anthropic.ContentBlockParam] : ultimo.content;
      ultimo.content = [...prevBloques, ...bloques];
    } else {
      mensajes.push({ role: "user", content: bloques });
    }

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      // Si la clave es de la organización (no de un espacio de trabajo), indicamos cuál usar.
      ...(process.env.ANTHROPIC_WORKSPACE_ID ? { defaultHeaders: { "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID } } : {})
    });
    const tools: Anthropic.ToolUnion[] = plan.busquedaWeb ? [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }] : [];
    const stream = client.messages.stream({
      model: plan.modeloChat,
      max_tokens: plan.maxRespuesta,
      system: reglas(plan.busquedaWeb, settings?.instructions ?? ""),
      messages: mensajes,
      ...(tools.length ? { tools } : {})
    });

    const enc = new TextEncoder();
    const send = (c: ReadableStreamDefaultController, obj: unknown) => c.enqueue(enc.encode(JSON.stringify(obj) + "\n"));

    const body$ = new ReadableStream({
      async start(c) {
        send(c, { t: "meta", conversationId: convId, used: uso.used, limit: uso.limit, resetsAt: uso.resetsAt, plan: plan.id });
        let texto = "";
        try {
          stream.on("text", (d) => { texto += d; send(c, { t: "text", d }); });
          stream.on("streamEvent", (ev) => {
            if (ev.type === "content_block_start" && ev.content_block.type === "server_tool_use") send(c, { t: "search" });
          });
          const final = await stream.finalMessage();
          const fuentes: { url: string; title: string }[] = [];
          for (const b of final.content) {
            if (b.type === "text") for (const ci of b.citations ?? []) {
              if (ci.type === "web_search_result_location" && !fuentes.some((f) => f.url === ci.url)) fuentes.push({ url: ci.url, title: ci.title ?? ci.url });
            }
          }
          if (fuentes.length) send(c, { t: "sources", sources: fuentes });
          const precio = COSTOS.chat[plan.modeloChat] ?? { entrada: 4, salida: 20 };
          const busquedas = final.usage.server_tool_use?.web_search_requests ?? 0;
          const costo = (final.usage.input_tokens * precio.entrada + final.usage.output_tokens * precio.salida) / 1e6 + busquedas * COSTOS.busquedaWeb;
          await sumarGasto(admin, costo);
          await supabase.from("messages").insert({
            conversation_id: convId, user_id: user.id, role: "assistant", content: texto || "…",
            meta: { model: plan.modeloChat, sources: fuentes, truncated: final.stop_reason === "max_tokens" }
          });
          send(c, { t: "done", truncated: final.stop_reason === "max_tokens" });
        } catch (err) {
          console.error("chat", err);
          if (!texto) await devolver(admin, user.id, "mensaje");
          else await supabase.from("messages").insert({ conversation_id: convId, user_id: user.id, role: "assistant", content: texto, meta: { model: plan.modeloChat, interrupted: true } });
          const status = (err as { status?: number })?.status;
          send(c, { t: "error", error: status === 429 || status === 529 ? "La IA está muy ocupada en este momento. Volvé a intentar en un minuto." : "La IA no pudo responder. Volvé a intentar; no se descontó el mensaje." });
        } finally {
          c.close();
        }
      },
      cancel() { stream.abort(); }
    });

    return new Response(body$, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (e) {
    if (consumido && ctx) await devolver(ctx.admin, ctx.user.id, "mensaje");
    return errorResponse(e);
  }
}

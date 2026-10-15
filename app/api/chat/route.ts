import Anthropic from "@anthropic-ai/sdk";
import { COSTOS } from "@/lib/plans";
import { ApiError, consumir, conversacion, devolver, errorResponse, getContext, sumarGasto } from "@/lib/usage";

export const maxDuration = 60;

const MAX_HISTORIAL = 30; // mensajes anteriores que se envían como contexto
const MAX_CARACTERES = 8000; // largo máximo de cada mensaje del usuario

function reglas(busquedaWeb: boolean, instrucciones: string) {
  const ahora = new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "full", timeStyle: "short" });
  return [
    "Sos PaludIA, un asistente de inteligencia artificial. Respondé en español rioplatense (voseo), con claridad, calidez y precisión, salvo que el usuario escriba en otro idioma.",
    `Fecha y hora actual en Argentina: ${ahora}.`,
    "Usá Markdown cuando ayude (títulos cortos, listas, tablas, bloques de código). A preguntas simples, respuestas breves; a temas complejos, respuestas completas y ordenadas.",
    "Respondé con amplitud sobre ciencia, tecnología, programación, negocios, historia, cultura y creatividad. Ante temas polémicos o sensibles legítimos, informá con equilibrio en vez de negarte.",
    "No inventes datos, cifras ni enlaces. Si no estás seguro, decilo.",
    busquedaWeb
      ? "Tenés búsqueda web: usala para noticias, precios, datos actuales o cuando no estés seguro, y citá las fuentes."
      : "No tenés acceso a internet en este plan: si te piden datos actuales, aclaralo y respondé con lo que sabés, avisando que puede estar desactualizado.",
    "Si te piden generar una imagen, explicá que se hace con el botón «Imagen» al lado del cuadro de texto.",
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
    if (!texto) throw new ApiError(400, "Escribí un mensaje.");
    if (texto.length > MAX_CARACTERES) throw new ApiError(400, `El mensaje es muy largo. Máximo ${MAX_CARACTERES.toLocaleString("es-AR")} caracteres.`);

    const { supabase, admin, user, plan } = ctx;
    const uso = await consumir(admin, user.id, plan, "mensaje");
    consumido = true;
    const convId = await conversacion(supabase, user.id, body.conversationId || undefined, texto);

    const [{ data: previos }, { data: settings }] = await Promise.all([
      supabase.from("messages").select("role, content").eq("conversation_id", convId).order("created_at", { ascending: false }).limit(MAX_HISTORIAL),
      supabase.from("user_settings").select("instructions").eq("user_id", user.id).maybeSingle()
    ]);
    await supabase.from("messages").insert({ conversation_id: convId, user_id: user.id, role: "user", content: texto });

    const historial: Anthropic.MessageParam[] = (previos ?? [])
      .reverse()
      .filter((m) => m.content && m.content.trim())
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    while (historial.length && historial[0].role !== "user") historial.shift();
    const mensajes: Anthropic.MessageParam[] = [];
    for (const m of [...historial, { role: "user" as const, content: texto }]) {
      const prev = mensajes.at(-1);
      if (prev && prev.role === m.role) prev.content = `${prev.content}\n\n${m.content}`;
      else mensajes.push({ ...m });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
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

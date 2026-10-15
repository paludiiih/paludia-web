import { COSTOS } from "@/lib/plans";
import { ApiError, consumir, conversacion, devolver, errorResponse, getContext, sumarGasto } from "@/lib/usage";

export const maxDuration = 60;

const MAX_PROMPT = 1500;

export async function POST(req: Request) {
  let ctx: Awaited<ReturnType<typeof getContext>> | null = null;
  let consumido = false;
  try {
    ctx = await getContext();
    if (!process.env.FAL_KEY) throw new ApiError(503, "La generación de imágenes todavía no está activada. Falta conectar la clave del servicio de imágenes.");
    const body = await req.json().catch(() => ({}));
    const prompt = String(body.prompt ?? "").trim();
    if (!prompt) throw new ApiError(400, "Describí la imagen que querés crear.");
    if (prompt.length > MAX_PROMPT) throw new ApiError(400, `La descripción es muy larga. Máximo ${MAX_PROMPT} caracteres.`);

    const { supabase, admin, user, plan } = ctx;
    const uso = await consumir(admin, user.id, plan, "imagen");
    consumido = true;
    const convId = await conversacion(supabase, user.id, body.conversationId || undefined, "🖼 " + prompt);
    await supabase.from("messages").insert({ conversation_id: convId, user_id: user.id, role: "user", content: prompt, meta: { kind: "imagen" } });

    const base = process.env.FAL_BASE_URL || "https://fal.run";
    const res = await fetch(`${base}/${plan.modeloImagen}`, {
      method: "POST",
      headers: { Authorization: `Key ${process.env.FAL_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, image_size: "square_hd", num_images: 1, enable_safety_checker: true, output_format: "jpeg" }),
      signal: AbortSignal.timeout(55_000)
    }).catch(() => null);

    const data = res && res.ok ? await res.json().catch(() => null) : null;
    const img = data?.images?.[0];
    const nsfw = Array.isArray(data?.has_nsfw_concepts) && data.has_nsfw_concepts[0];
    if (!img?.url || nsfw) {
      await devolver(admin, user.id, "imagen");
      consumido = false;
      const msg = nsfw
        ? "Esa imagen no se puede generar porque no cumple las normas de contenido. No se descontó del cupo."
        : "No se pudo generar la imagen. Volvé a intentar; no se descontó del cupo.";
      await supabase.from("messages").insert({ conversation_id: convId, user_id: user.id, role: "assistant", content: msg, meta: { kind: "imagen", error: true } });
      return Response.json({ error: msg, conversationId: convId }, { status: nsfw ? 400 : 502 });
    }

    const mp = ((img.width ?? 1024) * (img.height ?? 1024)) / 1e6;
    await sumarGasto(admin, (COSTOS.imagen[plan.modeloImagen] ?? 0.03) * Math.max(1, mp));
    const contenido = `Imagen generada: ${prompt}`;
    await supabase.from("messages").insert({
      conversation_id: convId, user_id: user.id, role: "assistant", content: contenido,
      meta: { kind: "imagen", url: img.url, width: img.width, height: img.height, model: plan.modeloImagen }
    });
    return Response.json({ conversationId: convId, url: img.url, used: uso.used, limit: uso.limit, resetsAt: uso.resetsAt });
  } catch (e) {
    if (consumido && ctx) await devolver(ctx.admin, ctx.user.id, "imagen");
    return errorResponse(e);
  }
}

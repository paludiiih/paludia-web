import "server-only";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { planDe, TOPE_DIARIO_USD, type Plan } from "@/lib/plans";

export type Kind = "mensaje" | "imagen" | "cv";

// Cada cupo tiene su propia ventana. Chat/imágenes se renuevan cada 24 h; el CV, cada 30 días.
export const VENTANA_HORAS: Record<Kind, number> = { mensaje: 24, imagen: 24, cv: 720 };

export class ApiError extends Error {
  constructor(public status: number, message: string, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}

// Usuario con sesión + su plan leído SIEMPRE de la base de datos (nunca del navegador).
export async function getContext() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new ApiError(401, "Tu sesión venció. Volvé a ingresar.");
  const admin = createServiceClient();
  if (!admin) throw new ApiError(503, "El servidor todavía no está configurado.");
  const { data: sub } = await admin.from("subscriptions").select("plan, status").eq("user_id", data.user.id).maybeSingle();
  const activo = !sub || sub.status === "active";
  const plan: Plan = planDe(activo ? sub?.plan : "gratis");
  return { supabase, admin, user: data.user, plan };
}

type Admin = NonNullable<ReturnType<typeof createServiceClient>>;

export function limiteDe(plan: Plan, kind: Kind) {
  if (kind === "mensaje") return plan.mensajesPorDia;
  if (kind === "cv") return plan.cvPorMes;
  return plan.imagenesPorDia;
}

// Reserva un uso. Si no queda cupo, corta con un error que dice cuándo se renueva.
export async function consumir(admin: Admin, userId: string, plan: Plan, kind: Kind) {
  const { data: spend } = await admin.from("app_spend").select("usd").eq("day", new Date().toISOString().slice(0, 10)).maybeSingle();
  if (spend && Number(spend.usd) >= TOPE_DIARIO_USD) {
    throw new ApiError(503, "PaludIA alcanzó su límite de uso de hoy. Volvé a intentar mañana.");
  }
  const limit = limiteDe(plan, kind);
  const { data, error } = await admin.rpc("consume_quota", { p_user: userId, p_kind: kind, p_limit: limit, p_hours: VENTANA_HORAS[kind] });
  if (error) throw new ApiError(500, "No se pudo verificar tu límite de uso. Volvé a intentar.");
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.allowed) {
    const cosa = kind === "mensaje" ? `tus ${limit} mensajes` : kind === "cv" ? `tus ${limit} CV` : `tus ${limit} imágenes`;
    const periodo = kind === "cv" ? "de este mes" : "de las últimas 24 horas";
    throw new ApiError(429, `Usaste ${cosa} ${periodo}.`, { resetsAt: row?.resets_at, limit, kind, plan: plan.id });
  }
  return { used: row.used as number, limit, resetsAt: row.resets_at as string };
}

export async function devolver(admin: Admin, userId: string, kind: Kind) {
  await admin.rpc("refund_quota", { p_user: userId, p_kind: kind });
}

export async function sumarGasto(admin: Admin, usd: number) {
  if (usd > 0) await admin.rpc("add_spend", { p_usd: Number(usd.toFixed(6)) });
}

// Lee los contadores actuales (sin consumir).
export async function estadoDeUso(admin: Admin, userId: string, plan: Plan) {
  const { data } = await admin.from("usage_windows").select("kind, window_start, used").eq("user_id", userId);
  const now = Date.now();
  const out: Record<Kind, { used: number; limit: number; resetsAt: string | null }> = {
    mensaje: { used: 0, limit: plan.mensajesPorDia, resetsAt: null },
    imagen: { used: 0, limit: plan.imagenesPorDia, resetsAt: null },
    cv: { used: 0, limit: plan.cvPorMes, resetsAt: null }
  };
  for (const r of data ?? []) {
    const k = r.kind as Kind;
    if (!(k in out)) continue;
    const reset = new Date(r.window_start).getTime() + (VENTANA_HORAS[k] ?? 24) * 3600e3;
    if (now < reset) out[k] = { used: r.used, limit: out[k].limit, resetsAt: new Date(reset).toISOString() };
  }
  return out;
}

export function errorResponse(e: unknown) {
  if (e instanceof ApiError) return Response.json({ error: e.message, ...e.extra }, { status: e.status });
  console.error(e);
  return Response.json({ error: "Algo salió mal. Volvé a intentar." }, { status: 500 });
}

// Conversación del usuario: la verifica o crea una nueva.
export async function conversacion(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, id: string | undefined, titulo: string) {
  if (id) {
    const { data } = await supabase.from("conversations").select("id").eq("id", id).eq("user_id", userId).maybeSingle();
    if (!data) throw new ApiError(404, "No encontramos esa conversación.");
    await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", id);
    return id;
  }
  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_id: userId, title: titulo.replace(/\s+/g, " ").trim().slice(0, 80) || "Conversación" })
    .select("id")
    .single();
  if (error || !data) throw new ApiError(500, "No se pudo crear la conversación.");
  return data.id as string;
}

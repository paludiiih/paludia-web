import { errorResponse, estadoDeUso, getContext } from "@/lib/usage";

export async function GET() {
  try {
    const { admin, user, plan } = await getContext();
    const uso = await estadoDeUso(admin, user.id, plan);
    return Response.json({
      plan: { id: plan.id, nombre: plan.nombre, busquedaWeb: plan.busquedaWeb },
      uso,
      chatActivo: Boolean(process.env.ANTHROPIC_API_KEY),
      imagenesActivas: Boolean(process.env.FAL_KEY)
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}

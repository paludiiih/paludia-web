import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// Borra la cuenta del usuario que tiene la sesión iniciada. La clave de servicio nunca sale del servidor.
export async function DELETE() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Tu sesión venció. Volvé a ingresar." }, { status: 401 });

  const admin = createServiceClient();
  if (!admin) return NextResponse.json({ error: "El borrado de cuentas todavía no está configurado en el servidor." }, { status: 503 });

  // Al borrar el usuario, la base de datos borra en cascada perfil, configuración, plan y conversaciones.
  const { error } = await admin.auth.admin.deleteUser(data.user.id);
  if (error) return NextResponse.json({ error: "No se pudo borrar la cuenta. Volvé a intentar." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

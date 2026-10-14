import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Cerrar sesión (solo por POST, para que un enlace ajeno no pueda cerrarla).
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/ingresar?aviso=salida", request.nextUrl.origin), { status: 303 });
}

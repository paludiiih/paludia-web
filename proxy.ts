import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from "./lib/supabase/env";

// Páginas que exigen haber iniciado sesión
const PRIVATE = ["/perfil", "/configuracion", "/chat", "/herramientas/cv"];
// Páginas que no tienen sentido con la sesión iniciada
const GUEST_ONLY = ["/ingresar", "/registro"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!supabaseConfigured) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  // Verifica la sesión con Supabase (no confía en la cookie sola) y la renueva si hace falta.
  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  if (!data.user && PRIVATE.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/ingresar";
    url.search = "";
    url.searchParams.set("volver", path);
    return NextResponse.redirect(url);
  }
  if (data.user && GUEST_ONLY.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/chat";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"]
};

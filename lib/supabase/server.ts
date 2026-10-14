import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

// Cliente del servidor con la sesión del usuario (lee y renueva las cookies de sesión).
export async function createClient() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // En componentes de servidor no se pueden escribir cookies; el proxy las renueva.
        }
      }
    }
  });
}

// Cliente con la clave de servicio: SOLO en el servidor y solo para tareas administrativas
// (borrar cuentas, cambiar planes desde los cobros). Nunca se envía al navegador.
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) return null;
  return createAdmin(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/env";
import { PLANES } from "@/lib/plans";

export default async function Home() {
  if (supabaseConfigured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) redirect("/chat");
  }
  const g = PLANES.gratis;
  return (
    <main className="page stack">
      <h1>Tu asistente de IA, <span style={{ color: "var(--accent)" }}>en español</span></h1>
      <p className="lead">Chateá con inteligencia artificial y creá imágenes desde una descripción. Tu historial queda guardado en tu cuenta.</p>
      <p className="lead">Gratis: {g.mensajesPorDia} mensajes y {g.imagenesPorDia} imágenes cada 24 horas.</p>
      <div className="row">
        <Link className="btn primary auto" href="/registro">Crear cuenta gratis</Link>
        <Link className="btn auto" href="/ingresar">Ya tengo cuenta</Link>
      </div>
    </main>
  );
}

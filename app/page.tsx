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
    <main className="page stack" style={{ paddingTop: 56 }}>
      <span className="hero-eyebrow">Tu socia de ecommerce, con IA</span>
      <h1>Convertí cualquier producto en una <span className="accent-word">venta</span></h1>
      <p className="lead">PaludIA te ayuda a encontrar productos ganadores, armar tu tienda y escribir anuncios para Meta. Subí la foto de un producto o un anuncio y la lee para ayudarte, con tu historial siempre guardado.</p>
      <div className="row">
        <Link className="btn primary auto" href="/registro">Crear cuenta gratis</Link>
        <Link className="btn auto" href="/ingresar">Ya tengo cuenta</Link>
      </div>
      <p className="small">Gratis: {g.mensajesPorDia} mensajes cada 24 horas, con lectura de fotos. Sin tarjeta.</p>
    </main>
  );
}

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/env";

const PLAN_NAME: Record<string, string> = { gratis: "Gratis", pro: "Pro", premium: "Premium" };

export default async function Home() {
  if (!supabaseConfigured) return <Welcome />;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return <Welcome />;

  const [{ data: profile }, { data: sub }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", data.user.id).maybeSingle(),
    supabase.from("subscriptions").select("plan").eq("user_id", data.user.id).maybeSingle()
  ]);
  const name = profile?.display_name || data.user.email?.split("@")[0] || "";

  return (
    <main className="page stack">
      <div className="row"><span className="badge">Plan {PLAN_NAME[sub?.plan ?? "gratis"]}</span></div>
      <h1>Hola{name ? `, ${name}` : ""}</h1>
      <p className="lead">Tu cuenta de PaludIA está activa. Tus conversaciones y tu configuración quedan guardadas acá y solo vos podés verlas.</p>
      <div className="section">
        <h2>Tu cuenta</h2>
        <div className="row">
          <Link className="btn auto" href="/perfil">Ver perfil</Link>
          <Link className="btn auto" href="/configuracion">Configuración</Link>
        </div>
      </div>
      <div className="msg info">El chat con búsqueda web, clima y documentos se suma a esta versión en la próxima etapa.</div>
    </main>
  );
}

function Welcome() {
  return (
    <main className="page stack">
      <h1>Tu asistente de IA, <span style={{ color: "var(--accent)" }}>en español</span></h1>
      <p className="lead">PaludIA busca en internet, hace cuentas exactas, lee tus documentos y guarda tu historial en tu propia cuenta.</p>
      <div className="row">
        <Link className="btn primary auto" href="/registro">Crear cuenta gratis</Link>
        <Link className="btn auto" href="/ingresar">Ya tengo cuenta</Link>
      </div>
    </main>
  );
}

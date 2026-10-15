import type { Metadata } from "next";
import Link from "next/link";
import { PLANES } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Planes" };

export default async function Page() {
  let actual: string | null = null;
  if (supabaseConfigured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const { data: sub } = await supabase.from("subscriptions").select("plan").eq("user_id", data.user.id).maybeSingle();
      actual = sub?.plan ?? "gratis";
    }
  }
  return (
    <main className="page stack" style={{ maxWidth: 1040 }}>
      <h1>Planes</h1>
      <p className="lead">Todos los planes renuevan su cupo de mensajes 24 horas después de que empezás a usarlo, y en todos podés subir fotos para que la IA las lea.</p>
      <div className="plans">
        {Object.values(PLANES).map((p) => (
          <section key={p.id} className={`plan${actual === p.id ? " current" : ""}`}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2>{p.nombre}</h2>
              {actual === p.id && <span className="badge">Tu plan</span>}
            </div>
            <div className="price">{p.precio}{p.id !== "gratis" && p.precio !== "A definir" ? <span className="small"> / mes</span> : null}</div>
            <ul>{p.descripcion.map((d) => <li key={d}>{d}</li>)}</ul>
            {p.id === "gratis" ? (
              <Link className="btn" href={actual ? "/chat" : "/registro"}>{actual ? "Ir al chat" : "Empezar gratis"}</Link>
            ) : (
              <button className="btn" type="button" disabled>{p.disponible ? "Elegir plan" : "Próximamente"}</button>
            )}
          </section>
        ))}
      </div>
      <p className="small">Los planes pagos todavía no están a la venta. Vamos a avisar cuando se puedan contratar.</p>
    </main>
  );
}

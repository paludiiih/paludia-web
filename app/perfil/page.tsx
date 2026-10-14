import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./ProfileForm";
import { DeleteAccount } from "./DeleteAccount";

export const metadata: Metadata = { title: "Perfil" };

const PROVIDER_NAME: Record<string, string> = { email: "Correo y contraseña", google: "Google" };
const PLAN_NAME: Record<string, string> = { gratis: "Gratis", pro: "Pro", premium: "Premium" };

export default async function Page() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/ingresar?volver=/perfil");
  const user = data.user;
  const [{ data: profile }, { data: sub }] = await Promise.all([
    supabase.from("profiles").select("display_name, avatar_url, created_at").eq("id", user.id).maybeSingle(),
    supabase.from("subscriptions").select("plan, status, current_period_end").eq("user_id", user.id).maybeSingle()
  ]);
  const providers = (user.identities ?? []).map((i) => PROVIDER_NAME[i.provider] ?? i.provider);
  const since = new Date(profile?.created_at ?? user.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <main className="page stack">
      <h1>Perfil</h1>
      <ProfileForm initialName={profile?.display_name ?? ""} avatarUrl={profile?.avatar_url ?? ""} email={user.email ?? ""} />
      <section className="section">
        <h2>Cuenta</h2>
        <p className="small">Ingresás con: <b style={{ color: "var(--ink)" }}>{providers.join(", ") || "Correo y contraseña"}</b></p>
        <p className="small">Miembro desde el {since}.</p>
        <p className="small">Plan actual: <b style={{ color: "var(--ink)" }}>{PLAN_NAME[sub?.plan ?? "gratis"]}</b>. Los planes pagos llegan en la próxima etapa.</p>
      </section>
      <DeleteAccount />
    </main>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = { title: "Configuración" };

export default async function Page() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/ingresar?volver=/configuracion");
  const { data: s } = await supabase.from("user_settings").select("instructions, default_mode, web_enabled").eq("user_id", data.user.id).maybeSingle();
  return (
    <main className="page stack">
      <h1>Configuración</h1>
      <p className="lead">Estas preferencias se aplican a todas tus conversaciones, en cualquier dispositivo donde ingreses.</p>
      <SettingsForm
        initial={{
          instructions: s?.instructions ?? "",
          default_mode: (s?.default_mode as "rapido" | "normal" | "profundo") ?? "normal",
          web_enabled: s?.web_enabled ?? true
        }}
      />
    </main>
  );
}

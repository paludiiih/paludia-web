import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/env";
import { ResetForm } from "./ResetForm";

export const metadata: Metadata = { title: "Nueva contraseña" };

// Solo se llega acá desde el enlace del correo, que ya inició una sesión temporal.
export default async function Page() {
  if (!supabaseConfigured) redirect("/");
  const { data } = await (await createClient()).auth.getUser();
  if (!data.user) redirect("/recuperar");
  return <ResetForm />;
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/env";
import { ChatApp } from "./ChatApp";

export const metadata: Metadata = { title: "Chat" };

export default async function Page() {
  if (!supabaseConfigured) redirect("/");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/ingresar?volver=/chat");
  return <ChatApp userId={data.user.id} />;
}

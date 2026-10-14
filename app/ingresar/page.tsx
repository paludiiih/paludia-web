import type { Metadata } from "next";
import { safeNext } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Ingresar" };

const NOTICES: Record<string, string> = {
  confirmado: "Tu correo quedó confirmado. Ya podés ingresar.",
  contrasena: "Tu contraseña se actualizó. Ingresá con la nueva.",
  salida: "Cerraste sesión.",
  borrada: "Tu cuenta y todos tus datos se borraron.",
  error: "No pudimos completar el inicio de sesión. Volvé a intentar."
};

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return <LoginForm next={safeNext(sp.volver)} notice={sp.aviso ? NOTICES[sp.aviso] : undefined} />;
}

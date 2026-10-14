"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AUTH, authErrorMessage, safeNext } from "@/lib/auth";
import { OAuthButtons } from "@/components/OAuthButtons";

export function RegisterForm({ next }: { next: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");

  const tooShort = password.length > 0 && password.length < AUTH.minPassword;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < AUTH.minPassword) { setError(`La contraseña tiene que tener al menos ${AUTH.minPassword} caracteres.`); return; }
    if (!accept) { setError("Para crear la cuenta tenés que aceptar los términos y la política de privacidad."); return; }
    setBusy(true);
    const { data, error } = await createClient().auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: name.trim().slice(0, 80) },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}`
      }
    });
    setBusy(false);
    if (error) { setError(authErrorMessage(error)); return; }
    if (data.session) { router.replace(safeNext(next)); router.refresh(); return; }
    setSentTo(email.trim());
  }

  if (sentTo) {
    return (
      <main className="center">
        <div className="card">
          <h1>Revisá tu correo</h1>
          <p className="lead">Te enviamos un enlace a <b>{sentTo}</b> para confirmar la cuenta. Abrilo desde este mismo navegador.</p>
          <p className="small">Si no llega en unos minutos, mirá en spam o promociones.</p>
          <Link className="btn" href="/ingresar">Ir a ingresar</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="center">
      <div className="card">
        <h1>Crear cuenta</h1>
        <p className="lead">Tu historial y tu configuración quedan guardados en tu cuenta, y solo vos los ves.</p>
        <OAuthButtons next={next} />
        <form className="stack" onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="name">Nombre</label>
            <input id="name" className="input" autoComplete="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="email">Correo electrónico</label>
            <input id="email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input id="password" className="input" type="password" autoComplete="new-password" required minLength={AUTH.minPassword} value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby="pwhelp" />
            <small id="pwhelp" style={tooShort ? { color: "var(--danger)" } : undefined}>Al menos {AUTH.minPassword} caracteres.</small>
          </div>
          <label className="check" htmlFor="accept">
            <input id="accept" type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
            <span className="small" style={{ color: "var(--ink)" }}>Acepto los <Link href="/terminos" target="_blank">términos</Link> y la <Link href="/privacidad" target="_blank">política de privacidad</Link>.</span>
          </label>
          {error && <div className="msg error" role="alert">{error}</div>}
          <button className="btn primary" type="submit" disabled={busy || !email || !password}>{busy ? "Creando la cuenta…" : "Crear cuenta"}</button>
        </form>
        <p className="small">¿Ya tenés cuenta? <Link href="/ingresar">Ingresá</Link></p>
      </div>
    </main>
  );
}

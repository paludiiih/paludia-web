"use client";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth";

export default function Page() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/restablecer`
    });
    setBusy(false);
    if (error) { setError(authErrorMessage(error)); return; }
    // Por seguridad, el mensaje es el mismo exista o no la cuenta.
    setSent(true);
  }

  return (
    <main className="center">
      <div className="card">
        <title>Recuperar contraseña · PaludIA</title>
        <h1>Recuperar contraseña</h1>
        {sent ? (
          <>
            <div className="msg ok" role="status">Si hay una cuenta con <b>{email.trim()}</b>, te llega un enlace para crear una contraseña nueva. Abrilo desde este mismo navegador.</div>
            <p className="small">Las cuentas creadas con Google no tienen contraseña: ingresá con «Continuar con Google».</p>
            <Link className="btn" href="/ingresar">Volver a ingresar</Link>
          </>
        ) : (
          <form className="stack" onSubmit={onSubmit} noValidate>
            <p className="lead">Escribí el correo de tu cuenta y te enviamos un enlace.</p>
            <div className="field">
              <label htmlFor="email">Correo electrónico</label>
              <input id="email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {error && <div className="msg error" role="alert">{error}</div>}
            <button className="btn primary" type="submit" disabled={busy || !email}>{busy ? "Enviando…" : "Enviar enlace"}</button>
            <p className="small"><Link href="/ingresar">Volver a ingresar</Link></p>
          </form>
        )}
      </div>
    </main>
  );
}

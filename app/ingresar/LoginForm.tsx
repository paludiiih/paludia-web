"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage, safeNext } from "@/lib/auth";
import { OAuthButtons } from "@/components/OAuthButtons";

export function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
    if (error) { setError(authErrorMessage(error)); setBusy(false); return; }
    router.replace(safeNext(next));
    router.refresh();
  }

  return (
    <main className="center">
      <div className="card">
        <h1>Ingresar</h1>
        <p className="lead">Entrá a tu cuenta de PaludIA.</p>
        {notice && <div className="msg info" role="status">{notice}</div>}
        <OAuthButtons next={next} />
        <form className="stack" onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="email">Correo electrónico</label>
            <input id="email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input id="password" className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <div className="msg error" role="alert">{error}</div>}
          <button className="btn primary" type="submit" disabled={busy || !email || !password}>{busy ? "Ingresando…" : "Ingresar"}</button>
        </form>
        <p className="small"><Link href="/recuperar">Olvidé mi contraseña</Link></p>
        <p className="small">¿No tenés cuenta? <Link href={`/registro${next !== "/" ? `?volver=${encodeURIComponent(next)}` : ""}`}>Creá una gratis</Link></p>
      </div>
    </main>
  );
}

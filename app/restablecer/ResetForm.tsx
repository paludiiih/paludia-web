"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AUTH, authErrorMessage } from "@/lib/auth";

export function ResetForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < AUTH.minPassword) { setError(`Usá al menos ${AUTH.minPassword} caracteres.`); return; }
    if (password !== repeat) { setError("Las dos contraseñas no coinciden."); return; }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setBusy(false); setError(authErrorMessage(error)); return; }
    await supabase.auth.signOut();
    router.replace("/ingresar?aviso=contrasena");
    router.refresh();
  }

  return (
    <main className="center">
      <form className="card" onSubmit={onSubmit} noValidate>
        <h1>Nueva contraseña</h1>
        <p className="lead">Elegí una contraseña nueva para tu cuenta.</p>
        <div className="field">
          <label htmlFor="password">Contraseña nueva</label>
          <input id="password" className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <small>Al menos {AUTH.minPassword} caracteres.</small>
        </div>
        <div className="field">
          <label htmlFor="repeat">Repetí la contraseña</label>
          <input id="repeat" className="input" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        </div>
        {error && <div className="msg error" role="alert">{error}</div>}
        <button className="btn primary" type="submit" disabled={busy || !password || !repeat}>{busy ? "Guardando…" : "Guardar contraseña"}</button>
      </form>
    </main>
  );
}

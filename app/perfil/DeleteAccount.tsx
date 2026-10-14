"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function DeleteAccount() {
  const [step, setStep] = useState<"idle" | "confirm" | "busy">("idle");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");

  async function remove() {
    setError("");
    setStep("busy");
    const res = await fetch("/api/cuenta", { method: "DELETE" }).catch(() => null);
    if (!res || !res.ok) {
      const body = res ? await res.json().catch(() => ({})) : {};
      setError(body.error || "No se pudo borrar la cuenta. Volvé a intentar.");
      setStep("confirm");
      return;
    }
    await createClient().auth.signOut();
    window.location.href = "/ingresar?aviso=borrada";
  }

  return (
    <section className="section">
      <h2>Borrar mi cuenta</h2>
      <p className="small">Se borran para siempre tu perfil, tu configuración y todas tus conversaciones. No se puede deshacer.</p>
      {step === "idle" ? (
        <button className="btn auto" type="button" onClick={() => setStep("confirm")}>Quiero borrar mi cuenta</button>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          <div className="field">
            <label htmlFor="confirm-delete">Para confirmar, escribí BORRAR</label>
            <input id="confirm-delete" className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </div>
          {error && <div className="msg error" role="alert">{error}</div>}
          <div className="row">
            <button className="btn danger auto" type="button" disabled={typed.trim().toUpperCase() !== "BORRAR" || step === "busy"} onClick={remove}>
              {step === "busy" ? "Borrando…" : "Borrar definitivamente"}
            </button>
            <button className="btn auto" type="button" onClick={() => { setStep("idle"); setTyped(""); setError(""); }} disabled={step === "busy"}>Cancelar</button>
          </div>
        </div>
      )}
    </section>
  );
}

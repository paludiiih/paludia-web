"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "rapido" | "normal" | "profundo";
type Settings = { instructions: string; default_mode: Mode; web_enabled: boolean };
const MODES: { value: Mode; label: string }[] = [
  { value: "rapido", label: "Rápido" },
  { value: "normal", label: "Normal" },
  { value: "profundo", label: "Profundo" }
];

export function SettingsForm({ initial }: { initial: Settings }) {
  const [s, setS] = useState<Settings>(initial);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setBusy(true);
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) { setBusy(false); setStatus({ kind: "error", text: "Tu sesión venció. Volvé a ingresar." }); return; }
    const { error } = await supabase
      .from("user_settings")
      .update({ instructions: s.instructions.slice(0, 4000), default_mode: s.default_mode, web_enabled: s.web_enabled })
      .eq("user_id", data.user.id);
    setBusy(false);
    setStatus(error ? { kind: "error", text: "No se pudo guardar. Volvé a intentar." } : { kind: "ok", text: "Configuración guardada." });
  }

  return (
    <form className="section" onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="instructions">Instrucciones personales</label>
        <small>Cómo querés que te responda PaludIA: tono, nivel de detalle, temas que te interesan.</small>
        <textarea id="instructions" className="input" maxLength={4000} value={s.instructions} placeholder="Ej: Respondeme corto y con ejemplos. Usá pesos argentinos cuando hables de precios." onChange={(e) => setS({ ...s, instructions: e.target.value })} />
        <small>{s.instructions.length} / 4000</small>
      </div>
      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Modo de respuesta por defecto</legend>
        <div className="seg">
          {MODES.map((m) => (
            <label key={m.value}>
              <input type="radio" name="mode" value={m.value} checked={s.default_mode === m.value} onChange={() => setS({ ...s, default_mode: m.value })} />
              <span>{m.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="check" htmlFor="web">
        <input id="web" type="checkbox" checked={s.web_enabled} onChange={(e) => setS({ ...s, web_enabled: e.target.checked })} />
        <span><b>Búsqueda web activada por defecto</b><br /><span className="small">PaludIA puede buscar en internet y consultar el clima cuando la pregunta lo necesite.</span></span>
      </label>
      {status && <div className={`msg ${status.kind}`} role="status">{status.text}</div>}
      <button className="btn primary auto" type="submit" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</button>
    </form>
  );
}

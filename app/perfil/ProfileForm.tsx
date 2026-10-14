"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ProfileForm({ initialName, avatarUrl, email }: { initialName: string; avatarUrl: string; email: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setBusy(true);
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) { setBusy(false); setStatus({ kind: "error", text: "Tu sesión venció. Volvé a ingresar." }); return; }
    const { error } = await supabase.from("profiles").update({ display_name: name.trim().slice(0, 80) }).eq("id", data.user.id);
    setBusy(false);
    if (error) { setStatus({ kind: "error", text: "No se pudo guardar. Volvé a intentar." }); return; }
    setStatus({ kind: "ok", text: "Perfil guardado." });
    router.refresh();
  }

  const initial = (name || email || "?").trim().charAt(0).toUpperCase();
  return (
    <form className="section" onSubmit={onSubmit}>
      <div className="row">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="avatar" src={avatarUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="avatar" aria-hidden="true">{initial}</span>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700 }}>{name || "Sin nombre"}</div>
          <div className="small" style={{ overflowWrap: "anywhere" }}>{email}</div>
        </div>
      </div>
      <div className="field">
        <label htmlFor="name">Nombre</label>
        <input id="name" className="input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      {status && <div className={`msg ${status.kind}`} role="status">{status.text}</div>}
      <button className="btn primary auto" type="submit" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</button>
    </form>
  );
}

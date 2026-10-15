"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/BrandMark";

type Experiencia = { puesto: string; empresa: string; periodo?: string; logros: string[] };
type Educacion = { titulo: string; institucion: string; periodo?: string };
type CV = {
  nombre: string; titular?: string;
  contacto: { email?: string; telefono?: string; ubicacion?: string; enlace?: string };
  resumen?: string; experiencia: Experiencia[]; educacion: Educacion[];
  habilidades: string[]; idiomas?: string[]; extras?: { titulo: string; items: string[] }[];
};
type Resultado = { cv: CV; carta: string | null; used: number; limit: number; resetsAt: string | null };

function faltan(iso: string | null) {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "ya";
  const d = Math.ceil(ms / 86400e3);
  return d > 1 ? `${d} días` : "1 día";
}

export function CrearCV() {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [info, setInfo] = useState("");
  const [oferta, setOferta] = useState("");
  const [carta, setCarta] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [res, setRes] = useState<Resultado | null>(null);
  const [cupo, setCupo] = useState<{ used: number; limit: number } | null>(null);
  const [descargando, setDescargando] = useState("");
  const salida = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/uso", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (d?.uso?.cv) setCupo({ used: d.uso.cv.used, limit: d.uso.cv.limit });
    }).catch(() => {});
  }, []);

  async function generar(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (info.trim().length < 20) { setError("Contanos tu experiencia o pegá tu CV actual (al menos unas líneas)."); return; }
    setBusy(true); setError(""); setRes(null);
    try {
      const r = await fetch("/api/cv", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, email, telefono, ubicacion, info, oferta, carta })
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(r.status === 429 && body.resetsAt ? `${body.error} Tu cupo se renueva en ${faltan(body.resetsAt)}.` : body.error || "No se pudo generar el CV. Volvé a intentar.");
        return;
      }
      setRes(body);
      if (typeof body.used === "number") setCupo({ used: body.used, limit: body.limit });
      setTimeout(() => salida.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch {
      setError("No hay conexión. Revisá tu internet y volvé a intentar.");
    } finally {
      setBusy(false);
    }
  }

  async function descargar(formato: "pdf" | "docx", tipo: "cv" | "carta") {
    if (!res) return;
    const clave = tipo + formato;
    setDescargando(clave); setError("");
    try {
      const r = await fetch("/api/documento", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formato, tipo, cv: res.cv, carta: res.carta, nombre: res.cv.nombre })
      });
      if (!r.ok) { setError("No se pudo generar el archivo. Volvé a intentar."); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tipo === "carta" ? "Carta de presentacion" : "CV"} - ${res.cv.nombre}.${formato}`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch {
      setError("No se pudo descargar. Volvé a intentar.");
    } finally {
      setDescargando("");
    }
  }

  const cv = res?.cv;
  return (
    <main className="page stack" style={{ maxWidth: 880 }}>
      <div className="calc-top">
        <span className="hero-eyebrow"><BrandMark size={20} /> Herramientas de PaludIA</span>
        <h1>Creá tu CV optimizado para <span className="accent-word">ATS</span></h1>
        <p className="lead">Contanos tu experiencia (o pegá tu CV actual) y, si tenés, la oferta a la que te postulás. PaludIA lo mejora y te lo da listo para descargar en PDF y Word, sin inventar nada.</p>
        {cupo && <p className="small">Te quedan <b style={{ color: "var(--ink)" }}>{Math.max(0, cupo.limit - cupo.used)}</b> de {cupo.limit} CV este mes en tu plan.</p>}
      </div>

      <form className="section" onSubmit={generar}>
        <div className="calc-fields">
          <div className="field"><label>Nombre y apellido</label><input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Thiago Paludi" /></div>
          <div className="field"><label>Email</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@ejemplo.com" /></div>
          <div className="field"><label>Teléfono</label><input className="input" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+54 342 ..." /></div>
          <div className="field"><label>Ubicación</label><input className="input" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} placeholder="Santa Fe, Argentina" /></div>
        </div>
        <div className="field">
          <label>Tu experiencia o CV actual <span className="small">(pegá tu CV o contá a qué te dedicaste)</span></label>
          <textarea className="input" style={{ minHeight: 150 }} value={info} maxLength={8000} onChange={(e) => setInfo(e.target.value)} placeholder="Ej.: Trabajo como repartidor en PedidosYa desde diciembre 2025. Antes fui ayudante de albañil (2024-2025). Terminé el secundario. Manejo PC, edición de video e IA. Tengo moto propia..." />
        </div>
        <div className="field">
          <label>La oferta laboral <span className="small">(opcional, pero mejora mucho el resultado)</span></label>
          <textarea className="input" style={{ minHeight: 110 }} value={oferta} maxLength={4000} onChange={(e) => setOferta(e.target.value)} placeholder="Pegá acá la descripción del puesto al que te postulás…" />
        </div>
        <label className="check"><input type="checkbox" checked={carta} onChange={(e) => setCarta(e.target.checked)} /> <span className="small">Incluir también una carta de presentación</span></label>
        {error && <div className="msg error" role="alert">{error}</div>}
        <button className="btn primary auto" type="submit" disabled={busy}>{busy ? "Generando tu CV…" : "Generar mi CV"}</button>
        <p className="small">PaludIA mejora la compatibilidad con los sistemas ATS, pero no garantiza pasar todos los filtros, y nunca inventa experiencia ni datos. Tu información no se guarda en el servidor.</p>
      </form>

      {cv && (
        <div className="stack" ref={salida}>
          <section className="section">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2>Tu CV</h2>
              <div className="row">
                <button className="btn auto" type="button" onClick={() => descargar("pdf", "cv")} disabled={descargando === "cvpdf"}>{descargando === "cvpdf" ? "Generando…" : "Descargar PDF"}</button>
                <button className="btn auto" type="button" onClick={() => descargar("docx", "cv")} disabled={descargando === "cvdocx"}>{descargando === "cvdocx" ? "Generando…" : "Descargar Word"}</button>
              </div>
            </div>
            <div className="cv-preview">
              <h3>{cv.nombre}</h3>
              {cv.titular && <p className="cv-titular">{cv.titular}</p>}
              <p className="small">{[cv.contacto.email, cv.contacto.telefono, cv.contacto.ubicacion, cv.contacto.enlace].filter(Boolean).join("  ·  ")}</p>
              {cv.resumen && <><h4>Perfil</h4><p>{cv.resumen}</p></>}
              {cv.experiencia.length > 0 && <><h4>Experiencia</h4>{cv.experiencia.map((e, i) => (
                <div key={i} className="cv-item"><b>{[e.puesto, e.empresa].filter(Boolean).join(" — ")}</b>{e.periodo && <span className="small"> · {e.periodo}</span>}<ul>{e.logros.map((l, j) => <li key={j}>{l}</li>)}</ul></div>
              ))}</>}
              {cv.educacion.length > 0 && <><h4>Educación</h4>{cv.educacion.map((e, i) => (
                <div key={i} className="cv-item"><b>{[e.titulo, e.institucion].filter(Boolean).join(" — ")}</b>{e.periodo && <span className="small"> · {e.periodo}</span>}</div>
              ))}</>}
              {cv.habilidades.length > 0 && <><h4>Habilidades</h4><p>{cv.habilidades.join("  ·  ")}</p></>}
              {cv.idiomas && cv.idiomas.length > 0 && <><h4>Idiomas</h4><p>{cv.idiomas.join("  ·  ")}</p></>}
              {(cv.extras ?? []).map((b, i) => <div key={i}><h4>{b.titulo}</h4><ul>{b.items.map((it, j) => <li key={j}>{it}</li>)}</ul></div>)}
            </div>
          </section>

          {res?.carta && (
            <section className="section">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <h2>Carta de presentación</h2>
                <div className="row">
                  <button className="btn auto" type="button" onClick={() => descargar("pdf", "carta")} disabled={descargando === "cartapdf"}>{descargando === "cartapdf" ? "Generando…" : "Descargar PDF"}</button>
                  <button className="btn auto" type="button" onClick={() => descargar("docx", "carta")} disabled={descargando === "cartadocx"}>{descargando === "cartadocx" ? "Generando…" : "Descargar Word"}</button>
                </div>
              </div>
              <div className="cv-preview" style={{ whiteSpace: "pre-wrap" }}>{res.carta}</div>
            </section>
          )}
        </div>
      )}

      <div className="row" style={{ justifyContent: "center", marginTop: 4 }}>
        <Link className="btn auto" href="/chat">Volver al chat</Link>
      </div>
    </main>
  );
}

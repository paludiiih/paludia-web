"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { createClient } from "@/lib/supabase/client";

type Fuente = { url: string; title: string };
type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  meta?: { kind?: string; fotoUrl?: string; sources?: Fuente[]; error?: boolean; truncated?: boolean; interrupted?: boolean };
  pending?: boolean;
  searching?: boolean;
  error?: string;
};
type Conv = { id: string; title: string; updated_at: string };
type Contador = { used: number; limit: number; resetsAt: string | null };
type Uso = { plan: { id: string; nombre: string; busquedaWeb: boolean }; uso: { mensaje: Contador }; chatActivo: boolean };
type Limite = { resetsAt: string; message: string } | null;

function md(text: string) {
  const html = DOMPurify.sanitize(marked.parse(text, { breaks: true, gfm: true, async: false }) as string);
  return html.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
}
function faltan(iso: string | null) {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "ya";
  const h = Math.floor(ms / 3.6e6), m = Math.ceil((ms % 3.6e6) / 6e4);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}
const uid = () => Math.random().toString(36).slice(2);

// Achica la foto en el navegador antes de enviarla (máx 1024 px, JPEG liviano).
async function prepararFoto(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as string);
    fr.onerror = () => rej(new Error("read"));
    fr.readAsDataURL(file);
  });
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("img"));
      i.src = dataUrl;
    });
    const max = 1024;
    let w = img.width, h = img.height;
    if (w > max || h > max) { const r = Math.min(max / w, max / h); w = Math.round(w * r); h = Math.round(h * r); }
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const cx = canvas.getContext("2d");
    if (!cx) return dataUrl;
    cx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    return dataUrl;
  }
}

export function ChatApp({ userId }: { userId: string }) {
  const supabase = useRef(createClient()).current;
  const [convs, setConvs] = useState<Conv[]>([]);
  const [convId, setConvId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [uso, setUso] = useState<Uso | null>(null);
  const [texto, setTexto] = useState("");
  const [foto, setFoto] = useState<{ dataUrl: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [limite, setLimite] = useState<Limite>(null);
  const [aviso, setAviso] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [, tick] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const ctl = useRef<AbortController | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const cargarUso = useCallback(async () => {
    const r = await fetch("/api/uso", { cache: "no-store" }).catch(() => null);
    if (r?.ok) setUso(await r.json());
  }, []);
  const cargarConvs = useCallback(async () => {
    const { data } = await supabase.from("conversations").select("id, title, updated_at").order("updated_at", { ascending: false }).limit(60);
    setConvs(data ?? []);
  }, [supabase]);

  useEffect(() => { cargarUso(); cargarConvs(); }, [cargarUso, cargarConvs]);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t); }, []);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight }); }, [msgs]);

  async function abrir(id: string) {
    if (busy) return;
    setDrawer(false); setConvId(id); setLimite(null); setAviso("");
    const { data } = await supabase.from("messages").select("id, role, content, meta").eq("conversation_id", id).order("created_at", { ascending: true }).limit(400);
    setMsgs((data as Msg[]) ?? []);
  }
  function nueva() {
    if (busy) ctl.current?.abort();
    setConvId(null); setMsgs([]); setLimite(null); setAviso(""); setFoto(null); setDrawer(false);
    input.current?.focus();
  }
  async function borrar(id: string) {
    await supabase.from("conversations").delete().eq("id", id).eq("user_id", userId);
    setConfirmDel(null);
    if (convId === id) nueva();
    cargarConvs();
  }

  function patch(id: string, f: (m: Msg) => Msg) { setMsgs((list) => list.map((m) => (m.id === id ? f(m) : m))); }

  async function elegirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setAviso("Solo se pueden subir imágenes (JPG, PNG o WebP)."); return; }
    if (file.size > 20 * 1024 * 1024) { setAviso("La foto es muy pesada. El máximo es 20 MB."); return; }
    try {
      setAviso("");
      const dataUrl = await prepararFoto(file);
      setFoto({ dataUrl, name: file.name });
    } catch {
      setAviso("No se pudo leer la foto. Probá con otra.");
    }
  }

  async function enviar(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) { ctl.current?.abort(); return; }
    const t = texto.trim();
    if (!t && !foto) return;
    const fotoActual = foto;
    setAviso(""); setLimite(null); setTexto(""); setFoto(null); setBusy(true);
    const userMsg: Msg = { id: uid(), role: "user", content: t || "📷 Foto", meta: fotoActual ? { fotoUrl: fotoActual.dataUrl } : undefined };
    const resp: Msg = { id: uid(), role: "assistant", content: "", pending: true };
    setMsgs((l) => [...l, userMsg, resp]);
    ctl.current = new AbortController();
    try {
      await pedirChat(t, resp.id, userMsg.id, fotoActual?.dataUrl);
    } finally {
      setBusy(false); ctl.current = null; cargarUso(); cargarConvs();
    }
  }

  async function manejarError(r: Response, respId: string, userMsgId: string, t: string) {
    const body = await r.json().catch(() => ({}));
    if (body.conversationId) setConvId(body.conversationId);
    if (r.status === 429 && body.resetsAt) {
      setMsgs((l) => l.filter((m) => m.id !== respId && m.id !== userMsgId));
      setTexto(t);
      setLimite({ resetsAt: body.resetsAt, message: body.error });
      return;
    }
    patch(respId, (m) => ({ ...m, pending: false, error: body.error || "Algo salió mal. Volvé a intentar." }));
  }

  async function pedirChat(t: string, respId: string, userMsgId: string, image?: string) {
    const r = await fetch("/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: t, conversationId: convId, image }), signal: ctl.current?.signal
    }).catch(() => null);
    if (!r) { patch(respId, (m) => ({ ...m, pending: false, error: "No hay conexión. Revisá tu internet." })); return; }
    if (!r.ok || !r.body) { await manejarError(r, respId, userMsgId, t); return; }
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = "", acc = "";
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.t === "meta") setConvId(ev.conversationId);
          else if (ev.t === "search") patch(respId, (m) => ({ ...m, searching: true }));
          else if (ev.t === "text") { acc += ev.d; const now = acc; patch(respId, (m) => ({ ...m, content: now, pending: false, searching: false })); }
          else if (ev.t === "sources") patch(respId, (m) => ({ ...m, meta: { ...m.meta, sources: ev.sources } }));
          else if (ev.t === "done") patch(respId, (m) => ({ ...m, pending: false, meta: { ...m.meta, truncated: ev.truncated } }));
          else if (ev.t === "error") patch(respId, (m) => ({ ...m, pending: false, error: ev.error }));
        }
      }
    } catch {
      patch(respId, (m) => ({ ...m, pending: false, error: acc ? "Respuesta detenida." : "Se cortó la conexión. Volvé a intentar." }));
    }
  }

  const c = uso?.uso;
  const restante = c ? Math.max(0, c.mensaje.limit - c.mensaje.used) : null;
  const inactivo = uso && !uso.chatActivo;

  return (
    <div className={`chat-app${drawer ? " drawer" : ""}`}>
      <aside className="chat-side" aria-label="Conversaciones">
        <button className="btn primary" type="button" onClick={nueva}>+ Nueva conversación</button>
        <div className="chat-usage">
          <div className="usage-row"><span>Mensajes</span><b>{restante ?? "–"} / {c?.mensaje.limit ?? "–"}</b></div>
          <div className="small">Plan {uso?.plan.nombre ?? "…"} · se renueva cada 24 h</div>
          {uso?.plan.id === "gratis" && <Link className="small" href="/planes">Ver planes con más uso</Link>}
        </div>
        <h2 className="side-title">Historial</h2>
        <ul className="conv-list">
          {convs.length === 0 && <li className="small" style={{ padding: "6px 8px" }}>Tus conversaciones van a aparecer acá.</li>}
          {convs.map((cv) => (
            <li key={cv.id} className={cv.id === convId ? "on" : ""}>
              {confirmDel === cv.id ? (
                <div className="row" style={{ padding: "6px 8px", gap: 6 }}>
                  <span className="small">¿Borrar?</span>
                  <button className="btn danger auto mini" type="button" onClick={() => borrar(cv.id)}>Borrar</button>
                  <button className="btn auto mini" type="button" onClick={() => setConfirmDel(null)}>No</button>
                </div>
              ) : (
                <>
                  <button className="conv-open" type="button" onClick={() => abrir(cv.id)}>{cv.title}</button>
                  <button className="conv-del" type="button" aria-label="Borrar conversación" onClick={() => setConfirmDel(cv.id)}>✕</button>
                </>
              )}
            </li>
          ))}
        </ul>
      </aside>
      <div className="chat-scrim" onClick={() => setDrawer(false)} />

      <section className="chat-main">
        <div className="chat-mobilebar">
          <button className="linkbtn" type="button" onClick={() => setDrawer(true)}>☰ Historial</button>
          <span className="small">{restante ?? "–"} mensajes</span>
        </div>
        <div className="chat-scroll" ref={scroller}>
          <div className="chat-thread">
            {msgs.length === 0 && (
              <div className="chat-welcome">
                <h1>Tu socio de <span style={{ color: "var(--accent)" }}>ecommerce</span></h1>
                <p className="lead">Preguntame por productos ganadores, cómo armar tu tienda, anuncios para Meta, precios y proveedores. Y con el <b>clip 📎</b> podés subir una foto (un producto, un anuncio, una captura) para que la lea y te ayude.</p>
              </div>
            )}
            {msgs.map((m) => (
              <div key={m.id} className={`bubble-row ${m.role}`}>
                {m.role === "user" ? (
                  <div className="bubble">
                    {m.meta?.fotoUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img className="bubble-foto" src={m.meta.fotoUrl} alt="Foto enviada" />
                    ) : m.meta?.kind === "foto" ? (
                      <span className="tag">📷 Foto</span>
                    ) : null}
                    {m.content && m.content !== "📷 Foto" ? <span>{m.content}</span> : null}
                  </div>
                ) : (
                  <div className="answer">
                    <div className="who"><span className="sun" /> PaludIA</div>
                    {m.pending && <div className="small thinking">{m.searching ? "Buscando en internet…" : "Pensando…"}</div>}
                    {!m.pending && m.searching && <div className="small">Buscando en internet…</div>}
                    {m.content && <div className="md" dangerouslySetInnerHTML={{ __html: md(m.content) }} />}
                    {m.meta?.sources && m.meta.sources.length > 0 && (
                      <div className="sources">
                        <b>Fuentes</b>
                        {m.meta.sources.map((s, i) => (
                          <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer">[{i + 1}] {s.title}</a>
                        ))}
                      </div>
                    )}
                    {m.meta?.truncated && <div className="small">La respuesta quedó cortada por ser muy larga. Escribí «seguí» para continuar.</div>}
                    {m.error && <div className="msg error" role="alert">{m.error}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="chat-bottom">
          {limite && (
            <div className="limit-box" role="status">
              <b>{limite.message}</b>
              <span>Podés volver a escribir en <b>{faltan(limite.resetsAt)}</b>.</span>
              {uso?.plan.id === "gratis" && <Link href="/planes">Ver planes con más mensajes por día</Link>}
            </div>
          )}
          {inactivo && <div className="msg info">El chat con IA todavía no está activado.</div>}
          {aviso && <div className="msg error">{aviso}</div>}
          {foto && (
            <div className="foto-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={foto.dataUrl} alt="Foto para enviar" />
              <span className="small">Foto lista para enviar</span>
              <button className="linkbtn" type="button" onClick={() => setFoto(null)} aria-label="Quitar foto">Quitar ✕</button>
            </div>
          )}
          <form className="composer" onSubmit={enviar}>
            <textarea
              ref={input}
              className="composer-input"
              rows={1}
              aria-label="Mensaje"
              placeholder={foto ? "Agregá una pregunta sobre la foto (opcional)…" : "Escribí tu mensaje… o subí una foto con el clip 📎"}
              value={texto}
              maxLength={8000}
              onChange={(e) => { setTexto(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px"; }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !matchMedia("(pointer:coarse)").matches) { e.preventDefault(); enviar(); } }}
            />
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={elegirFoto} />
            <div className="row" style={{ justifyContent: "space-between" }}>
              <button className="btn auto" type="button" onClick={() => fileRef.current?.click()} disabled={busy} aria-label="Subir una foto">📎 Foto</button>
              <button className="btn primary auto" type="submit" disabled={!busy && !texto.trim() && !foto}>
                {busy ? "Detener" : "Enviar"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}

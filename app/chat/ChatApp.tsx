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
  meta?: { kind?: string; url?: string; sources?: Fuente[]; error?: boolean; truncated?: boolean; interrupted?: boolean };
  pending?: boolean;
  searching?: boolean;
  error?: string;
};
type Conv = { id: string; title: string; updated_at: string };
type Contador = { used: number; limit: number; resetsAt: string | null };
type Uso = { plan: { id: string; nombre: string; busquedaWeb: boolean }; uso: { mensaje: Contador; imagen: Contador }; chatActivo: boolean; imagenesActivas: boolean };
type Limite = { kind: "mensaje" | "imagen"; resetsAt: string; message: string } | null;

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

export function ChatApp({ userId }: { userId: string }) {
  const supabase = useRef(createClient()).current;
  const [convs, setConvs] = useState<Conv[]>([]);
  const [convId, setConvId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [uso, setUso] = useState<Uso | null>(null);
  const [modo, setModo] = useState<"mensaje" | "imagen">("mensaje");
  const [texto, setTexto] = useState("");
  const [busy, setBusy] = useState(false);
  const [limite, setLimite] = useState<Limite>(null);
  const [aviso, setAviso] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [, tick] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const ctl = useRef<AbortController | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);

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
    setConvId(null); setMsgs([]); setLimite(null); setAviso(""); setDrawer(false);
    input.current?.focus();
  }
  async function borrar(id: string) {
    await supabase.from("conversations").delete().eq("id", id).eq("user_id", userId);
    setConfirmDel(null);
    if (convId === id) nueva();
    cargarConvs();
  }

  function patch(id: string, f: (m: Msg) => Msg) { setMsgs((list) => list.map((m) => (m.id === id ? f(m) : m))); }

  async function enviar(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) { ctl.current?.abort(); return; }
    const t = texto.trim();
    if (!t) return;
    setAviso(""); setLimite(null); setTexto(""); setBusy(true);
    const userMsg: Msg = { id: uid(), role: "user", content: t, meta: modo === "imagen" ? { kind: "imagen" } : undefined };
    const resp: Msg = { id: uid(), role: "assistant", content: "", pending: true, meta: modo === "imagen" ? { kind: "imagen" } : undefined };
    setMsgs((l) => [...l, userMsg, resp]);
    ctl.current = new AbortController();
    try {
      if (modo === "imagen") await pedirImagen(t, resp.id, userMsg.id);
      else await pedirChat(t, resp.id, userMsg.id);
    } finally {
      setBusy(false); ctl.current = null; cargarUso(); cargarConvs();
    }
  }

  async function manejarError(r: Response, respId: string, kind: "mensaje" | "imagen", userMsgId: string, t: string) {
    const body = await r.json().catch(() => ({}));
    if (body.conversationId) setConvId(body.conversationId);
    if (r.status === 429 && body.resetsAt) {
      setMsgs((l) => l.filter((m) => m.id !== respId && m.id !== userMsgId));
      setTexto(t);
      setLimite({ kind, resetsAt: body.resetsAt, message: body.error });
      return;
    }
    patch(respId, (m) => ({ ...m, pending: false, error: body.error || "Algo salió mal. Volvé a intentar." }));
  }

  async function pedirChat(t: string, respId: string, userMsgId: string) {
    const r = await fetch("/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: t, conversationId: convId }), signal: ctl.current?.signal
    }).catch(() => null);
    if (!r) { patch(respId, (m) => ({ ...m, pending: false, error: "No hay conexión. Revisá tu internet." })); return; }
    if (!r.ok || !r.body) { await manejarError(r, respId, "mensaje", userMsgId, t); return; }
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

  async function pedirImagen(t: string, respId: string, userMsgId: string) {
    const r = await fetch("/api/imagen", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: t, conversationId: convId }), signal: ctl.current?.signal
    }).catch(() => null);
    if (!r) { patch(respId, (m) => ({ ...m, pending: false, error: "No hay conexión. Revisá tu internet." })); return; }
    if (!r.ok) { await manejarError(r, respId, "imagen", userMsgId, t); return; }
    const body = await r.json();
    setConvId(body.conversationId);
    patch(respId, (m) => ({ ...m, pending: false, content: `Imagen generada: ${t}`, meta: { kind: "imagen", url: body.url } }));
  }

  const c = uso?.uso;
  const restante = (k: "mensaje" | "imagen") => (c ? Math.max(0, c[k].limit - c[k].used) : null);
  const inactivo = uso && (modo === "mensaje" ? !uso.chatActivo : !uso.imagenesActivas);

  return (
    <div className={`chat-app${drawer ? " drawer" : ""}`}>
      <aside className="chat-side" aria-label="Conversaciones">
        <button className="btn primary" type="button" onClick={nueva}>+ Nueva conversación</button>
        <div className="chat-usage">
          <div className="usage-row"><span>Mensajes</span><b>{restante("mensaje") ?? "–"} / {c?.mensaje.limit ?? "–"}</b></div>
          <div className="usage-row"><span>Imágenes</span><b>{restante("imagen") ?? "–"} / {c?.imagen.limit ?? "–"}</b></div>
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
          <span className="small">{restante("mensaje") ?? "–"} mensajes · {restante("imagen") ?? "–"} imágenes</span>
        </div>
        <div className="chat-scroll" ref={scroller}>
          <div className="chat-thread">
            {msgs.length === 0 && (
              <div className="chat-welcome">
                <h1>¿En qué te ayudo <span style={{ color: "var(--accent)" }}>hoy</span>?</h1>
                <p className="lead">Escribí tu pregunta, o tocá <b>Imagen</b> para crear una imagen a partir de una descripción.</p>
              </div>
            )}
            {msgs.map((m) => (
              <div key={m.id} className={`bubble-row ${m.role}`}>
                {m.role === "user" ? (
                  <div className="bubble">{m.meta?.kind === "imagen" && <span className="tag">Imagen</span>}{m.content}</div>
                ) : (
                  <div className="answer">
                    <div className="who"><span className="sun" /> PaludIA</div>
                    {m.pending && <div className="small thinking">{m.meta?.kind === "imagen" ? "Creando la imagen… puede tardar unos segundos." : m.searching ? "Buscando en internet…" : "Pensando…"}</div>}
                    {!m.pending && m.searching && <div className="small">Buscando en internet…</div>}
                    {m.meta?.kind === "imagen" && m.meta.url ? (
                      <figure className="gen-img">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={m.meta.url} alt={m.content} />
                        <figcaption><a href={m.meta.url} target="_blank" rel="noopener noreferrer">Abrir en tamaño completo</a></figcaption>
                      </figure>
                    ) : (
                      m.content && !(m.meta?.kind === "imagen" && m.pending) && <div className="md" dangerouslySetInnerHTML={{ __html: md(m.content) }} />
                    )}
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
              <span>Podés volver a {limite.kind === "mensaje" ? "escribir" : "crear imágenes"} en <b>{faltan(limite.resetsAt)}</b>.</span>
              {uso?.plan.id === "gratis" && <Link href="/planes">Ver planes con 500 mensajes y 30 imágenes por día</Link>}
            </div>
          )}
          {inactivo && <div className="msg info">{modo === "mensaje" ? "El chat con IA todavía no está activado." : "La creación de imágenes todavía no está activada."}</div>}
          {aviso && <div className="msg error">{aviso}</div>}
          <form className="composer" onSubmit={enviar}>
            <textarea
              ref={input}
              className="composer-input"
              rows={1}
              aria-label={modo === "imagen" ? "Descripción de la imagen" : "Mensaje"}
              placeholder={modo === "imagen" ? "Describí la imagen: «un gato astronauta en Santa Fe, estilo acuarela»" : "Escribí tu mensaje…"}
              value={texto}
              maxLength={modo === "imagen" ? 1500 : 8000}
              onChange={(e) => { setTexto(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px"; }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !matchMedia("(pointer:coarse)").matches) { e.preventDefault(); enviar(); } }}
            />
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div className="seg" role="group" aria-label="Qué querés crear">
                <label><input type="radio" name="modo" checked={modo === "mensaje"} onChange={() => setModo("mensaje")} /><span>Mensaje</span></label>
                <label><input type="radio" name="modo" checked={modo === "imagen"} onChange={() => setModo("imagen")} /><span>Imagen</span></label>
              </div>
              <button className="btn primary auto" type="submit" disabled={!busy && !texto.trim()}>
                {busy ? "Detener" : modo === "imagen" ? "Crear imagen" : "Enviar"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}

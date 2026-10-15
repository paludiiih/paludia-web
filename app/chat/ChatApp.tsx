"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { createClient } from "@/lib/supabase/client";
import { BrandMark } from "@/components/BrandMark";

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

const MODELO: Record<string, string> = { gratis: "Claude Haiku", pro: "Claude Sonnet", premium: "Claude Opus" };

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
function horaDe(iso: string) {
  const d = new Date(iso), now = new Date();
  const mismo = d.toDateString() === now.toDateString();
  return mismo ? d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
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

/* ---- iconos (trazo, 18px) ---- */
const I = {
  home: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></svg>,
  compass: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></svg>,
  tools: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2-2z" /></svg>,
  doc: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>,
  crown: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8l4 3 5-6 5 6 4-3-2 11H5z" /></svg>,
  search: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>,
  gear: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.2A1.6 1.6 0 0 0 7 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4.6 15H4a2 2 0 1 1 0-4h.2A1.6 1.6 0 0 0 5.6 8.4L5.5 8.3a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 11 4.6V4a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H20a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4.9z" /></svg>,
  globe: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 2.5 15.5 0 18M12 3c-2.5 2.5-2.5 15.5 0 18" /></svg>,
  photo: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="m4 18 5-5 4 4 3-3 4 4" /></svg>,
  clip: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5 12.5 20a5 5 0 0 1-7-7l8-8a3.3 3.3 0 0 1 4.7 4.7l-8 8a1.6 1.6 0 0 1-2.3-2.3l7.3-7.3" /></svg>,
  kit: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8l9-5 9 5-9 5z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></svg>,
  video: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m21 8-5 4 5 4z" /></svg>,
  calc: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 11h0M12 11h0M16 11h0M8 15h0M12 15h0M16 15v4M8 19h4" /></svg>,
  send: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12 20 4l-6 16-3-7z" /><path d="m11 13 9-9" /></svg>,
  menu: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
};

export function ChatApp({ userId, userName }: { userId: string; userName: string }) {
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
  const [q, setQ] = useState("");
  const [nav, setNav] = useState(false);
  const [tools, setTools] = useState(false);
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
    const { data } = await supabase.from("conversations").select("id, title, updated_at").order("updated_at", { ascending: false }).limit(80);
    setConvs(data ?? []);
  }, [supabase]);

  useEffect(() => { cargarUso(); cargarConvs(); }, [cargarUso, cargarConvs]);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t); }, []);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight }); }, [msgs]);

  async function abrir(id: string) {
    if (busy) return;
    setNav(false); setConvId(id); setLimite(null); setAviso("");
    const { data } = await supabase.from("messages").select("id, role, content, meta").eq("conversation_id", id).order("created_at", { ascending: true }).limit(400);
    setMsgs((data as Msg[]) ?? []);
  }
  function nueva() {
    if (busy) ctl.current?.abort();
    setConvId(null); setMsgs([]); setLimite(null); setAviso(""); setFoto(null); setNav(false);
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
      setTools(false);
      input.current?.focus();
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
  const usadoPct = c && c.mensaje.limit ? Math.min(100, Math.round((c.mensaje.used / c.mensaje.limit) * 100)) : 0;
  const inactivo = uso ? !uso.chatActivo : false;
  const web = uso?.plan.busquedaWeb ?? false;
  const modelo = uso ? MODELO[uso.plan.id] ?? "Claude" : "";
  const inicial = (userName || "U").trim().charAt(0).toUpperCase();
  const convsFiltradas = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? convs.filter((cv) => cv.title.toLowerCase().includes(term)) : convs;
  }, [convs, q]);

  function abrirFoto() { setTools(false); fileRef.current?.click(); }
  function usarChip(t: string) { setTexto(t); input.current?.focus(); }

  return (
    <div className={`chat-shell${nav ? " nav" : ""}${tools ? " tools" : ""}`}>
      {/* ============ IZQUIERDA ============ */}
      <aside className="cs-left" aria-label="Navegación">
        <Link href="/" className="cs-brand" aria-label="PaludIA">
          <BrandMark size={34} idSuffix="side" />
          <span className="brand-text"><span className="logo">Palud<b>IA</b></span><span className="brand-tag">Tu IA, siempre contigo</span></span>
        </Link>
        <button className="cs-new" type="button" onClick={nueva}><span style={{ fontSize: 18, lineHeight: 0 }}>+</span> Nueva conversación</button>
        <nav className="cs-nav" aria-label="Secciones">
          <button className="cs-navitem on" type="button" onClick={nueva}>{I.home} Inicio</button>
          <span className="cs-navitem pronto">{I.compass} Explorar <span className="cs-chip">Pronto</span></span>
          <button className="cs-navitem" type="button" onClick={() => setTools(true)}>{I.tools} Herramientas</button>
          <span className="cs-navitem pronto">{I.doc} Mis documentos <span className="cs-chip">Pronto</span></span>
          <Link className="cs-navitem" href="/planes">{I.crown} Planes</Link>
        </nav>

        <div className="cs-sectlabel">Conversaciones recientes</div>
        <ul className="conv-list">
          {convsFiltradas.length === 0 && <li className="small cs-empty">{q ? "No hay conversaciones con ese texto." : "Tus conversaciones van a aparecer acá."}</li>}
          {convsFiltradas.map((cv) => (
            <li key={cv.id} className={cv.id === convId ? "on" : ""}>
              {confirmDel === cv.id ? (
                <div className="row" style={{ padding: "6px 8px", gap: 6 }}>
                  <span className="small">¿Borrar?</span>
                  <button className="btn danger auto mini" type="button" onClick={() => borrar(cv.id)}>Borrar</button>
                  <button className="btn auto mini" type="button" onClick={() => setConfirmDel(null)}>No</button>
                </div>
              ) : (
                <>
                  <button className="conv-open" type="button" onClick={() => abrir(cv.id)}>
                    <span className="conv-title">{cv.title}</span>
                    <span className="conv-time">{horaDe(cv.updated_at)}</span>
                  </button>
                  <button className="conv-del" type="button" aria-label="Borrar conversación" onClick={() => setConfirmDel(cv.id)}>✕</button>
                </>
              )}
            </li>
          ))}
        </ul>

        <div className="cs-foot">
          <div className="cs-usage">
            <div className="usage-row"><span>Mensajes</span><b>{restante ?? "–"} / {c?.mensaje.limit ?? "–"}</b></div>
            <div className={`usage-bar${usadoPct >= 80 ? " low" : ""}`}><i style={{ width: `${usadoPct}%` }} /></div>
            <div className="usage-row"><span>Plan {uso?.plan.nombre ?? "…"}</span><span style={{ fontSize: 12 }}>cada 24 h</span></div>
          </div>
          <Link href="/perfil" className="cs-profile">
            <span className="cs-avatar">{inicial}</span>
            <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
              <span className="who-name">{userName}</span>
              <span className="who-plan">Plan {uso?.plan.nombre ?? "Gratis"}</span>
            </span>
            <span className="chev">›</span>
          </Link>
        </div>
      </aside>
      <div className="cs-scrim" onClick={() => { setNav(false); setTools(false); }} />

      {/* ============ CENTRO ============ */}
      <section className="cs-center">
        {/* barra superior (escritorio) */}
        <div className="cs-topbar">
          <div className="cs-search">
            {I.search}
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en tus conversaciones…" aria-label="Buscar conversaciones" />
          </div>
          <div className="cs-topright">
            <span className={`pill${web ? " live" : ""}`} title={web ? "La búsqueda web está activa en tu plan" : "La búsqueda web está disponible en el plan Pro"}>
              {web ? <span className="dot" /> : I.globe} Web{web ? "" : " · Pro"}
            </span>
            {modelo && <span className="pill model">{modelo}</span>}
            <Link href="/configuracion" className="icon-btn" aria-label="Configuración">{I.gear}</Link>
            <Link href="/perfil" className="icon-btn" aria-label="Perfil"><span style={{ fontWeight: 800, fontSize: 14 }}>{inicial}</span></Link>
          </div>
        </div>
        {/* barra superior (móvil) */}
        <div className="cs-mobilebar">
          <button className="icon-btn" type="button" aria-label="Abrir menú" onClick={() => setNav(true)}>{I.menu}</button>
          <Link href="/" className="cs-brand" style={{ gap: 8 }}><BrandMark size={28} idSuffix="mob" /><span className="logo" style={{ fontSize: 19 }}>Palud<b>IA</b></span></Link>
          <button className="icon-btn" type="button" aria-label="Herramientas" style={{ marginLeft: "auto" }} onClick={() => setTools(true)}>{I.tools}</button>
        </div>

        <div className="chat-scroll" ref={scroller}>
          <div className="chat-thread">
            {msgs.length === 0 && (
              <div className="chat-welcome">
                <BrandMark size={52} idSuffix="welc" className="welcome-orb" />
                <h1>Convertí tus ideas en <span className="accent-word">resultados</span></h1>
                <p className="lead">Soy PaludIA, tu socia de ecommerce. Preguntame por productos ganadores, armá tu tienda, escribí anuncios, o subí la foto de un producto con el clip y la leo para ayudarte.</p>
                <div className="welcome-chips">
                  <button className="welcome-chip" type="button" onClick={() => usarChip("Dame 5 ideas de productos ganadores para vender en Argentina ahora.")}>💡 Ideas de productos ganadores</button>
                  <button className="welcome-chip" type="button" onClick={() => usarChip("Escribime una ficha de producto persuasiva. El producto es: ")}>📝 Escribir una ficha de producto</button>
                  <button className="welcome-chip" type="button" onClick={() => usarChip("Dame 3 ángulos de anuncio para Instagram para este producto: ")}>📣 Ideas de anuncios para Meta</button>
                  <button className="welcome-chip" type="button" onClick={abrirFoto}>📷 Subir una foto para analizar</button>
                </div>
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
                    <div className="who"><BrandMark size={26} idSuffix="who" className="who-orb" /> PaludIA</div>
                    {m.pending && <div className="thinking"><span className="orb-pulse" /> {m.searching ? "Buscando información en la web…" : "Pensando…"}</div>}
                    {!m.pending && m.searching && <div className="live-tag"><span className="dot" /> Buscando información en la web…</div>}
                    {m.content && <div className="md" dangerouslySetInnerHTML={{ __html: md(m.content) }} />}
                    {m.meta?.sources && m.meta.sources.length > 0 && (
                      <div className="sources">
                        <b>Fuentes consultadas</b>
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
              placeholder={foto ? "Agregá una pregunta sobre la foto (opcional)…" : "Escribí tu mensaje… o subí una foto con el clip"}
              value={texto}
              maxLength={8000}
              onChange={(e) => { setTexto(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px"; }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !matchMedia("(pointer:coarse)").matches) { e.preventDefault(); enviar(); } }}
            />
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={elegirFoto} />
            <div className="composer-actions">
              <button className="comp-btn" type="button" onClick={abrirFoto} disabled={busy} aria-label="Adjuntar una foto">{I.clip} Adjuntar</button>
              <button className={`comp-send${busy ? " stop" : ""}`} type="submit" disabled={!busy && !texto.trim() && !foto} aria-label={busy ? "Detener" : "Enviar"}>
                {busy ? "Detener" : I.send}
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* ============ DERECHA: herramientas ============ */}
      <aside className="cs-right" aria-label="Herramientas de PaludIA">
        <div className="promo-card">
          <h3>Convertí tus ideas en resultados</h3>
          <p>Explorá todo lo que podés hacer con PaludIA para tu ecommerce.</p>
          <Link className="btn auto" href="/planes">Ver planes</Link>
        </div>

        <div className="panel-label">Herramientas</div>
        <button className="tool-row" type="button" onClick={abrirFoto}>
          <span className="tool-ico b1">{I.photo}</span>
          <span className="tool-tx"><b>Analizar una foto</b><span>Subí un producto, anuncio o etiqueta</span></span>
        </button>
        <div className="tool-row" aria-disabled={!web}>
          <span className="tool-ico b3">{I.globe}</span>
          <span className="tool-tx"><b>Búsqueda web</b><span>{web ? "Precios y tiendas en vivo, con fuentes" : "Precios y tiendas en vivo"}</span></span>
          <span className={web ? "cs-chip" : "soon-chip"} style={web ? { color: "var(--turq)", borderColor: "rgba(34,211,238,.35)", background: "rgba(34,211,238,.1)" } : undefined}>{web ? "Activa" : "Pro"}</span>
        </div>
        <Link className="tool-row" href="/planes">
          <span className="tool-ico b4">{I.crown}</span>
          <span className="tool-tx"><b>Planes y límites</b><span>Más mensajes y funciones</span></span>
        </Link>

        <div className="panel-label">Próximamente</div>
        <div className="tool-row soon">
          <span className="tool-ico b2">{I.kit}</span>
          <span className="tool-tx"><b>Kit de producto</b><span>Ficha, anuncios, precio y oferta</span></span>
          <span className="soon-chip">Pronto</span>
        </div>
        <div className="tool-row soon">
          <span className="tool-ico b2">{I.video}</span>
          <span className="tool-tx"><b>Videos UGC</b><span>Anuncios en video con IA</span></span>
          <span className="soon-chip">Pronto</span>
        </div>
        <div className="tool-row soon">
          <span className="tool-ico b4">{I.calc}</span>
          <span className="tool-tx"><b>Calculadora de precios</b><span>Margen, costo y punto de equilibrio</span></span>
          <span className="soon-chip">Pronto</span>
        </div>
      </aside>
    </div>
  );
}

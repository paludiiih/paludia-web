"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BrandMark } from "@/components/BrandMark";

const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });
const pct = (n: number) => `${n.toLocaleString("es-AR", { maximumFractionDigits: 1 })} %`;
const num = (s: string) => {
  const v = parseFloat(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(v) ? v : NaN;
};

function Campo({ label, value, onChange, placeholder, suffix }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; suffix?: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="calc-input">
        {suffix === "$" && <span className="calc-affix">$</span>}
        <input className="input" inputMode="decimal" type="number" min="0" step="any" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        {suffix === "%" && <span className="calc-affix right">%</span>}
      </div>
    </div>
  );
}

function Salida({ children, label, destacado }: { children: React.ReactNode; label: string; destacado?: boolean }) {
  return (
    <div className={`calc-out${destacado ? " big" : ""}`}>
      <span className="calc-out-label">{label}</span>
      <span className="calc-out-val">{children}</span>
    </div>
  );
}

/* 1. Precio de venta a partir del costo y el margen deseado */
function PrecioVenta() {
  const [costo, setCosto] = useState("");
  const [margen, setMargen] = useState("");
  const r = useMemo(() => {
    const c = num(costo), m = num(margen);
    if (!Number.isFinite(c) || !Number.isFinite(m) || c < 0) return null;
    if (m >= 100) return { error: "El margen tiene que ser menor a 100 %." };
    const precio = c / (1 - m / 100);
    const ganancia = precio - c;
    const markup = c > 0 ? (ganancia / c) * 100 : 0;
    return { precio, ganancia, markup };
  }, [costo, margen]);
  return (
    <section className="section calc-card">
      <div className="calc-head"><h2>¿A cuánto vender?</h2><p className="small">Poné tu costo y el margen que querés ganar, y te digo el precio de venta.</p></div>
      <div className="calc-fields">
        <Campo label="Costo del producto" value={costo} onChange={setCosto} placeholder="1200" suffix="$" />
        <Campo label="Margen deseado (sobre la venta)" value={margen} onChange={setMargen} placeholder="40" suffix="%" />
      </div>
      {r && "error" in r && <div className="msg error">{r.error}</div>}
      {r && !("error" in r) && (
        <div className="calc-outs">
          <Salida label="Precio de venta sugerido" destacado>{ars.format(r.precio)}</Salida>
          <Salida label="Ganancia por unidad">{ars.format(r.ganancia)}</Salida>
          <Salida label="Equivale a un recargo sobre el costo de">{pct(r.markup)}</Salida>
        </div>
      )}
      <p className="small calc-note">Incluí en el costo todo lo que pagás por el producto: compra, envío del proveedor, comisiones e impuestos.</p>
    </section>
  );
}

/* 2. Margen y ganancia a partir del precio y el costo */
function MargenGanancia() {
  const [precio, setPrecio] = useState("");
  const [costo, setCosto] = useState("");
  const r = useMemo(() => {
    const p = num(precio), c = num(costo);
    if (!Number.isFinite(p) || !Number.isFinite(c) || p <= 0 || c < 0) return null;
    const ganancia = p - c;
    const margen = (ganancia / p) * 100;
    const markup = c > 0 ? (ganancia / c) * 100 : 0;
    return { ganancia, margen, markup };
  }, [precio, costo]);
  return (
    <section className="section calc-card">
      <div className="calc-head"><h2>¿Cuánto gano con este precio?</h2><p className="small">Poné el precio de venta y el costo, y te muestro la ganancia y el margen.</p></div>
      <div className="calc-fields">
        <Campo label="Precio de venta" value={precio} onChange={setPrecio} placeholder="2000" suffix="$" />
        <Campo label="Costo del producto" value={costo} onChange={setCosto} placeholder="1200" suffix="$" />
      </div>
      {r && (
        <div className="calc-outs">
          <Salida label="Ganancia por unidad" destacado>{ars.format(r.ganancia)}</Salida>
          <Salida label="Margen (sobre la venta)">{pct(r.margen)}</Salida>
          <Salida label="Recargo sobre el costo (markup)">{pct(r.markup)}</Salida>
        </div>
      )}
    </section>
  );
}

/* 3. Punto de equilibrio */
function PuntoEquilibrio() {
  const [fijos, setFijos] = useState("");
  const [precio, setPrecio] = useState("");
  const [variable, setVariable] = useState("");
  const r = useMemo(() => {
    const f = num(fijos), p = num(precio), v = num(variable);
    if (!Number.isFinite(f) || !Number.isFinite(p) || !Number.isFinite(v) || f < 0 || p <= 0 || v < 0) return null;
    const contrib = p - v;
    if (contrib <= 0) return { error: "El precio de venta tiene que ser mayor al costo variable por unidad; si no, nunca cubrís los costos fijos." };
    const unidades = Math.ceil(f / contrib);
    const facturacion = unidades * p;
    return { contrib, unidades, facturacion };
  }, [fijos, precio, variable]);
  return (
    <section className="section calc-card">
      <div className="calc-head"><h2>¿Cuánto tengo que vender para no perder?</h2><p className="small">El punto de equilibrio: las unidades que necesitás por mes para cubrir tus costos fijos.</p></div>
      <div className="calc-fields">
        <Campo label="Costos fijos por mes" value={fijos} onChange={setFijos} placeholder="150000" suffix="$" />
        <Campo label="Precio de venta por unidad" value={precio} onChange={setPrecio} placeholder="2000" suffix="$" />
        <Campo label="Costo variable por unidad" value={variable} onChange={setVariable} placeholder="1200" suffix="$" />
      </div>
      {r && "error" in r && <div className="msg error">{r.error}</div>}
      {r && !("error" in r) && (
        <div className="calc-outs">
          <Salida label="Unidades por mes para no perder" destacado>{r.unidades.toLocaleString("es-AR")}</Salida>
          <Salida label="Facturación en el punto de equilibrio">{ars.format(r.facturacion)}</Salida>
          <Salida label="Ganás por unidad (después de costos variables)">{ars.format(r.contrib)}</Salida>
        </div>
      )}
      <p className="small calc-note">Costos fijos: alquiler, sueldos, servicios, suscripciones. Costo variable: lo que gastás por cada venta (producto, envío, comisión de la plataforma).</p>
    </section>
  );
}

export function Calculadoras() {
  return (
    <main className="page stack" style={{ maxWidth: 860 }}>
      <div className="calc-top">
        <span className="hero-eyebrow"><BrandMark size={20} /> Herramientas de PaludIA</span>
        <h1>Calculadoras de ecommerce</h1>
        <p className="lead">Precio de venta, margen y punto de equilibrio. Se calcula al instante en tu dispositivo: gratis, sin límite y sin usar la IA.</p>
      </div>
      <PrecioVenta />
      <MargenGanancia />
      <PuntoEquilibrio />
      <div className="row" style={{ justifyContent: "center", marginTop: 8 }}>
        <Link className="btn primary auto" href="/chat">Volver al chat</Link>
      </div>
    </main>
  );
}

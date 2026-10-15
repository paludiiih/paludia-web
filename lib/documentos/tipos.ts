// Estructura de datos de un CV. La IA la completa a partir de los datos del usuario
// y la oferta; los generadores de PDF y DOCX la convierten en archivos apto-ATS.

export type Experiencia = { puesto: string; empresa: string; periodo?: string; logros: string[] };
export type Educacion = { titulo: string; institucion: string; periodo?: string };
export type BloqueExtra = { titulo: string; items: string[] };

export type CV = {
  nombre: string;
  titular?: string; // ej.: "Atención al cliente · Ventas"
  contacto: { email?: string; telefono?: string; ubicacion?: string; enlace?: string };
  resumen?: string;
  experiencia: Experiencia[];
  educacion: Educacion[];
  habilidades: string[];
  idiomas?: string[];
  extras?: BloqueExtra[]; // cursos, certificaciones, etc.
};

// Limpia y recorta un CV que viene de la IA, para no romper los generadores.
export function sanearCV(x: unknown): CV {
  const o = (x ?? {}) as Record<string, unknown>;
  const s = (v: unknown, max = 400) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const arrS = (v: unknown, max = 30, maxLen = 300) => (Array.isArray(v) ? v.map((i) => s(i, maxLen)).filter(Boolean).slice(0, max) : []);
  const c = (o.contacto ?? {}) as Record<string, unknown>;
  return {
    nombre: s(o.nombre, 120) || "Nombre y Apellido",
    titular: s(o.titular, 160),
    contacto: { email: s(c.email, 120), telefono: s(c.telefono, 60), ubicacion: s(c.ubicacion, 120), enlace: s(c.enlace, 200) },
    resumen: s(o.resumen, 1200),
    experiencia: (Array.isArray(o.experiencia) ? o.experiencia : []).slice(0, 12).map((e) => {
      const r = (e ?? {}) as Record<string, unknown>;
      return { puesto: s(r.puesto, 160), empresa: s(r.empresa, 160), periodo: s(r.periodo, 80), logros: arrS(r.logros, 10, 400) };
    }).filter((e) => e.puesto || e.empresa),
    educacion: (Array.isArray(o.educacion) ? o.educacion : []).slice(0, 10).map((e) => {
      const r = (e ?? {}) as Record<string, unknown>;
      return { titulo: s(r.titulo, 160), institucion: s(r.institucion, 160), periodo: s(r.periodo, 80) };
    }).filter((e) => e.titulo || e.institucion),
    habilidades: arrS(o.habilidades, 30, 80),
    idiomas: arrS(o.idiomas, 10, 80),
    extras: (Array.isArray(o.extras) ? o.extras : []).slice(0, 6).map((b) => {
      const r = (b ?? {}) as Record<string, unknown>;
      return { titulo: s(r.titulo, 120), items: arrS(r.items, 15, 200) };
    }).filter((b) => b.titulo && b.items.length)
  };
}

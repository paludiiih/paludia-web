// Configuración central de los planes de PaludIA.
// Cambiá nombres, precios, límites o modelos acá y se aplica en todo el sitio y en el servidor.

export type PlanId = "gratis" | "pro" | "premium";

export type Plan = {
  id: PlanId;
  nombre: string;
  precio: string; // texto que se muestra en la página de planes
  mensajesPorDia: number; // se renuevan 24 h después del primer mensaje
  imagenesPorDia: number;
  modeloChat: string; // modelo de Claude
  maxRespuesta: number; // largo máximo de cada respuesta (tokens)
  busquedaWeb: boolean;
  modeloImagen: string; // modelo de fal.ai
  descripcion: string[];
  disponible: boolean; // false = "Próximamente"
};

export const PLANES: Record<PlanId, Plan> = {
  gratis: {
    id: "gratis",
    nombre: "Gratis",
    precio: "US$0",
    mensajesPorDia: 30,
    imagenesPorDia: 4,
    modeloChat: "claude-haiku-5-5",
    maxRespuesta: 2048,
    busquedaWeb: false,
    modeloImagen: "fal-ai/flux/schnell",
    descripcion: ["30 mensajes cada 24 horas", "4 imágenes cada 24 horas", "Asistente de ecommerce con IA rápida (Claude Haiku)", "Historial guardado en tu cuenta"],
    disponible: true
  },
  pro: {
    id: "pro",
    nombre: "Pro",
    precio: "US$15",
    mensajesPorDia: 50,
    imagenesPorDia: 12,
    modeloChat: "claude-sonnet-5-5",
    maxRespuesta: 8192,
    busquedaWeb: true,
    modeloImagen: "fal-ai/flux/dev",
    descripcion: ["50 mensajes cada 24 horas", "12 imágenes cada 24 horas, en mejor calidad", "IA más capaz (Claude Sonnet) y respuestas más completas", "Búsqueda en tiendas y en internet con fuentes"],
    disponible: false
  },
  premium: {
    id: "premium",
    nombre: "ProMax",
    precio: "US$39",
    mensajesPorDia: 120,
    imagenesPorDia: 25,
    modeloChat: "claude-opus-5-5",
    maxRespuesta: 16384,
    busquedaWeb: true,
    modeloImagen: "fal-ai/flux/dev",
    descripcion: ["120 mensajes cada 24 horas", "25 imágenes cada 24 horas, en mejor calidad", "La IA más avanzada (Claude Opus)", "Búsqueda en tiendas y en internet con fuentes"],
    disponible: false
  }
};

export function planDe(id: string | null | undefined): Plan {
  return PLANES[(id as PlanId) in PLANES ? (id as PlanId) : "gratis"];
}

// Precios oficiales en US$ (por millón de tokens y por megapíxel) para estimar el gasto.
export const COSTOS = {
  chat: {
    "claude-haiku-5-5": { entrada: 0.1, salida: 0.5 },
    "claude-sonnet-5-5": { entrada: 2, salida: 10 },
    "claude-opus-5-5": { entrada: 4, salida: 20 }
  } as Record<string, { entrada: number; salida: number }>,
  busquedaWeb: 0.01,
  imagen: { "fal-ai/flux/schnell": 0.003, "fal-ai/flux/dev": 0.025 } as Record<string, number>
};

// Tope de gasto diario de toda la app (US$). Si se alcanza, la IA se pausa hasta el día siguiente.
export const TOPE_DIARIO_USD = Number(process.env.DAILY_BUDGET_USD || "5");

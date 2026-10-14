import type { Metadata } from "next";

export const metadata: Metadata = { title: "Términos y condiciones" };

export default function Page() {
  return (
    <main className="page prose">
      <h1>Términos y condiciones</h1>
      <p className="small">Borrador para revisar con un profesional antes de cobrar o abrir PaludIA al público. Última actualización: 14 de octubre de 2026.</p>

      <h2>El servicio</h2>
      <p>PaludIA es un asistente de inteligencia artificial. Sus respuestas pueden contener errores: verificá la información importante antes de usarla, sobre todo en temas de salud, dinero o asuntos legales.</p>

      <h2>Tu cuenta</h2>
      <p>Sos responsable de mantener segura tu contraseña y de la actividad de tu cuenta. Podés borrarla cuando quieras desde tu perfil.</p>

      <h2>Uso permitido</h2>
      <ul>
        <li>No uses PaludIA para actividades ilegales, para dañar a otras personas ni para hacerte pasar por alguien.</li>
        <li>No subas contenido sobre el que no tengas derechos ni imágenes de personas sin su permiso.</li>
        <li>No intentes acceder a datos de otras cuentas ni sobrecargar el servicio.</li>
      </ul>
      <p>Podemos suspender cuentas que incumplan estas reglas.</p>

      <h2>Tu contenido</h2>
      <p>Lo que escribís y subís sigue siendo tuyo. Nos das permiso para procesarlo solo para darte el servicio.</p>

      <h2>Planes pagos</h2>
      <p>Los precios, límites y condiciones de los planes pagos se publican antes de que estén disponibles. Mientras tanto, PaludIA se ofrece en su plan Gratis.</p>

      <h2>Cambios en el servicio</h2>
      <p>PaludIA puede cambiar o dejar de ofrecer funciones. Si un cambio afecta un plan pago, lo avisamos con anticipación.</p>
    </main>
  );
}

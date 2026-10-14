import type { Metadata } from "next";

export const metadata: Metadata = { title: "Política de privacidad" };

export default function Page() {
  return (
    <main className="page prose">
      <h1>Política de privacidad</h1>
      <p className="small">Borrador para revisar con un profesional antes de cobrar o abrir PaludIA al público. Última actualización: 14 de octubre de 2026.</p>

      <h2>Quién es responsable</h2>
      <p>PaludIA es un servicio operado por [nombre del responsable], desde Argentina. Para consultas sobre tus datos podés escribir a [correo de contacto].</p>

      <h2>Qué datos guardamos</h2>
      <ul>
        <li>Datos de la cuenta: correo, nombre y, si ingresás con Google, la foto de perfil que ese servicio comparte.</li>
        <li>Tu configuración: instrucciones personales, modo de respuesta y preferencia de búsqueda web.</li>
        <li>Tus conversaciones y los documentos que subas, para que puedas volver a ellos.</li>
        <li>Datos técnicos mínimos para mantener tu sesión iniciada y proteger el servicio contra abusos.</li>
      </ul>

      <h2>Para qué los usamos</h2>
      <p>Solo para darte el servicio: mostrarte tu historial, aplicar tu configuración y responder tus consultas. No vendemos tus datos ni los usamos para publicidad.</p>

      <h2>Con quién se comparten</h2>
      <ul>
        <li>Supabase: guarda la base de datos y gestiona el inicio de sesión.</li>
        <li>Vercel: aloja el sitio.</li>
        <li>Los proveedores de inteligencia artificial y de búsqueda que procesan cada consulta cuando usás esas funciones.</li>
        <li>Google, solo si elegís ingresar con tu cuenta de Google.</li>
      </ul>

      <h2>Quién puede ver tus datos</h2>
      <p>La base de datos tiene reglas que impiden que una cuenta lea los datos de otra. Tus conversaciones solo las ves vos.</p>

      <h2>Tus derechos</h2>
      <p>Podés ver y corregir tus datos desde tu perfil, y borrar tu cuenta con todos sus datos desde la sección «Borrar mi cuenta». En Argentina, la Ley 25.326 de Protección de Datos Personales te da derecho a acceder, rectificar y suprimir tus datos.</p>

      <h2>Cambios</h2>
      <p>Si cambiamos esta política, lo avisamos en el sitio antes de que el cambio tenga efecto.</p>
    </main>
  );
}

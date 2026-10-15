import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: { default: "PaludIA", template: "%s · PaludIA" },
  description: "Tu socio de ecommerce con IA: productos ganadores, tiendas, anuncios e imágenes."
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let signedIn = false;
  if (supabaseConfigured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    signedIn = Boolean(data.user);
  }
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Atkinson+Hyperlegible:wght@400;700&display=swap" />
      </head>
      <body>
        <header className="topbar">
          <Link href="/" className="brand"><span className="sun" /><span className="logo">Palud<b>IA</b></span></Link>
          <nav aria-label="Principal">
            {signedIn ? (
              <>
                <Link href="/chat">Chat</Link>
                <Link href="/planes">Planes</Link>
                <Link href="/perfil">Perfil</Link>
                <Link href="/configuracion">Configuración</Link>
                <form action="/salir" method="post"><button className="linkbtn" type="submit">Cerrar sesión</button></form>
              </>
            ) : (
              <>
                <Link href="/planes">Planes</Link>
                <Link href="/ingresar">Ingresar</Link>
                <Link href="/registro">Crear cuenta</Link>
              </>
            )}
          </nav>
        </header>
        {!supabaseConfigured && (
          <div className="page" style={{ paddingBottom: 0 }}>
            <div className="msg info">PaludIA todavía no está conectada a su base de datos. Faltan las claves de Supabase en la configuración del sitio.</div>
          </div>
        )}
        {children}
        <footer className="foot">
          <Link href="/privacidad">Privacidad</Link> · <Link href="/terminos">Términos y condiciones</Link>
        </footer>
      </body>
    </html>
  );
}

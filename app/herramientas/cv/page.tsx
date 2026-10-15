import type { Metadata } from "next";
import { CrearCV } from "./CrearCV";

export const metadata: Metadata = {
  title: "Creá tu CV optimizado para ATS",
  description: "PaludIA adapta tu CV a cada oferta y te lo da listo para descargar en PDF y Word, sin inventar datos."
};

export default function Page() {
  return <CrearCV />;
}

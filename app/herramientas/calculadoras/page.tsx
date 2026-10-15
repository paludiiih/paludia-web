import type { Metadata } from "next";
import { Calculadoras } from "./Calculadoras";

export const metadata: Metadata = {
  title: "Calculadoras de ecommerce",
  description: "Calculá precio de venta, margen y punto de equilibrio. Gratis, al instante, sin usar la IA."
};

export default function Page() {
  return <Calculadoras />;
}

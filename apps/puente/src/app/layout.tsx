import type { Metadata } from "next";
import "./globals.css";
import { FranjaSimulacion } from "@/components/franja-simulacion";

export const metadata: Metadata = {
  title: { default: "Puente · Entorno de simulación", template: "%s · Puente" },
  description: "Puente de postulaciones: traslada cada postulación del Simulador LinkedIn al Simulador BUK por API.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <a className="saltar" href="#contenido">
          Saltar al contenido
        </a>
        <FranjaSimulacion />
        {children}
      </body>
    </html>
  );
}

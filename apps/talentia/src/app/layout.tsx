import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Simulador BUK · Entorno de simulación", template: "%s · Simulador BUK" },
  description: "ATS simulado (tipo BUK) para el prototipo del puente de postulaciones.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <a className="saltar" href="#contenido">
          Saltar al contenido
        </a>
        <div className="aviso-simulacion" role="note" aria-label="Aviso de entorno">
          <strong>Entorno de simulación</strong> · No es LinkedIn ni BUK: simulación académica. Datos ficticios.
        </div>
        {children}
      </body>
    </html>
  );
}

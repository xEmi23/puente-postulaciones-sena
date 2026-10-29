import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Talentia · Entorno de simulación", template: "%s · Talentia" },
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
          <strong>Entorno de simulación</strong> · Datos ficticios. No hay conexión con LinkedIn ni con BUK.
        </div>
        {children}
      </body>
    </html>
  );
}

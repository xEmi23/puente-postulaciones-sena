import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "talent-bridge · Entorno de simulación", template: "%s · Entorno de simulación" },
  description: "Prototipo: portal de origen simulado, puente de integración y ATS simulado.",
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
          <nav aria-label="Módulos del prototipo">
            <Link href="/origen">Portal de origen</Link>
            <Link href="/puente">Panel del puente</Link>
            <Link href="/ats">ATS simulado</Link>
          </nav>
        </div>
        {children}
      </body>
    </html>
  );
}

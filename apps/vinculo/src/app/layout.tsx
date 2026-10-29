import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import "./vinculo.css";

export const metadata: Metadata = {
  title: { default: "Vínculo · Entorno de simulación", template: "%s · Vínculo" },
  description: "Red profesional simulada (tipo LinkedIn) para el prototipo del puente de postulaciones.",
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
        <div className="m-origen">
          <header className="o-cabecera">
            <div className="o-cabecera-interior">
              <Link href="/" className="o-marca">
                <span className="o-marca-logo" aria-hidden="true">
                  V
                </span>
                <span>
                  Vínculo
                  <small>Red profesional simulada</small>
                </span>
              </Link>
              <Link href="/">Vacantes</Link>
            </div>
          </header>
          <main id="contenido" className="o-contenido">
            {children}
          </main>
          <footer className="o-pie">
            Red profesional ficticia que imita el contrato de entrega de Apply Connect. No es LinkedIn ni está afiliada a LinkedIn. ·{" "}
            <Link href="/admin">Administrar el simulador</Link>
          </footer>
        </div>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import "./origen.css";

export const metadata: Metadata = { title: { default: "Vitrina Empleo", template: "%s · Vitrina Empleo" } };

export default function LayoutOrigen({ children }: { children: React.ReactNode }) {
  return (
    <div className="m-origen">
      <header className="o-cabecera">
        <div className="o-cabecera-interior">
          <Link href="/origen" className="o-marca">
            <span className="o-marca-logo" aria-hidden="true">
              VE
            </span>
            <span>
              Vitrina Empleo
              <small>Portal de empleo simulado</small>
            </span>
          </Link>
          <Link href="/origen">Vacantes</Link>
        </div>
      </header>
      <main id="contenido" className="o-contenido">
        {children}
      </main>
      <footer className="o-pie">
        Portal ficticio que imita el contrato de entrega de Apply Connect. No es LinkedIn ni está afiliado a LinkedIn. ·{" "}
        <Link href="/origen/admin">Administrar el simulador</Link>
      </footer>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import "./ats.css";

export const metadata: Metadata = { title: { default: "Selecta ATS", template: "%s · Selecta ATS" } };

export default function LayoutAts({ children }: { children: React.ReactNode }) {
  return (
    <div className="m-ats">
      <aside className="a-lateral">
        <Link href="/ats" className="a-marca">
          <span className="a-marca-logo" aria-hidden="true">
            S
          </span>
          <span>
            Selecta
            <small>ATS simulado</small>
          </span>
        </Link>
        <nav aria-label="Menú del ATS">
          <p className="a-nav-seccion">Selección</p>
          <ul className="a-nav">
            <li>
              <Link href="/ats">Procesos</Link>
            </li>
          </ul>
        </nav>
      </aside>
      <main id="contenido" className="a-principal">
        {children}
      </main>
    </div>
  );
}

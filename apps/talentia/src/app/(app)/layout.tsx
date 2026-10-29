
import Link from "next/link";
import { exigirSesion } from "@/lib/sesion-servidor";
import "../talentia.css";

export default async function LayoutTalentia({ children }: { children: React.ReactNode }) {
  await exigirSesion("/");
  return (
    <div className="m-ats">
      <aside className="a-lateral">
        <Link href="/" className="a-marca">
          <span className="a-marca-logo" aria-hidden="true">
            T
          </span>
          <span>
            Talentia
            <small>ATS simulado</small>
          </span>
        </Link>
        <nav aria-label="Menú del ATS">
          <p className="a-nav-seccion">Selección</p>
          <ul className="a-nav">
            <li>
              <Link href="/">Procesos</Link>
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

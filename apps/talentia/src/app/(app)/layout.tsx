import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { exigirUsuario } from "@/lib/sesion-servidor";
import { EnlaceMenu } from "@/components/enlace-menu";
import "../talentia.css";

async function salir() {
  "use server";
  await auth.api.signOut({ headers: await headers() });
  redirect("/ingresar");
}

export default async function LayoutTalentia({ children }: { children: React.ReactNode }) {
  const usuario = await exigirUsuario("/");
  return (
    <div className="m-ats">
      <aside className="a-lateral">
        <Link href="/seleccion/procesos" className="a-marca">
          <span className="a-marca-logo" aria-hidden="true">
            T
          </span>
          <span>
            Simulador BUK
            <small>ATS simulado · Andina Software</small>
          </span>
        </Link>
        <nav aria-label="Menú principal">
          <p className="a-nav-seccion">Desarrollo organizacional</p>
          <p className="a-nav-grupo">Selección</p>
          <ul className="a-nav">
            <li className="a-nav-sub">
              <EnlaceMenu href="/seleccion/procesos">Procesos</EnlaceMenu>
            </li>
            <li className="a-nav-sub">
              <EnlaceMenu href="/seleccion/postulantes">Postulantes</EnlaceMenu>
            </li>
            <li className="a-nav-sub">
              <EnlaceMenu href="/seleccion/plantillas">Plantillas</EnlaceMenu>
            </li>
            <li className="a-nav-sub">
              <EnlaceMenu href="/seleccion/configuraciones">Configuraciones</EnlaceMenu>
            </li>
          </ul>
          {usuario.rol === "ADMIN" && (
            <>
              <p className="a-nav-seccion">Administración</p>
              <ul className="a-nav">
                <li className="a-nav-sub">
                  <EnlaceMenu href="/admin/api-keys">API Keys</EnlaceMenu>
                </li>
                <li className="a-nav-sub">
                  <EnlaceMenu href="/admin/actividad-api">Actividad de la API</EnlaceMenu>
                </li>
              </ul>
            </>
          )}
          <ul className="a-nav">
            <li className="a-nav-sub">
              <a href="/apidocs">Documentación de la API</a>
            </li>
          </ul>
        </nav>
        <div className="a-usuario">
          <strong>{usuario.nombre}</strong>
          {usuario.rol === "ADMIN" ? "Administrador/a" : "Reclutador/a"}
          <form action={salir}>
            <button type="submit">Salir</button>
          </form>
        </div>
      </aside>
      <main id="contenido" className="a-principal">
        {children}
      </main>
    </div>
  );
}

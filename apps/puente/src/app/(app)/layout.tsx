import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { exigirUsuario } from "@/lib/sesion-servidor";
import { modoPrueba } from "@/lib/config";
import { EnlaceMenu } from "@/components/enlace-menu";
import "../puente.css";

async function salir() {
  "use server";
  await auth.api.signOut({ headers: await headers() });
  redirect("/ingresar");
}

export default async function LayoutPuente({ children }: { children: React.ReactNode }) {
  const usuario = await exigirUsuario("/operaciones");
  const prueba = modoPrueba();
  return (
    <div className="m-puente">
      <header className="p-barra">
        <div className="p-barra-interior">
          <Link href="/operaciones" className="p-marca">
            <span className="p-marca-logo" aria-hidden="true">
              P
            </span>
            Puente
          </Link>
          <nav aria-label="Menú del panel">
            <ul className="p-nav">
              <li>
                <EnlaceMenu href="/operaciones">Operaciones</EnlaceMenu>
              </li>
              <li>
                <EnlaceMenu href="/importar">Importar</EnlaceMenu>
              </li>
              <li>
                <EnlaceMenu href="/conexiones">Conexiones</EnlaceMenu>
              </li>
              {usuario.rol === "ADMIN" && (
                <li>
                  <EnlaceMenu href="/fuentes">Fuentes</EnlaceMenu>
                </li>
              )}
              <li>
                <EnlaceMenu href="/procesos">Procesos</EnlaceMenu>
              </li>
              <li>
                <EnlaceMenu href="/correspondencias">Correspondencias</EnlaceMenu>
              </li>
              <li>
                <EnlaceMenu href="/rechazos">Rechazos</EnlaceMenu>
              </li>
              <li>
                <EnlaceMenu href="/metricas">Métricas</EnlaceMenu>
              </li>
              {prueba && usuario.rol === "ADMIN" && (
                <li>
                  <EnlaceMenu href="/pruebas">Controles de prueba</EnlaceMenu>
                </li>
              )}
            </ul>
          </nav>
          <form action={salir} className="p-salir">
            <span className="p-usuario">
              {usuario.nombre} · {usuario.rol === "ADMIN" ? "Administrador/a" : "Operador/a"}
            </span>{" "}
            <button type="submit">Salir</button>
          </form>
        </div>
      </header>
      {prueba && (
        <p className="p-modo-prueba" role="note">
          Modo prueba activo: los conectores del puente pueden inyectar fallos configurados en «Controles de prueba».
        </p>
      )}
      <main id="contenido" className="p-contenido">
        {children}
      </main>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { apiHabilitada } from "@/lib/config";
import { usuarioActual } from "@/lib/sesion-servidor";
import { EnlaceMenu } from "@/components/enlace-menu";
import "./globals.css";
import "./vinculo.css";

export const metadata: Metadata = {
  title: { default: "Vínculo · Entorno de simulación", template: "%s · Vínculo" },
  description: "Red profesional simulada (tipo LinkedIn) para el prototipo del puente de postulaciones. Datos ficticios.",
  robots: { index: false, follow: false },
};

async function salir() {
  "use server";
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioActual();
  return (
    <html lang="es">
      <body>
        <a className="saltar" href="#contenido">
          Saltar al contenido
        </a>
        <div className="aviso-simulacion" role="note" aria-label="Aviso de entorno">
          <strong>Entorno de simulación</strong> · Datos ficticios. No hay conexión con LinkedIn ni con BUK.
        </div>
        <header className="v-cabecera">
          <div className="v-cabecera-interior">
            <Link href="/" className="v-logo">
              <span className="v-logo-marca" aria-hidden="true">
                v
              </span>
              Vínculo
            </Link>
            <form action="/empleos" className="v-buscar-cabecera" role="search">
              <label htmlFor="buscar-cabecera" className="visualmente-oculto">
                Buscar empleos
              </label>
              <input id="buscar-cabecera" name="q" type="search" placeholder="Buscar empleos" />
            </form>
            <nav aria-label="Menú principal">
              <ul className="v-nav">
                <li>
                  <EnlaceMenu href="/empleos">Empleos</EnlaceMenu>
                </li>
                {usuario?.rol === "CANDIDATO" && (
                  <>
                    <li>
                      <EnlaceMenu href="/mis-postulaciones">Mis postulaciones</EnlaceMenu>
                    </li>
                    <li>
                      <EnlaceMenu href="/mi-perfil">Mi perfil</EnlaceMenu>
                    </li>
                  </>
                )}
                {usuario?.rol === "RECLUTADOR" && (
                  <li>
                    <EnlaceMenu href="/reclutador">Panel de reclutador</EnlaceMenu>
                  </li>
                )}
                {apiHabilitada() && (
                  <li>
                    <EnlaceMenu href="/developers">Desarrolladores</EnlaceMenu>
                  </li>
                )}
                {usuario ? (
                  <li>
                    <form action={salir}>
                      <button type="submit" title={usuario.correo}>
                        Salir ({usuario.nombre.split(" ")[0]})
                      </button>
                    </form>
                  </li>
                ) : (
                  <>
                    <li>
                      <EnlaceMenu href="/ingresar">Ingresar</EnlaceMenu>
                    </li>
                    <li>
                      <Link href="/registro" className="v-boton">
                        Unirse
                      </Link>
                    </li>
                  </>
                )}
              </ul>
            </nav>
          </div>
        </header>
        <main id="contenido" className="v-principal">
          {children}
        </main>
        <footer className="v-pie">
          Vínculo es una red profesional ficticia para un prototipo académico. No es LinkedIn ni está afiliada a LinkedIn.
          {apiHabilitada() && (
            <>
              {" "}
              · <Link href="/developers/docs">API para integradores</Link>
            </>
          )}
        </footer>
      </body>
    </html>
  );
}

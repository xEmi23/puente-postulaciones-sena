import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { exigirSesion } from "@/lib/sesion-servidor";
import { COOKIE_SESION } from "@/lib/sesion";
import { modoPrueba } from "@/lib/config";
import "../puente.css";

async function salir() {
  "use server";
  (await cookies()).delete(COOKIE_SESION);
  redirect("/ingresar");
}

export default async function LayoutPuente({ children }: { children: React.ReactNode }) {
  await exigirSesion("/");
  const prueba = modoPrueba();
  return (
    <div className="m-puente">
      <header className="p-barra">
        <div className="p-barra-interior">
          <Link href="/" className="p-marca">
            <span className="p-marca-logo" aria-hidden="true">
              tb
            </span>
            Puente
          </Link>
          <nav aria-label="Menú del panel">
            <ul className="p-nav">
              <li>
                <Link href="/">Operaciones</Link>
              </li>
              <li>
                <Link href="/correspondencias">Correspondencias</Link>
              </li>
              <li>
                <Link href="/rechazos">Rechazos en la entrada</Link>
              </li>
              {prueba && (
                <li>
                  <Link href="/pruebas">Controles de prueba</Link>
                </li>
              )}
            </ul>
          </nav>
          <form action={salir} className="p-salir">
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

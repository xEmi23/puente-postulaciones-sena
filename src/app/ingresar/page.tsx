import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_SESION, DURACION_SESION_S, crearTokenSesion, credencialesValidas, destinoSeguro, estadoAuthDemo } from "@/lib/sesion";
import "../puente/puente.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ingresar" };

const MOTIVOS = {
  desactivada: "La autenticación de demostración está desactivada (DEMO_AUTH_ENABLED distinto de true).",
  incompleta: "Faltan DEMO_ADMIN_USER, DEMO_ADMIN_PASSWORD (mín. 12 caracteres) o SESSION_SECRET (mín. 32) en el entorno.",
  no_local: "La autenticación de demostración solo funciona cuando la aplicación se sirve desde localhost.",
} as const;

async function ingresar(formData: FormData) {
  "use server";
  const siguiente = destinoSeguro(String(formData.get("siguiente") ?? ""));
  const usuario = String(formData.get("usuario") ?? "");
  const clave = String(formData.get("clave") ?? "");
  if (!(await credencialesValidas(usuario, clave))) {
    redirect(`/ingresar?error=1&siguiente=${encodeURIComponent(siguiente)}`);
  }
  (await cookies()).set(COOKIE_SESION, await crearTokenSesion(usuario), {
    httpOnly: true,
    sameSite: "lax",
    secure: (process.env.APP_BASE_URL ?? "").startsWith("https://"),
    path: "/",
    maxAge: DURACION_SESION_S,
  });
  redirect(siguiente);
}

export default async function Ingresar({ searchParams }: { searchParams: Promise<{ siguiente?: string; error?: string }> }) {
  const { siguiente, error } = await searchParams;
  const estado = estadoAuthDemo();
  return (
    <main id="contenido" className="m-puente p-ingreso">
      <section className="p-tarjeta p-ingreso-caja" aria-labelledby="t-ingreso">
        <h1 id="t-ingreso">Ingresar al panel</h1>
        <p className="p-sub">Acceso de demostración al panel del puente y al ATS simulado.</p>
        {!estado.disponible ? (
          <div className="alerta alerta-error" role="alert">
            {MOTIVOS[estado.motivo]} El panel permanece cerrado.
          </div>
        ) : (
          <form action={ingresar}>
            {error && (
              <div className="alerta alerta-error" role="alert">
                Usuario o contraseña incorrectos.
              </div>
            )}
            <input type="hidden" name="siguiente" value={destinoSeguro(siguiente)} />
            <div className="p-campo">
              <label htmlFor="usuario">Usuario</label>
              <input id="usuario" name="usuario" autoComplete="username" required />
            </div>
            <div className="p-campo">
              <label htmlFor="clave">Contraseña</label>
              <input id="clave" name="clave" type="password" autoComplete="current-password" required />
            </div>
            <button className="p-boton" type="submit">
              Ingresar
            </button>
            <p className="p-nota">Las credenciales están en tu archivo .env (DEMO_ADMIN_USER y DEMO_ADMIN_PASSWORD).</p>
          </form>
        )}
      </section>
    </main>
  );
}

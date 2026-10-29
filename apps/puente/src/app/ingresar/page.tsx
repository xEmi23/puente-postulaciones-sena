import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { destinoSeguro, usuarioActual } from "@/lib/sesion-servidor";
import { CLAVE_DEMO, USUARIOS_DEMO } from "@/modules/demo";
import "../puente.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ingresar" };

async function ingresar(formData: FormData) {
  "use server";
  const siguiente = destinoSeguro(String(formData.get("siguiente") ?? ""));
  try {
    await auth.api.signInEmail({
      body: { email: String(formData.get("correo") ?? "").trim().toLowerCase(), password: String(formData.get("clave") ?? "") },
      headers: await headers(),
    });
  } catch {
    redirect(`/ingresar?error=1&siguiente=${encodeURIComponent(siguiente)}`);
  }
  redirect(siguiente);
}

export default async function Ingresar({ searchParams }: { searchParams: Promise<{ siguiente?: string; error?: string }> }) {
  const { siguiente, error } = await searchParams;
  if (await usuarioActual()) redirect(destinoSeguro(siguiente));
  return (
    <main id="contenido" className="m-puente p-ingreso">
      <section className="p-tarjeta p-ingreso-caja" aria-labelledby="t-ingreso">
        <p className="p-marca p-marca-oscura">
          <span className="p-marca-logo" aria-hidden="true">
            P
          </span>{" "}
          Puente de postulaciones
        </p>
        <h1 id="t-ingreso">Ingresar</h1>
        <form action={ingresar}>
          {error && (
            <div className="alerta alerta-error" role="alert">
              Correo o contraseña incorrectos.
            </div>
          )}
          <input type="hidden" name="siguiente" value={destinoSeguro(siguiente)} />
          <div className="p-campo">
            <label htmlFor="correo">Correo</label>
            <input id="correo" name="correo" type="email" autoComplete="username" required />
          </div>
          <div className="p-campo">
            <label htmlFor="clave">Contraseña</label>
            <input id="clave" name="clave" type="password" autoComplete="current-password" required />
          </div>
          <button className="p-boton" type="submit">
            Ingresar
          </button>
        </form>
        <aside className="p-demo" aria-labelledby="t-demo" data-testid="cuentas-demo">
          <h2 id="t-demo">Cuentas de demostración</h2>
          <p>Entorno de simulación con datos ficticios: estas cuentas se muestran a propósito.</p>
          <ul>
            {USUARIOS_DEMO.map((u) => (
              <li key={u.correo}>
                <strong>{u.cargo}:</strong> <code>{u.correo}</code>
              </li>
            ))}
          </ul>
          <p>
            Contraseña: <code>{CLAVE_DEMO}</code>
          </p>
        </aside>
      </section>
    </main>
  );
}

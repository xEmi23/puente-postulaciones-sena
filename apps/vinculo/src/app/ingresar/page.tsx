import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { destinoSeguro, usuarioActual } from "@/lib/sesion-servidor";
import { CLAVE_DEMO, CUENTAS_DEMO } from "@/modules/demo";

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
    <div className="v-ingreso">
      <section className="v-tarjeta" aria-labelledby="t-ingreso">
        <h1 id="t-ingreso">Ingresar a Vínculo</h1>
        <form action={ingresar}>
          {error && (
            <div className="alerta alerta-error" role="alert">
              Correo o contraseña incorrectos.
            </div>
          )}
          <input type="hidden" name="siguiente" value={destinoSeguro(siguiente)} />
          <div className="v-campo">
            <label htmlFor="correo">Correo</label>
            <input id="correo" name="correo" type="email" autoComplete="username" required />
          </div>
          <div className="v-campo">
            <label htmlFor="clave">Contraseña</label>
            <input id="clave" name="clave" type="password" autoComplete="current-password" required />
          </div>
          <button type="submit" className="v-boton">
            Ingresar
          </button>
        </form>
        <p>
          ¿No tienes cuenta? <Link href={`/registro${siguiente ? `?siguiente=${encodeURIComponent(siguiente)}` : ""}`}>Únete a Vínculo</Link>
        </p>
      </section>
      <aside className="v-demo" aria-labelledby="t-demo" data-testid="cuentas-demo">
        <h2 id="t-demo" style={{ fontSize: "1rem", margin: 0 }}>
          Cuentas de demostración
        </h2>
        <p style={{ margin: "0.25rem 0" }}>Entorno de simulación con datos ficticios: estas cuentas se muestran a propósito.</p>
        <ul>
          {CUENTAS_DEMO.map((c) => (
            <li key={c.correo}>
              <strong>{c.tipo}:</strong> <code>{c.correo}</code>
            </li>
          ))}
        </ul>
        <p style={{ margin: 0 }}>
          Contraseña: <code>{CLAVE_DEMO}</code>
        </p>
      </aside>
    </div>
  );
}

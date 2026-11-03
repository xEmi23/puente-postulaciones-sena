import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { destinoSeguro } from "@/lib/sesion-servidor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Únete al Simulador LinkedIn" };

const esquema = z.object({
  nombre: z.string().trim().min(3, "Escribe tu nombre completo.").max(80).regex(/^[\p{L}][\p{L} '.-]*\s[\p{L}][\p{L} '.-]*$/u, "Escribe nombre y apellido."),
  correo: z.string().trim().toLowerCase().pipe(z.email("Escribe un correo válido.")),
  clave: z.string().min(8, "La contraseña debe tener al menos 8 caracteres.").max(128),
});

async function registrar(formData: FormData) {
  "use server";
  const siguiente = destinoSeguro(String(formData.get("siguiente") ?? ""), "/mi-perfil");
  const r = esquema.safeParse(Object.fromEntries(formData));
  const volver = (error: string) => redirect(`/registro?${new URLSearchParams({ error, nombre: String(formData.get("nombre") ?? ""), correo: String(formData.get("correo") ?? ""), siguiente })}`);
  if (!r.success) return volver(r.error.issues[0].message);
  try {
    await auth.api.signUpEmail({ body: { name: r.data.nombre, email: r.data.correo, password: r.data.clave }, headers: await headers() });
  } catch {
    return volver("No fue posible crear la cuenta. Es posible que ese correo ya esté registrado.");
  }
  redirect(siguiente);
}

export default async function Registro({ searchParams }: { searchParams: Promise<{ error?: string; nombre?: string; correo?: string; siguiente?: string }> }) {
  const q = await searchParams;
  return (
    <div className="v-ingreso">
      <section className="v-tarjeta" aria-labelledby="t-registro">
        <h1 id="t-registro">Únete al Simulador LinkedIn</h1>
        <p className="v-subtitulo">Crea tu cuenta de candidato para postularte con «Solicitud sencilla». Usa solo datos ficticios.</p>
        {q.error && (
          <div className="alerta alerta-error" role="alert">
            {q.error}
          </div>
        )}
        <form action={registrar}>
          <input type="hidden" name="siguiente" value={q.siguiente ?? ""} />
          <div className="v-campo">
            <label htmlFor="nombre">Nombre y apellido</label>
            <input id="nombre" name="nombre" autoComplete="name" required defaultValue={q.nombre} />
          </div>
          <div className="v-campo">
            <label htmlFor="correo">Correo</label>
            <input id="correo" name="correo" type="email" autoComplete="email" required defaultValue={q.correo} />
          </div>
          <div className="v-campo">
            <label htmlFor="clave">Contraseña</label>
            <input id="clave" name="clave" type="password" autoComplete="new-password" required minLength={8} />
            <p className="v-ayuda">Mínimo 8 caracteres. Se guarda cifrada con hash.</p>
          </div>
          <p className="v-ayuda">
            Al crear la cuenta aceptas que el Simulador LinkedIn use tus datos para mostrar tu perfil y enviar tus solicitudes a las empresas que elijas (tratamiento de datos personales, Ley 1581 de 2012). Es un entorno de simulación: usa solo datos ficticios.
          </p>
          <button type="submit" className="v-boton">
            Crear cuenta
          </button>
        </form>
        <p>
          ¿Ya tienes cuenta? <Link href="/ingresar">Ingresar</Link>
        </p>
      </section>
    </div>
  );
}

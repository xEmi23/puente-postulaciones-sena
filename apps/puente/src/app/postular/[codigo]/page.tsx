import "../../puente.css";
import Link from "next/link";
import { notFound } from "next/navigation";
import { marcaDeTiempo, vacantePublica } from "@/entradas/formulario/servicio";

export const dynamic = "force-dynamic";
export const metadata = { title: "Postúlate" };

const MENSAJES: Record<string, string> = {
  limite: "Recibimos demasiados envíos desde tu conexión. Espera unos minutos y vuelve a intentarlo.",
  rapido: "El formulario se envió demasiado rápido. Revisa tus datos y vuelve a enviarlo.",
  datos: "Revisa tus datos: nombres, apellidos, un correo válido y un teléfono válido son obligatorios.",
  consentimiento: "Para postularte debes autorizar el tratamiento de tus datos (marca la casilla).",
  sin_cv: "Adjunta tu hoja de vida en PDF.",
  no_pdf: "El archivo no es un PDF válido. Adjunta tu hoja de vida en formato PDF.",
  grande: "El archivo supera el máximo de 5 MB.",
};

export default async function Postular({ params, searchParams }: { params: Promise<{ codigo: string }>; searchParams: Promise<{ error?: string }> }) {
  const { codigo } = await params;
  const { error } = await searchParams;
  const vacante = await vacantePublica(codigo);
  if (!vacante) notFound();
  const mensaje = error ? (MENSAJES[error] ?? MENSAJES.datos) : null;

  return (
    <main id="contenido" className="m-puente publico">
      <section className="p-tarjeta publico-tarjeta" aria-labelledby="t-postular">
        <p className="p-nota">Postulación a la vacante</p>
        <h1 id="t-postular" data-testid="titulo-vacante">
          {vacante.titulo}
        </h1>
        <div role="alert" aria-live="assertive">
          {mensaje && (
            <p className="alerta alerta-error" data-testid="error-formulario">
              {mensaje}
            </p>
          )}
        </div>
        <form method="post" action={`/api/postular/${codigo}`} encType="multipart/form-data">
          <input type="hidden" name="t" value={marcaDeTiempo(codigo)} />
          <div className="p-campo">
            <label htmlFor="nombres">Nombres</label>
            <input id="nombres" name="nombres" autoComplete="given-name" maxLength={120} required />
          </div>
          <div className="p-campo">
            <label htmlFor="apellidos">Apellidos</label>
            <input id="apellidos" name="apellidos" autoComplete="family-name" maxLength={120} required />
          </div>
          <div className="p-campo">
            <label htmlFor="correo">Correo</label>
            <input id="correo" name="correo" type="email" autoComplete="email" maxLength={200} required />
          </div>
          <div className="p-campo">
            <label htmlFor="telefono">Teléfono</label>
            <input id="telefono" name="telefono" type="tel" autoComplete="tel" maxLength={40} required />
          </div>
          <div className="p-campo">
            <label htmlFor="cv">Hoja de vida (PDF, máximo 5 MB)</label>
            <input id="cv" name="cv" type="file" accept="application/pdf,.pdf" required />
          </div>
          {/* Campo trampa para robots: oculto a las personas y a los lectores de pantalla. */}
          <div className="p-trampa" aria-hidden="true">
            <label htmlFor="sitio_web">Sitio web</label>
            <input id="sitio_web" name="sitio_web" tabIndex={-1} autoComplete="off" />
          </div>
          <div className="p-campo-casilla">
            <input id="autorizacion" name="autorizacion" type="checkbox" value="si" required />
            <label htmlFor="autorizacion">
              Autorizo el tratamiento de mis datos personales según el{" "}
              <Link href="/privacidad" target="_blank">
                aviso de privacidad
              </Link>
              .
            </label>
          </div>
          <button className="p-boton" type="submit">
            Enviar postulación
          </button>
        </form>
      </section>
    </main>
  );
}

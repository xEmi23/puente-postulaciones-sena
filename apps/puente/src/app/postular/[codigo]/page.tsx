import "../empleo.css";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MENSAJES_ERROR } from "@/entradas/formulario/campos";
import { marcaDeTiempo, vacantePublica } from "@/entradas/formulario/servicio";
import { FormularioPostulacion } from "./formulario";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ codigo: string }> }): Promise<Metadata> {
  const v = await vacantePublica((await params).codigo);
  return { title: v ? `${v.ficha.titulo} · Postúlate` : "Vacante no encontrada" };
}

/** Descripción en texto: párrafos separados por línea en blanco; las líneas que empiezan por «- » son viñetas. */
function Descripcion({ texto }: { texto: string }) {
  const bloques = texto.split(/\n\s*\n/).map((b) => b.split("\n").map((l) => l.trim()).filter(Boolean));
  return (
    <div className="empleo-descripcion">
      {bloques.map((lineas, i) =>
        lineas.every((l) => l.startsWith("- ")) ? (
          <ul key={i}>
            {lineas.map((l, j) => (
              <li key={j}>{l.slice(2)}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{lineas.join(" ")}</p>
        ),
      )}
    </div>
  );
}

export default async function Postular({ params, searchParams }: { params: Promise<{ codigo: string }>; searchParams: Promise<{ error?: string }> }) {
  const { codigo } = await params;
  const { error } = await searchParams;
  const vacante = await vacantePublica(codigo);
  if (!vacante) notFound();
  const { ficha } = vacante;

  return (
    <main id="contenido" className="empleo">
      <header className="empleo-cabecera">
        <div className="empleo-cabecera-interior">
          <p className="empleo-antetitulo">Vacante abierta</p>
          <h1 data-testid="titulo-vacante">{ficha.titulo}</h1>
          <ul className="empleo-datos" aria-label="Datos de la vacante" data-testid="datos-vacante">
            <li>{ficha.ciudad}</li>
            <li>{ficha.modalidad}</li>
            <li>{ficha.tipoEmpleo}</li>
          </ul>
        </div>
      </header>
      <div className="empleo-cuerpo">
        <section className="empleo-tarjeta" aria-labelledby="t-descripcion">
          <h2 id="t-descripcion">Sobre la vacante</h2>
          <Descripcion texto={ficha.descripcion} />
        </section>
        <section className="empleo-tarjeta" aria-labelledby="t-postular">
          <h2 id="t-postular">Postúlate</h2>
          <FormularioPostulacion codigo={codigo} marca={marcaDeTiempo(codigo)} errorInicial={error ? (MENSAJES_ERROR[error] ?? MENSAJES_ERROR.datos) : null} />
        </section>
        <p className="empleo-nota">
          Tus datos se usan solo para este proceso de selección. Consulta el <a href="/privacidad">aviso de privacidad</a>.
        </p>
      </div>
    </main>
  );
}

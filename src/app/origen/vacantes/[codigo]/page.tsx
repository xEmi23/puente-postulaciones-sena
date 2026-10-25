import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import { fecha } from "@/lib/fechas";
import { FormularioPostulacion } from "./formulario";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ codigo: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { codigo } = await params;
  const v = await prisma.vacante.findUnique({ where: { codigo: decodeURIComponent(codigo) } });
  return { title: v?.titulo ?? "Vacante" };
}

export default async function DetalleVacante({ params }: Props) {
  const { codigo } = await params;
  const vacante = await prisma.vacante.findUnique({ where: { codigo: decodeURIComponent(codigo) } });
  if (!vacante || vacante.estado === "BORRADOR") notFound();
  const abierta = vacante.estado === "PUBLICADA";

  return (
    <>
      <nav className="o-migas" aria-label="Ruta de navegación">
        <Link href="/origen">Vacantes</Link> / <span aria-current="page">{vacante.titulo}</span>
      </nav>
      <div className="o-detalle">
        <article className="o-panel">
          <h1 style={{ marginTop: 0, fontSize: "1.6rem" }}>{vacante.titulo}</h1>
          <ul className="o-meta" style={{ marginBottom: "1rem" }}>
            <li className="o-chip">{vacante.area}</li>
            <li className="o-chip">{vacante.ciudad}</li>
            <li className="o-chip">{vacante.modalidad}</li>
            {!abierta && <li className="o-chip o-chip-cerrada">Cerrada</li>}
          </ul>
          <p style={{ whiteSpace: "pre-line" }}>{vacante.descripcion}</p>
          <p style={{ fontSize: "0.85rem", color: "#78716c" }}>
            Código de la vacante: <code>{vacante.codigo}</code>
            {vacante.publicadaEn ? ` · Publicada el ${fecha(vacante.publicadaEn)}` : ""}
          </p>
        </article>
        <section className="o-panel" aria-labelledby="titulo-postulacion">
          <h2 id="titulo-postulacion">Postúlate</h2>
          {abierta ? (
            <FormularioPostulacion vacanteId={vacante.id} maxMb={Math.round(config().CV_MAX_BYTES / (1024 * 1024))} />
          ) : (
            <p className="vacio">Esta vacante ya no recibe postulaciones.</p>
          )}
        </section>
      </div>
    </>
  );
}

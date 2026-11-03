import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { exigirUsuario } from "@/lib/sesion-servidor";
import { fechaHora } from "@/lib/fechas";
import { ETIQUETA_ESTADO, avanzarEstado } from "@/modules/estados";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ficha del postulante" };

/**
 * Ficha de una solicitud en el panel del reclutador: datos de contacto, respuestas y CV. Abrirla la marca como «Vista
 * por la empresa» para el candidato (como la acción VIEWED del ciclo de vida). Es lo que un reclutador consulta a mano
 * y lo que lee el bot asistido del Puente (perfil «vinculo»).
 */
export default async function FichaPostulante({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await exigirUsuario(`/reclutador/postulaciones/${id}`, "RECLUTADOR");
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const p = await prisma.postulacion.findFirst({
    where: { id, vacante: { empresaId: u.empresaId ?? "" } },
    include: { vacante: true, archivoCv: { omit: { contenido: true } }, candidato: { include: { perfil: { select: { slug: true, titular: true } } } } },
  });
  if (!p) notFound();
  const estado = (await avanzarEstado(p.id, "VISTA")) ?? p.estado;

  return (
    <article data-testid="ficha-postulante" data-postulacion={p.id} data-vacante={p.vacante.externalJobId}>
      <p>
        <Link href={`/reclutador/vacantes/${p.vacanteId}`}>← {p.vacante.titulo}</Link>
      </p>
      <h1>
        <span data-campo="nombres">{p.nombre}</span> <span data-campo="apellidos">{p.apellido}</span>
      </h1>
      {p.candidato.perfil?.titular && (
        <p className="v-meta" data-campo="titular">
          {p.candidato.perfil.titular}
        </p>
      )}
      <section className="v-tarjeta" aria-labelledby="t-contacto">
        <h2 id="t-contacto">Datos de contacto</h2>
        <dl className="v-datos">
          <dt>Correo</dt>
          <dd data-campo="correo">{p.correo}</dd>
          <dt>Teléfono</dt>
          <dd data-campo="telefono">{p.telefono ?? ""}</dd>
          <dt>Ciudad</dt>
          <dd data-campo="ciudad">{p.ciudad ?? ""}</dd>
          <dt>Perfil</dt>
          <dd>{p.candidato.perfil ? <Link href={`/in/${p.candidato.perfil.slug}`} data-campo="perfil">{`/in/${p.candidato.perfil.slug}`}</Link> : "—"}</dd>
        </dl>
      </section>
      <section className="v-tarjeta" aria-labelledby="t-solicitud">
        <h2 id="t-solicitud">Solicitud</h2>
        <dl className="v-datos">
          <dt>Vacante</dt>
          <dd>
            {p.vacante.titulo} · <code data-campo="vacante">{p.vacante.externalJobId}</code>
          </dd>
          <dt>Enviada</dt>
          <dd>
            <time data-campo="enviada" dateTime={p.aplicadaEn.toISOString()}>
              {fechaHora(p.aplicadaEn)}
            </time>
          </dd>
          <dt>Referencia</dt>
          <dd>
            <code data-campo="referencia">{p.jobApplicationId}</code>
          </dd>
          <dt>Estado para la persona</dt>
          <dd>{ETIQUETA_ESTADO[estado]}</dd>
          <dt>Hoja de vida</dt>
          <dd>
            <a href={`/reclutador/postulaciones/${p.id}/cv`} download data-campo="cv" data-testid="descargar-cv-ficha">
              {p.archivoCv.nombreArchivo}
            </a>{" "}
            <span className="v-meta">({Math.round(p.archivoCv.tamano / 1024)} KB, PDF)</span>
          </dd>
        </dl>
      </section>
    </article>
  );
}

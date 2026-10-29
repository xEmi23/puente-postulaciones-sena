import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { usuarioActual } from "@/lib/sesion-servidor";
import { fecha } from "@/lib/fechas";
import { etiquetaModalidad, etiquetaNivel, etiquetaTipoEmpleo } from "@/modules/vacantes";
import { ETIQUETA_ESTADO } from "@/modules/estados";
import { Avatar } from "@/components/vacante";

export const dynamic = "force-dynamic";

async function cargar(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  return prisma.vacante.findUnique({ where: { id }, include: { empresa: true, _count: { select: { postulaciones: true } } } });
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const v = await cargar((await params).id);
  return { title: v ? `${v.titulo} · ${v.empresa.nombre}` : "Vacante" };
}

export default async function DetalleVacante({ params }: { params: Promise<{ id: string }> }) {
  const v = await cargar((await params).id);
  if (!v || v.estado === "BORRADOR") notFound();
  const usuario = await usuarioActual();
  const propia = usuario?.rol === "CANDIDATO" ? await prisma.postulacion.findUnique({ where: { vacanteId_candidatoId: { vacanteId: v.id, candidatoId: usuario.id } } }) : null;
  return (
    <div className="v-rejilla">
      <article className="v-tarjeta" aria-labelledby="t-vacante">
        <div style={{ display: "flex", gap: "0.9rem", alignItems: "flex-start" }}>
          <Avatar nombre={v.empresa.nombre} color={v.empresa.color} />
          <div>
            <p className="v-meta" style={{ margin: 0 }}>
              <Link href={`/empresas/${v.empresa.slug}`}>{v.empresa.nombre}</Link>
            </p>
            <h1 id="t-vacante" style={{ margin: "0.1rem 0" }}>
              {v.titulo}
            </h1>
            <p className="v-meta">
              {v.ciudad} · {etiquetaModalidad(v.modalidad)} · {v.publicadaEn ? `Publicada el ${fecha(v.publicadaEn)}` : ""} · {v._count.postulaciones}{" "}
              {v._count.postulaciones === 1 ? "solicitud" : "solicitudes"}
            </p>
            <div className="v-chips">
              <span className="v-chip">{etiquetaNivel(v.nivel)}</span>
              <span className="v-chip">{etiquetaTipoEmpleo(v.tipoEmpleo)}</span>
              {v.solicitudSencilla && <span className="v-chip v-chip-solicitud">Solicitud sencilla</span>}
            </div>
          </div>
        </div>
        <div style={{ margin: "1.25rem 0" }} data-testid="accion-postular">
          {v.estado === "CERRADA" ? (
            <div className="alerta alerta-error" role="status">
              Esta vacante ya no recibe postulaciones.
            </div>
          ) : propia ? (
            <p role="status">
              Ya enviaste tu solicitud el {fecha(propia.aplicadaEn)} · Estado: <strong>{ETIQUETA_ESTADO[propia.estado]}</strong> ·{" "}
              <Link href="/mis-postulaciones">Ver mis postulaciones</Link>
            </p>
          ) : v.solicitudSencilla ? (
            usuario?.rol === "RECLUTADOR" ? (
              <p className="v-ayuda">Las cuentas de reclutador no pueden postularse.</p>
            ) : (
              <Link href={`/empleos/${v.id}/solicitar`} className="v-boton">
                Solicitud sencilla
              </Link>
            )
          ) : (
            <>
              <a href={v.urlEmpresa ?? v.empresa.sitioWeb} className="v-boton v-boton-borde" rel="noopener noreferrer" target="_blank">
                Postularse en el sitio de la empresa ↗
              </a>
              <p className="v-ayuda">Esta empresa recibe las postulaciones en su propio sitio (enlace ficticio).</p>
            </>
          )}
        </div>
        <h2>Acerca del empleo</h2>
        {v.descripcion.split(/\n+/).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </article>
      <aside className="v-tarjeta" aria-labelledby="t-empresa">
        <h2 id="t-empresa">Acerca de la empresa</h2>
        <p style={{ fontWeight: 700, margin: 0 }}>{v.empresa.nombre}</p>
        <p className="v-meta">
          {v.empresa.sector} · {v.empresa.tamano}
        </p>
        <p>{v.empresa.descripcion}</p>
        <Link href={`/empresas/${v.empresa.slug}`}>Ver todas sus vacantes</Link>
      </aside>
    </div>
  );
}

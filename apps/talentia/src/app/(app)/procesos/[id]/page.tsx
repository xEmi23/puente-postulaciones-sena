import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { fecha } from "@/lib/fechas";
import { ActualizarCada } from "@/components/actualizar-cada";
import { exigirSesionAccion } from "@/lib/sesion-servidor";
import { etiquetaTipo } from "@/modules/etapas";
import { etiquetaEstadoProceso, textoVigencia, vigenciaDias } from "@/modules/procesos";

export const dynamic = "force-dynamic";

const CALIFICACION: Record<string, string> = { SIN_CALIFICAR: "Sin calificar" };

export default async function TableroProceso({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ creado?: string }> }) {
  const { id } = await params;
  const { creado } = await searchParams;
  const procesoId = Number(id);
  if (!Number.isInteger(procesoId)) notFound();
  const proceso = await prisma.proceso.findUnique({
    where: { id: procesoId },
    include: {
      etapas: {
        orderBy: { orden: "asc" },
        include: { postulaciones: { orderBy: { creadaEn: "desc" }, include: { candidato: true } } },
      },
    },
  });
  if (!proceso) notFound();
  const nuevas = proceso.etapas.flatMap((e) => e.postulaciones).filter((p) => !p.vista && !p.descartadaEn).length;

  async function marcarVistas() {
    "use server";
    await exigirSesionAccion();
    await prisma.postulacion.updateMany({ where: { procesoId, vista: false }, data: { vista: true } });
    revalidatePath(`/procesos/${procesoId}`);
  }

  async function descartar(formData: FormData) {
    "use server";
    await exigirSesionAccion();
    await prisma.postulacion.updateMany({ where: { id: String(formData.get("id")), procesoId }, data: { descartadaEn: new Date(), vista: true } });
    revalidatePath(`/procesos/${procesoId}`);
  }

  async function restaurar(formData: FormData) {
    "use server";
    await exigirSesionAccion();
    await prisma.postulacion.updateMany({ where: { id: String(formData.get("id")), procesoId }, data: { descartadaEn: null } });
    revalidatePath(`/procesos/${procesoId}`);
  }

  return (
    <>
      <ActualizarCada ms={3000} />
      <nav aria-label="Ruta de navegación" style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>
        <Link href="/">Procesos</Link> / <span aria-current="page">{proceso.nombre}</span>
      </nav>
      <div className="a-encabezado">
        <div>
          <h1>
            <span className="mono a-id-proceso">{proceso.id}</span> {proceso.nombre}
          </h1>
          <p className="a-sub">
            {proceso.area} · {proceso.ciudad}
          </p>
          <dl className="a-meta-proceso" data-testid="meta-proceso">
            <div>
              <dt>Prioridad</dt>
              <dd>
                <span className={`a-prioridad a-prioridad-${proceso.prioridad}`}>{proceso.prioridad}</span>
              </dd>
            </div>
            <div>
              <dt>Fecha de inicio</dt>
              <dd>{fecha(proceso.fechaInicio)}</dd>
            </div>
            <div>
              <dt>Vigencia</dt>
              <dd data-testid="vigencia">{textoVigencia(vigenciaDias(proceso.fechaInicio))}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>
                <span className="a-estado-proceso">{etiquetaEstadoProceso(proceso.estado)}</span>
              </dd>
            </div>
          </dl>
        </div>
      </div>
      <div role="status" aria-live="polite">
        {creado && <div className="alerta alerta-exito">Proceso {proceso.id} creado. Vincúlalo a una vacante en el panel del puente → Correspondencias.</div>}
        {nuevas > 0 && (
          <div className="a-aviso-nuevo" data-testid="aviso-nuevos">
            <span>
              {nuevas === 1 ? "1 postulante nuevo fue agregado al proceso" : `${nuevas} postulantes nuevos fueron agregados al proceso`}
            </span>
            <form action={marcarVistas}>
              <button type="submit" className="a-boton a-boton-claro">
                Entendido
              </button>
            </form>
          </div>
        )}
      </div>
      <ol className="a-tablero" aria-label="Etapas del proceso">
        {proceso.etapas.map((etapa) => {
          const activas = etapa.postulaciones.filter((p) => !p.descartadaEn);
          const descartadas = etapa.postulaciones.filter((p) => p.descartadaEn);
          return (
            <li key={etapa.id} className="a-columna" data-etapa={etapa.nombre}>
              <h2>
                <span>
                  {etapa.nombre}
                  <span className="a-tipo-etapa" data-tipo-etapa={etiquetaTipo(etapa.tipo, etapa.orden)}>
                    {etiquetaTipo(etapa.tipo, etapa.orden)}
                  </span>
                </span>
                <span className="a-contador" aria-label={`${activas.length} postulantes`}>
                  {activas.length}
                </span>
              </h2>
              {activas.length === 0 ? (
                <p className="a-columna-vacia">Sin postulantes</p>
              ) : (
                <ul className="a-tarjetas">
                  {activas.map((p) => (
                    <li key={p.id} className={`a-tarjeta${p.vista ? "" : " a-tarjeta-nueva"}`} data-testid="tarjeta-postulante">
                      <div className="a-tarjeta-cabeza">
                        {/* Casilla solo visual, como en el ATS de referencia: no hay acciones masivas. */}
                        <input type="checkbox" className="a-casilla" aria-label={`Seleccionar a ${p.candidato.nombre} ${p.candidato.apellido}`} />
                        <Link href={`/candidatos/${p.candidatoId}`}>
                          {p.candidato.nombre} {p.candidato.apellido}
                        </Link>
                      </div>
                      <div style={{ marginTop: "0.35rem" }}>
                        <span className="a-insignia">{CALIFICACION[p.calificacion] ?? p.calificacion}</span>
                        <span className="a-insignia a-insignia-fuente">{p.fuente}</span>
                      </div>
                      <p className="a-tarjeta-meta">Postulación: {fecha(p.creadaEn)}</p>
                      <form action={descartar}>
                        <input type="hidden" name="id" value={p.id} />
                        <button type="submit" className="a-boton-texto" aria-label={`Descartar a ${p.candidato.nombre} ${p.candidato.apellido}`}>
                          Descartar
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              <details className="a-descartados" data-testid="descartados">
                <summary>Descartados ({descartadas.length})</summary>
                {descartadas.length === 0 ? (
                  <p className="a-columna-vacia">Nadie descartado en esta etapa.</p>
                ) : (
                  <ul className="a-tarjetas">
                    {descartadas.map((p) => (
                      <li key={p.id} className="a-tarjeta a-tarjeta-descartada" data-testid="tarjeta-descartada">
                        <Link href={`/candidatos/${p.candidatoId}`}>
                          {p.candidato.nombre} {p.candidato.apellido}
                        </Link>
                        <form action={restaurar}>
                          <input type="hidden" name="id" value={p.id} />
                          <button type="submit" className="a-boton-texto" aria-label={`Restaurar a ${p.candidato.nombre} ${p.candidato.apellido}`}>
                            Restaurar
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            </li>
          );
        })}
      </ol>
    </>
  );
}

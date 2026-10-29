import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { fecha } from "@/lib/fechas";
import { ActualizarCada } from "@/components/actualizar-cada";
import { exigirUsuarioAccion } from "@/lib/sesion-servidor";
import { etiquetaTipo } from "@/modules/etapas";
import { etiquetaEstadoProceso, textoVigencia, vigenciaDias } from "@/modules/procesos";
import { cambiarPostulacion } from "@/modules/seleccion";

export const dynamic = "force-dynamic";

const CALIFICACION: Record<string, string> = { SIN_CALIFICAR: "Sin calificar" };
const PESTANAS_DESHABILITADAS = ["Formularios", "Pruebas", "Automatización", "Agentes", "Historial", "Postulaciones incompletas", "Analítica"];

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return { title: `Proceso ${(await params).id}` };
}

export default async function TableroProceso({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creado?: string; vista?: string; pestana?: string; error?: string }>;
}) {
  const { id } = await params;
  const { creado, vista, pestana, error } = await searchParams;
  const procesoId = Number(id);
  if (!Number.isInteger(procesoId)) notFound();
  const proceso = await prisma.proceso.findUnique({
    where: { id: procesoId },
    include: {
      etapas: {
        orderBy: { orden: "asc" },
        include: { postulaciones: { orderBy: { creadaEn: "desc" }, include: { postulante: true } } },
      },
    },
  });
  if (!proceso) notFound();
  const todas = proceso.etapas.flatMap((e) => e.postulaciones.map((p) => ({ ...p, etapa: e })));
  const nuevas = todas.filter((p) => !p.vista && !p.descartadaEn).length;
  const enTabla = vista === "tabla";
  const base = `/seleccion/procesos/${procesoId}`;

  async function marcarVistas() {
    "use server";
    await exigirUsuarioAccion();
    await prisma.postulacion.updateMany({ where: { procesoId, vista: false }, data: { vista: true } });
    revalidatePath(base);
  }

  async function cambiar(formData: FormData) {
    "use server";
    const u = await exigirUsuarioAccion();
    const postulacionId = String(formData.get("id"));
    const accion = String(formData.get("accion"));
    const cambio = accion === "descartar" ? { descartada: true } : accion === "restaurar" ? { descartada: false } : { etapa_id: String(formData.get("etapa_id")) };
    const actual = await prisma.postulacion.findUnique({ where: { id: postulacionId }, select: { procesoId: true } });
    if (actual?.procesoId !== procesoId) return;
    await cambiarPostulacion(postulacionId, cambio, u.nombre);
    revalidatePath(base);
  }

  const selectorEtapa = (p: (typeof todas)[number]) => (
    <form action={cambiar} className="a-mover">
      <input type="hidden" name="id" value={p.id} />
      <input type="hidden" name="accion" value="mover" />
      <label className="visualmente-oculto" htmlFor={`mover-${p.id}`}>
        Mover a {p.postulante.nombre} {p.postulante.apellido} a la etapa
      </label>
      <select id={`mover-${p.id}`} name="etapa_id" defaultValue={p.etapaId}>
        {proceso.etapas.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nombre}
          </option>
        ))}
      </select>
      <button type="submit">Mover</button>
    </form>
  );

  return (
    <>
      <ActualizarCada ms={3000} />
      <p className="a-migas">
        <Link href="/seleccion/procesos">Procesos</Link> / <span aria-current="page">{proceso.titulo}</span>
      </p>
      <div className="a-encabezado">
        <div>
          <h1>
            <span className="mono a-id-proceso">{proceso.id}</span> {proceso.titulo}
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
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button type="button" className="a-boton a-boton-claro" aria-disabled="true" title="Próximamente">
            Acciones ▾
          </button>
          <button type="button" className="a-boton" aria-disabled="true" title="Próximamente: las postulaciones llegan desde Vínculo por el puente">
            Nueva postulación ▾
          </button>
        </div>
      </div>

      <nav aria-label="Secciones del proceso">
        <ul className="a-pestanas">
          <li>
            <Link href={`${base}?pestana=info`} aria-current={pestana === "info" ? "page" : undefined}>
              Información general
            </Link>
          </li>
          <li>
            <Link href={base} aria-current={pestana !== "info" ? "page" : undefined}>
              Proceso
            </Link>
          </li>
          {PESTANAS_DESHABILITADAS.map((p) => (
            <li key={p}>
              <span aria-disabled="true" title="Próximamente">
                {p}
              </span>
            </li>
          ))}
        </ul>
      </nav>

      <div role="status" aria-live="polite">
        {creado && <div className="alerta alerta-exito">Proceso {proceso.id} creado. Publícalo en Vínculo desde el puente (Procesos → «Publicar en Vínculo»).</div>}
        {error && <div className="alerta alerta-error">{error}</div>}
        {nuevas > 0 && (
          <div className="a-aviso-nuevo" data-testid="aviso-nuevos">
            <span>{nuevas === 1 ? "1 postulante nuevo fue agregado al proceso" : `${nuevas} postulantes nuevos fueron agregados al proceso`}</span>
            <form action={marcarVistas}>
              <button type="submit" className="a-boton a-boton-claro">
                Entendido
              </button>
            </form>
          </div>
        )}
      </div>

      {pestana === "info" ? (
        <section className="a-ficha" aria-labelledby="t-info">
          <h2 id="t-info">Información general</h2>
          <dl className="a-datos">
            <dt>Número</dt>
            <dd className="mono">{proceso.id}</dd>
            <dt>Título</dt>
            <dd>{proceso.titulo}</dd>
            <dt>Área</dt>
            <dd>{proceso.area}</dd>
            <dt>Ciudad</dt>
            <dd>{proceso.ciudad}</dd>
            <dt>Descripción</dt>
            <dd>{proceso.descripcion || "Sin descripción."}</dd>
            <dt>Postulaciones</dt>
            <dd>{todas.length}</dd>
          </dl>
        </section>
      ) : (
        <>
          <div className="a-barra-herramientas">
            <div className="a-segmentado" role="group" aria-label="Vista del proceso">
              <Link href={base} aria-current={!enTabla ? "page" : undefined}>
                Vista columna
              </Link>
              <Link href={`${base}?vista=tabla`} aria-current={enTabla ? "page" : undefined}>
                Vista tabla
              </Link>
            </div>
            <p className="a-sub">{todas.filter((p) => !p.descartadaEn).length} postulantes activos</p>
          </div>

          {enTabla ? (
            todas.length === 0 ? (
              <p className="vacio">Este proceso aún no tiene postulantes.</p>
            ) : (
              <div className="a-tabla-contenedor">
                <table className="a-tabla" data-testid="vista-tabla">
                  <caption className="visualmente-oculto">Postulantes del proceso</caption>
                  <thead>
                    <tr>
                      <th scope="col">Postulante</th>
                      <th scope="col">Etapa</th>
                      <th scope="col">Calificación</th>
                      <th scope="col">Fuente</th>
                      <th scope="col">Fecha</th>
                      <th scope="col">Mover</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todas.map((p) => (
                      <tr key={p.id} data-testid="fila-postulacion">
                        <td>
                          <Link href={`/seleccion/postulantes/${p.postulanteId}`}>
                            {p.postulante.nombre} {p.postulante.apellido}
                          </Link>
                          {p.descartadaEn && <span className="a-etiqueta a-etiqueta-roja"> Descartado</span>}
                        </td>
                        <td>{p.etapa.nombre}</td>
                        <td>{CALIFICACION[p.calificacion] ?? p.calificacion}</td>
                        <td>{p.fuente}</td>
                        <td>{fecha(p.creadaEn)}</td>
                        <td>{selectorEtapa(p)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <ol className="a-tablero" aria-label="Etapas del proceso">
              {proceso.etapas.map((etapa) => {
                const activas = todas.filter((p) => p.etapaId === etapa.id && !p.descartadaEn);
                const descartadas = todas.filter((p) => p.etapaId === etapa.id && p.descartadaEn);
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
                              <input type="checkbox" className="a-casilla" aria-label={`Seleccionar a ${p.postulante.nombre} ${p.postulante.apellido}`} />
                              <Link href={`/seleccion/postulantes/${p.postulanteId}`}>
                                {p.postulante.nombre} {p.postulante.apellido}
                              </Link>
                            </div>
                            <div style={{ marginTop: "0.35rem" }}>
                              <span className="a-insignia">{CALIFICACION[p.calificacion] ?? p.calificacion}</span>
                              <span className="a-insignia a-insignia-fuente">{p.fuente}</span>
                            </div>
                            <p className="a-tarjeta-meta">Postulación: {fecha(p.creadaEn)}</p>
                            {selectorEtapa(p)}
                            <form action={cambiar}>
                              <input type="hidden" name="id" value={p.id} />
                              <input type="hidden" name="accion" value="descartar" />
                              <button type="submit" className="a-boton-texto" aria-label={`Descartar a ${p.postulante.nombre} ${p.postulante.apellido}`}>
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
                              <Link href={`/seleccion/postulantes/${p.postulanteId}`}>
                                {p.postulante.nombre} {p.postulante.apellido}
                              </Link>
                              <form action={cambiar}>
                                <input type="hidden" name="id" value={p.id} />
                                <input type="hidden" name="accion" value="restaurar" />
                                <button type="submit" className="a-boton-texto" aria-label={`Restaurar a ${p.postulante.nombre} ${p.postulante.apellido}`}>
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
          )}
        </>
      )}
    </>
  );
}

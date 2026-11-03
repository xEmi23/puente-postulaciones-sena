import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { apiHabilitada } from "@/lib/config";
import { exigirUsuario, exigirUsuarioAccion } from "@/lib/sesion-servidor";
import { fechaHora } from "@/lib/fechas";
import { cambiarEstadoVacante, editarVacante, type ErroresVacante } from "@/modules/vacantes";
import { ETIQUETA_ESTADO, avanzarEstado } from "@/modules/estados";
import { CamposVacante } from "../../formulario-vacante";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vacante" };

export default async function VacanteReclutador({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const q = await searchParams;
  const u = await exigirUsuario(`/reclutador/vacantes/${id}`, "RECLUTADOR");
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const v = await prisma.vacante.findFirst({
    where: { id, empresaId: u.empresaId ?? "" },
    include: { aplicacion: true, postulaciones: { orderBy: { aplicadaEn: "desc" }, include: { archivoCv: { omit: { contenido: true } }, candidato: { include: { perfil: { select: { slug: true } } } } } } },
  });
  if (!v) notFound();
  // Con la API apagada (D-68) ninguna vacante se presenta como conectada a un ATS, aunque lo haya estado antes.
  const conectada = apiHabilitada() && !!v.aplicacion;
  const base = `/reclutador/vacantes/${id}`;
  const deApi = !v.externalJobId.startsWith("VIN-");

  async function guardar(formData: FormData) {
    "use server";
    const usuario = await exigirUsuarioAccion("RECLUTADOR");
    const valores = Object.fromEntries(formData) as Record<string, string>;
    const r = await editarVacante(usuario.empresaId ?? "", id, valores);
    if (!r.ok) redirect(`${base}?${new URLSearchParams({ errores: JSON.stringify(r.errores) })}`);
    redirect(`${base}?mensaje=${encodeURIComponent("Cambios guardados.")}`);
  }

  async function estado(formData: FormData) {
    "use server";
    const usuario = await exigirUsuarioAccion("RECLUTADOR");
    const nuevo = formData.get("estado") === "CERRADA" ? "CERRADA" : "PUBLICADA";
    await cambiarEstadoVacante(usuario.empresaId ?? "", id, nuevo);
    redirect(`${base}?mensaje=${encodeURIComponent(nuevo === "CERRADA" ? "Vacante cerrada: ya no recibe postulaciones." : "Vacante publicada.")}`);
  }

  async function marcar(formData: FormData) {
    "use server";
    const usuario = await exigirUsuarioAccion("RECLUTADOR");
    const pid = String(formData.get("id"));
    const p = await prisma.postulacion.findFirst({ where: { id: pid, vacante: { empresaId: usuario.empresaId ?? "" } } });
    if (p) await avanzarEstado(p.id, formData.get("accion") === "rechazar" ? "NO_SELECCIONADO" : "VISTA");
    redirect(base);
  }

  let errores: ErroresVacante = {};
  try {
    errores = q.errores ? JSON.parse(q.errores) : {};
  } catch {
    errores = {};
  }
  const aplicaciones = await prisma.aplicacionDev.findMany({
    where: { revocadaEn: null, autorizaciones: { some: { empresaId: u.empresaId ?? "", revocadaEn: null } } },
    select: { id: true, nombre: true },
  });

  return (
    <>
      <p>
        <Link href="/reclutador">← Vacantes</Link>
      </p>
      <div className="v-linea">
        <h1 style={{ margin: 0 }}>{v.titulo}</h1>
        <form action={estado}>
          <input type="hidden" name="estado" value={v.estado === "PUBLICADA" ? "CERRADA" : "PUBLICADA"} />
          <button type="submit" className={`v-boton ${v.estado === "PUBLICADA" ? "v-boton-peligro" : ""}`}>
            {v.estado === "PUBLICADA" ? "Cerrar vacante" : "Publicar vacante"}
          </button>
        </form>
      </div>
      <p className="v-meta">
        Código <code>{v.externalJobId}</code> · {v.estado === "PUBLICADA" ? "Publicada" : v.estado === "CERRADA" ? "Cerrada" : "Borrador"} ·{" "}
        {v.solicitudSencilla ? (conectada ? `Solicitud sencilla, entregada a «${v.aplicacion!.nombre}»` : "Solicitud sencilla en el Simulador LinkedIn") : "Postulación en el sitio de la empresa"}
        {v.estado !== "BORRADOR" && (
          <>
            {" "}
            · <Link href={`/empleos/${v.id}`}>Ver como candidato</Link>
          </>
        )}
      </p>
      {q.mensaje && (
        <div className="alerta alerta-exito" role="status">
          {q.mensaje}
        </div>
      )}
      {v.motivoSinSolicitud && <div className="v-aviso-admin">{v.motivoSinSolicitud}</div>}

      <section className="v-tarjeta" aria-labelledby="t-postulantes">
        <h2 id="t-postulantes">Postulantes ({v.postulaciones.length})</h2>
        {conectada && (
          <p className="v-ayuda">Estas solicitudes también se entregan automáticamente al ATS conectado. No necesitas descargarlas.</p>
        )}
        {v.postulaciones.length === 0 ? (
          <p className="vacio">Aún no hay solicitudes.</p>
        ) : (
          <div className="v-tabla-contenedor">
            <table className="v-tabla">
              <caption className="visualmente-oculto">Postulantes de la vacante</caption>
              <thead>
                <tr>
                  <th scope="col">Persona</th>
                  <th scope="col">Contacto</th>
                  <th scope="col">Fecha</th>
                  <th scope="col">Estado para la persona</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {v.postulaciones.map((p) => (
                  <tr key={p.id} data-testid="fila-postulante" data-postulacion={p.id}>
                    <td>
                      {p.candidato.perfil ? <Link href={`/in/${p.candidato.perfil.slug}`}>{`${p.nombre} ${p.apellido}`}</Link> : `${p.nombre} ${p.apellido}`}
                      <div className="v-meta">{p.ciudad}</div>
                      <Link href={`/reclutador/postulaciones/${p.id}`} className="v-meta" data-testid="enlace-ficha">
                        Ver ficha
                      </Link>
                    </td>
                    <td>
                      {p.correo}
                      {p.telefono && <div className="v-meta">{p.telefono}</div>}
                    </td>
                    <td>{fechaHora(p.aplicadaEn)}</td>
                    <td>{ETIQUETA_ESTADO[p.estado]}</td>
                    <td>
                      <a href={`/reclutador/postulaciones/${p.id}/cv`} download data-testid="descargar-cv-manual">
                        Descargar CV
                      </a>
                      <form action={marcar} style={{ display: "inline-flex", gap: "0.5rem", marginLeft: "0.5rem" }}>
                        <input type="hidden" name="id" value={p.id} />
                        {p.estado === "ENVIADA" && (
                          <button type="submit" name="accion" value="vista" className="v-enlace-boton">
                            Marcar como vista
                          </button>
                        )}
                        {p.estado !== "NO_SELECCIONADO" && (
                          <button type="submit" name="accion" value="rechazar" className="v-enlace-boton">
                            No seleccionar
                          </button>
                        )}
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <form action={guardar} className="v-tarjeta" aria-labelledby="t-editar">
        <h2 id="t-editar">Editar vacante</h2>
        {deApi && <p className="v-ayuda">Esta vacante la publicó un ATS por API: su recepción la controla el ATS.</p>}
        <CamposVacante
          valores={{ titulo: v.titulo, descripcion: v.descripcion, ciudad: v.ciudad, modalidad: v.modalidad, nivel: v.nivel, tipoEmpleo: v.tipoEmpleo, recepcion: v.solicitudSencilla ? "VINCULO" : "SITIO_EMPRESA", aplicacionId: v.aplicacionId ?? "", urlEmpresa: v.urlEmpresa ?? "" }}
          errores={errores}
          aplicaciones={apiHabilitada() ? aplicaciones : null}
          mostrarRecepcion={!deApi}
        />
        <button type="submit" className="v-boton">
          Guardar cambios
        </button>
      </form>
    </>
  );
}

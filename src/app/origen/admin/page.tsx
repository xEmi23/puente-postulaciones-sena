import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { fechaHora } from "@/lib/fechas";
import { referenciaCorta } from "@/lib/privacidad";
import { exigirSesionAccion } from "@/lib/sesion-servidor";
import { reenviarEvento } from "@/modules/origen/despachador";
import { cerrarVacante, reabrirVacante } from "@/modules/origen/vacantes";
import { ActualizarCada } from "@/components/actualizar-cada";

export const dynamic = "force-dynamic";
export const metadata = { title: "Administración del simulador" };

const ESTADO_VACANTE = { BORRADOR: "Borrador", PUBLICADA: "Publicada", CERRADA: "Cerrada" } as const;
const ESTADO_ENTREGA = { PENDIENTE: "Pendiente", ENVIADO: "Entregada", FALLIDO: "No entregada" } as const;

function estadoDeEvento(payload: string): string {
  try {
    return (JSON.parse(payload) as { estado?: string }).estado === "CERRADA" ? "cerrada" : "publicada";
  } catch {
    return "—";
  }
}

async function reenviar(formData: FormData) {
  "use server";
  await exigirSesionAccion();
  const id = String(formData.get("id"));
  const r = await reenviarEvento(id);
  let detalle = r.error ?? `HTTP ${r.httpStatus}`;
  try {
    const json = JSON.parse(r.respuesta) as { estado?: string; errors?: { errorCode: string }[] };
    detalle += json.estado ? ` · ${json.estado}` : json.errors ? ` · ${json.errors[0].errorCode}` : "";
  } catch {
    /* cuerpo no JSON */
  }
  redirect(`/origen/admin?mensaje=${encodeURIComponent(`Evento reenviado al puente: ${detalle}`)}`);
}

async function alternarVacante(formData: FormData) {
  "use server";
  await exigirSesionAccion();
  const codigo = String(formData.get("codigo"));
  if (formData.get("accion") === "cerrar") await cerrarVacante(codigo);
  else await reabrirVacante(codigo);
  redirect(`/origen/admin?mensaje=${encodeURIComponent(formData.get("accion") === "cerrar" ? `Vacante ${codigo} cerrada.` : `Vacante ${codigo} publicada de nuevo.`)}`);
}

export default async function AdminOrigen({ searchParams }: { searchParams: Promise<{ mensaje?: string }> }) {
  const { mensaje } = await searchParams;
  const [vacantes, entregas] = await Promise.all([
    prisma.vacante.findMany({ orderBy: { codigo: "asc" }, include: { _count: { select: { postulaciones: true } } } }),
    prisma.outboxOrigen.findMany({ orderBy: { creadoEn: "desc" }, take: 50, include: { postulacion: { include: { vacante: true } } } }),
  ]);
  const hayPendientes = entregas.some((e) => e.estado === "PENDIENTE");

  return (
    <>
      {hayPendientes && <ActualizarCada ms={2000} />}
      <h1 style={{ marginTop: 0 }}>Vacantes y entregas</h1>
      <div role="status" aria-live="polite">
        {mensaje && <div className="alerta alerta-exito">{mensaje}</div>}
      </div>

      <section className="o-panel" aria-labelledby="t-vacantes" style={{ marginBottom: "1.5rem" }}>
        <h2 id="t-vacantes">Vacantes</h2>
        <div className="o-tabla-contenedor">
          <table className="o-tabla">
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Título</th>
                <th scope="col">Estado</th>
                <th scope="col">Postulaciones</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {vacantes.map((v) => (
                <tr key={v.id} data-testid="fila-vacante" data-codigo={v.codigo}>
                  <td className="mono">{v.codigo}</td>
                  <td>{v.titulo}</td>
                  <td>{ESTADO_VACANTE[v.estado]}</td>
                  <td>{v._count.postulaciones}</td>
                  <td className="o-acciones">
                    <Link href={`/origen/admin/vacantes/${v.codigo}`}>Editar</Link>
                    <form action={alternarVacante}>
                      <input type="hidden" name="codigo" value={v.codigo} />
                      <input type="hidden" name="accion" value={v.estado === "PUBLICADA" ? "cerrar" : "reabrir"} />
                      <button type="submit" className="o-boton-enlace">
                        {v.estado === "PUBLICADA" ? "Cerrar" : "Publicar"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="o-panel" aria-labelledby="t-entregas">
        <h2 id="t-entregas">Entregas al puente (outbox)</h2>
        {entregas.length === 0 ? (
          <p className="vacio">Aún no hay postulaciones.</p>
        ) : (
          <div className="o-tabla-contenedor">
            <table className="o-tabla">
              <thead>
                <tr>
                  <th scope="col">Evento</th>
                  <th scope="col">Vacante</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Intentos</th>
                  <th scope="col">Último error</th>
                  <th scope="col">Creada</th>
                  <th scope="col">Acción</th>
                </tr>
              </thead>
              <tbody>
                {entregas.map((e) => (
                  <tr key={e.id} data-testid="fila-entrega" data-job-application-id={e.postulacion?.jobApplicationId ?? ""} data-tipo={e.tipo}>
                    <td className="mono">
                      {e.postulacion ? referenciaCorta(e.postulacion.jobApplicationId) : `Estado de vacante: ${estadoDeEvento(e.payload)}`}
                    </td>
                    <td className="mono">{e.postulacion?.vacante.codigo ?? e.vacanteCodigo}</td>
                    <td>{ESTADO_ENTREGA[e.estado]}</td>
                    <td>{e.intentos}</td>
                    <td>{e.ultimoError ?? "—"}</td>
                    <td>{fechaHora(e.creadoEn)}</td>
                    <td>
                      {e.estado !== "PENDIENTE" && (
                        <form action={reenviar}>
                          <input type="hidden" name="id" value={e.id} />
                          <button type="submit" className="o-boton-enlace">
                            Reenviar evento
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { fechaHora } from "@/lib/fechas";
import { exigirUsuario, exigirUsuarioAccion } from "@/lib/sesion-servidor";
import { conectorATS } from "@/salidas";
import type { ProcesoATS } from "@/salidas/conector-ats";
import { cerrarPublicacion, publicarProceso, sondearProcesosNuevos } from "@/modules/publicacion";
import { ActualizarCada } from "@/components/actualizar-cada";

export const dynamic = "force-dynamic";
export const metadata = { title: "Procesos" };

const volver = (p: Record<string, string>) => redirect(`/procesos?${new URLSearchParams(p)}`);

async function publicar(formData: FormData) {
  "use server";
  await exigirUsuarioAccion("ADMIN");
  const r = await publicarProceso(Number(formData.get("procesoId")));
  volver(r.ok ? { ok: r.mensaje } : { error: r.mensaje });
}

async function cerrar(formData: FormData) {
  "use server";
  await exigirUsuarioAccion("ADMIN");
  const r = await cerrarPublicacion(Number(formData.get("procesoId")));
  volver(r.ok ? { ok: r.mensaje } : { error: r.mensaje });
}

async function automatica(formData: FormData) {
  "use server";
  await exigirUsuarioAccion("ADMIN");
  const activar = formData.get("activar") === "1";
  await prisma.configuracion.upsert({ where: { id: 1 }, create: { id: 1, publicacionAutomatica: activar }, update: { publicacionAutomatica: activar } });
  if (activar) await sondearProcesosNuevos({ forzar: true });
  revalidatePath("/procesos");
  volver({ ok: activar ? "Publicación automática activada: cada 2 minutos se publican los procesos «Iniciados» nuevos." : "Publicación automática desactivada." });
}

const ESTADO_PUB: Record<string, string> = { PUBLICADA: "Publicada", CERRADA: "Cerrada", ERROR: "Error" };

export default async function Procesos({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const u = await exigirUsuario("/procesos");
  const { ok, error } = await searchParams;
  let procesos: ProcesoATS[] | null = null;
  let errorTalentia = "";
  try {
    procesos = await conectorATS().listarProcesos();
  } catch (e) {
    errorTalentia = e instanceof Error ? e.message : String(e);
  }
  const [publicaciones, cfg] = await Promise.all([prisma.publicacion.findMany(), prisma.configuracion.findUnique({ where: { id: 1 } })]);
  const pub = new Map(publicaciones.map((p) => [p.procesoId, p]));
  const admin = u.rol === "ADMIN";

  return (
    <>
      <ActualizarCada ms={10000} />
      <h1>Procesos de Talentia</h1>
      <p className="p-sub">
        Leídos por la API de Talentia. «Publicar en Vínculo» crea la vacante con «Solicitud sencilla» y el webhook del puente: cada solicitud llega sola a «Postulantes» del proceso.
      </p>
      <div role="status" aria-live="polite">
        {ok && <div className="alerta alerta-exito">{ok}</div>}
        {error && <div className="alerta alerta-error">{error}</div>}
      </div>

      <section className="p-tarjeta" aria-labelledby="t-auto">
        <h2 id="t-auto">Publicación automática</h2>
        <p>
          Estado: <strong data-testid="publicacion-automatica">{cfg?.publicacionAutomatica ? "Activada" : "Desactivada"}</strong>
          {cfg?.ultimoSondeoEn && ` · última revisión ${fechaHora(cfg.ultimoSondeoEn)}: ${cfg.resultadoSondeo ?? ""}`}
        </p>
        {admin && (
          <form action={automatica}>
            <input type="hidden" name="activar" value={cfg?.publicacionAutomatica ? "0" : "1"} />
            <button type="submit" className="p-boton p-boton-secundario">
              {cfg?.publicacionAutomatica ? "Desactivar" : "Activar publicación automática"}
            </button>
          </form>
        )}
      </section>

      <section className="p-tarjeta" aria-labelledby="t-procesos">
        <h2 id="t-procesos">Procesos</h2>
        {!procesos ? (
          <p className="alerta alerta-error">No se pudo consultar Talentia: {errorTalentia}</p>
        ) : procesos.length === 0 ? (
          <p className="vacio">Talentia no tiene procesos.</p>
        ) : (
          <div className="p-tabla-contenedor">
            <table className="p-tabla">
              <caption className="visualmente-oculto">Procesos de Talentia y su publicación en Vínculo</caption>
              <thead>
                <tr>
                  <th scope="col">Proceso</th>
                  <th scope="col">Estado en Talentia</th>
                  <th scope="col">Publicación en Vínculo</th>
                  <th scope="col">Acción</th>
                </tr>
              </thead>
              <tbody>
                {procesos.map((p) => {
                  const pb = pub.get(Number(p.id));
                  return (
                    <tr key={p.id} data-testid="fila-proceso" data-proceso={p.id}>
                      <td>
                        <span className="mono">{p.id}</span> · {p.titulo}
                        <div className="p-nota">
                          {p.area} · {p.ciudad} · {p.totalPostulaciones ?? 0} {p.totalPostulaciones === 1 ? "postulación" : "postulaciones"}
                        </div>
                      </td>
                      <td>{p.estado === "INICIADO" ? "Iniciado" : "Cerrado"}</td>
                      <td data-testid="estado-publicacion">
                        {pb ? (
                          <>
                            {ESTADO_PUB[pb.estado]}
                            {pb.estado === "PUBLICADA" && (pb.solicitudSencilla ? " · Solicitud sencilla" : " · sin Solicitud sencilla")}
                            {pb.automatica && " · automática"}
                            {pb.url && pb.estado !== "ERROR" && (
                              <div>
                                <a href={pb.url} target="_blank" rel="noopener noreferrer">
                                  Ver en Vínculo ↗
                                </a>
                              </div>
                            )}
                            {pb.motivo && <div className="p-nota">{pb.motivo}</div>}
                          </>
                        ) : (
                          "No publicada"
                        )}
                      </td>
                      <td>
                        {admin && p.estado === "INICIADO" && (
                          <form action={pb?.estado === "PUBLICADA" ? cerrar : publicar}>
                            <input type="hidden" name="procesoId" value={p.id} />
                            <button type="submit" className={pb?.estado === "PUBLICADA" ? "p-boton p-boton-secundario" : "p-boton"}>
                              {pb?.estado === "PUBLICADA" ? "Cerrar en Vínculo" : pb ? "Publicar de nuevo" : "Publicar en Vínculo"}
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

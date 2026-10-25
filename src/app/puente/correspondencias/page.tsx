import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fechaHora } from "@/lib/fechas";
import { exigirSesionAccion } from "@/lib/sesion-servidor";
import { listarProcesos } from "@/modules/puente/ats-cliente";

export const dynamic = "force-dynamic";
export const metadata = { title: "Correspondencias" };

const esquema = z.object({
  externalJobId: z.string().trim().min(1, "Indica el código de la vacante.").max(200),
  procesoAtsId: z.coerce.number().int().positive("Elige un proceso del ATS."),
});

async function guardar(formData: FormData) {
  "use server";
  await exigirSesionAccion();
  const r = esquema.safeParse({ externalJobId: formData.get("externalJobId"), procesoAtsId: formData.get("procesoAtsId") });
  if (!r.success) redirect(`/puente/correspondencias?error=${encodeURIComponent(r.error.issues[0].message)}`);
  const { externalJobId, procesoAtsId } = r.data;
  // El proceso se valida contra el ATS por HTTP: el puente no lee las tablas del ATS.
  const procesos = await listarProcesos().catch(() => null);
  if (!procesos) redirect(`/puente/correspondencias?error=${encodeURIComponent("No se pudo consultar el ATS para validar el proceso.")}`);
  if (!procesos.some((p) => p.id === procesoAtsId)) redirect(`/puente/correspondencias?error=${encodeURIComponent(`El proceso ${procesoAtsId} no existe en el ATS.`)}`);
  await prisma.correspondencia.upsert({
    where: { externalJobId },
    create: { externalJobId, procesoAtsId, descripcion: `${externalJobId} → proceso ${procesoAtsId}` },
    update: { procesoAtsId, activa: true, motivoCierre: null, cerradaEn: null, descripcion: `${externalJobId} → proceso ${procesoAtsId}` },
  });
  redirect(`/puente/correspondencias?ok=${encodeURIComponent(`Vacante ${externalJobId} vinculada al proceso ${procesoAtsId}.`)}`);
}

async function alternar(formData: FormData) {
  "use server";
  await exigirSesionAccion();
  const id = String(formData.get("id"));
  const c = await prisma.correspondencia.findUnique({ where: { id } });
  if (!c) redirect("/puente/correspondencias");
  await prisma.correspondencia.update({
    where: { id },
    data: c.activa ? { activa: false, motivoCierre: "MANUAL", cerradaEn: null } : { activa: true, motivoCierre: null, cerradaEn: null },
  });
  redirect(`/puente/correspondencias?ok=${encodeURIComponent(c.activa ? `Vacante ${c.externalJobId} desvinculada: nuevas postulaciones recibirán JOB_POSTING_CLOSED.` : `Vacante ${c.externalJobId} vinculada de nuevo.`)}`);
}

export default async function Correspondencias({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const [lista, procesos] = await Promise.all([
    prisma.correspondencia.findMany({ orderBy: { externalJobId: "asc" } }),
    listarProcesos().catch(() => null),
  ]);
  const nombre = new Map((procesos ?? []).map((p) => [p.id, p.nombre]));

  return (
    <>
      <h1>Correspondencias de vacantes</h1>
      <p className="p-sub">
        Qué vacante del origen (externalJobId) corresponde a qué proceso del ATS. Sin correspondencia activa, el puente responde
        JOB_POSTING_CLOSED y no adivina el proceso.
      </p>
      <div role="status" aria-live="polite">
        {ok && <div className="alerta alerta-exito">{ok}</div>}
        {error && <div className="alerta alerta-error">{error}</div>}
      </div>

      <section className="p-tarjeta" aria-labelledby="t-vincular">
        <h2 id="t-vincular">Vincular una vacante</h2>
        {!procesos ? (
          <p className="alerta alerta-error">No se pudo consultar la lista de procesos del ATS. Verifica que el ATS esté disponible.</p>
        ) : (
          <form action={guardar} className="p-form-linea">
            <div className="p-campo">
              <label htmlFor="externalJobId">Código de la vacante en el origen</label>
              <input id="externalJobId" name="externalJobId" placeholder="RT-2026-103" required />
            </div>
            <div className="p-campo">
              <label htmlFor="procesoAtsId">Proceso del ATS</label>
              <select id="procesoAtsId" name="procesoAtsId" required defaultValue="">
                <option value="" disabled>
                  Elige un proceso…
                </option>
                {procesos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} · {p.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="p-campo">
              <button className="p-boton" type="submit">
                Guardar
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="p-tarjeta" aria-labelledby="t-lista">
        <h2 id="t-lista">Correspondencias</h2>
        {lista.length === 0 ? (
          <p className="vacio">No hay correspondencias. Vincula una vacante para empezar a recibir postulaciones.</p>
        ) : (
          <div className="p-tabla-contenedor">
            <table className="p-tabla">
              <thead>
                <tr>
                  <th scope="col">Vacante</th>
                  <th scope="col">Proceso ATS</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Actualizada</th>
                  <th scope="col">Acción</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((c) => (
                  <tr key={c.id} data-testid="fila-correspondencia">
                    <td className="mono">{c.externalJobId}</td>
                    <td>
                      {c.procesoAtsId} · {nombre.get(c.procesoAtsId) ?? "proceso no encontrado en el ATS"}
                    </td>
                    <td>
                      <span className={`p-estado ${c.activa ? "p-estado-COMPLETADO" : "p-estado-RECHAZADO"}`}>
                        {c.activa ? "Activa" : c.motivoCierre === "ORIGEN" ? "Cerrada en el origen" : "Desvinculada"}
                      </span>
                      {c.cerradaEn && <small style={{ display: "block" }}>desde {fechaHora(c.cerradaEn)}</small>}
                    </td>
                    <td>{fechaHora(c.actualizadaEn)}</td>
                    <td>
                      <form action={alternar}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="p-boton p-boton-secundario" type="submit">
                          {c.activa ? "Desvincular" : "Activar"}
                        </button>
                      </form>
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

import { etiquetaFuente } from "@/nucleo/fuentes";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fechaHora } from "@/lib/fechas";
import { exigirUsuarioAccion } from "@/lib/sesion-servidor";
import { conectorATS } from "@/salidas";
import { referenciaCorrespondencia } from "@/modules/destino";
import { esquemaNombreFuente } from "@/nucleo/contrato/canonica";
import { asegurarFuenteSistema } from "@/entradas/generica/fuentes";
import { auditar } from "@/nucleo/auditoria";

export const dynamic = "force-dynamic";
export const metadata = { title: "Correspondencias" };

const esquema = z.object({
  fuente: esquemaNombreFuente.default("apply-connect"),
  externalJobId: z.string().trim().min(1, "Indica el código de la vacante.").max(200),
  procesoAtsId: z.coerce.number().int().positive("Elige un proceso del ATS."),
});

async function guardar(formData: FormData) {
  "use server";
  const u = await exigirUsuarioAccion("ADMIN");
  const r = esquema.safeParse({ fuente: formData.get("fuente") || undefined, externalJobId: formData.get("externalJobId"), procesoAtsId: formData.get("procesoAtsId") });
  if (!r.success) redirect(`/correspondencias?error=${encodeURIComponent(r.error.issues[0].message)}`);
  const { fuente, externalJobId: vacante, procesoAtsId } = r.data;
  const externalJobId = referenciaCorrespondencia(fuente, vacante);
  if (!(await prisma.fuente.findUnique({ where: { nombre: fuente } }))) redirect(`/correspondencias?error=${encodeURIComponent(`La fuente «${fuente}» no existe (créala en Fuentes).`)}`);
  // El proceso se valida contra el ATS por HTTP: el puente no lee las tablas del ATS.
  const procesos = await conectorATS().listarProcesos().catch(() => null);
  if (!procesos) redirect(`/correspondencias?error=${encodeURIComponent("No se pudo consultar el ATS para validar el proceso.")}`);
  if (!procesos.some((p) => p.id === String(procesoAtsId))) redirect(`/correspondencias?error=${encodeURIComponent(`El proceso ${procesoAtsId} no existe en el ATS.`)}`);
  await prisma.correspondencia.upsert({
    where: { externalJobId },
    create: { fuente, vacanteExterna: vacante, externalJobId, procesoAtsId, descripcion: `${vacante} → proceso ${procesoAtsId}` },
    update: { procesoAtsId, activa: true, cerradaEn: null, descripcion: `${vacante} → proceso ${procesoAtsId}` },
  });
  await auditar({ tipo: "usuario", id: u.id }, "correspondencia.guardada", null, `${fuente}:${vacante}→${procesoAtsId}`);
  redirect(`/correspondencias?ok=${encodeURIComponent(`Vacante ${vacante} vinculada al proceso ${procesoAtsId}${fuente === "apply-connect" ? "" : ` (fuente ${fuente})`}.`)}`);
}

async function alternar(formData: FormData) {
  "use server";
  await exigirUsuarioAccion("ADMIN");
  const id = String(formData.get("id"));
  const c = await prisma.correspondencia.findUnique({ where: { id } });
  if (!c) redirect("/correspondencias");
  await prisma.correspondencia.update({
    where: { id },
    data: c.activa ? { activa: false, cerradaEn: null } : { activa: true, cerradaEn: null },
  });
  redirect(`/correspondencias?ok=${encodeURIComponent(c.activa ? `Vacante ${c.externalJobId} desvinculada: nuevas postulaciones recibirán JOB_POSTING_CLOSED.` : `Vacante ${c.externalJobId} vinculada de nuevo.`)}`);
}

export default async function Correspondencias({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  await asegurarFuenteSistema();
  const [lista, procesos, fuentes] = await Promise.all([
    prisma.correspondencia.findMany({ orderBy: [{ fuente: "asc" }, { externalJobId: "asc" }] }),
    conectorATS().listarProcesos().catch(() => null),
    prisma.fuente.findMany({ where: { activa: true }, orderBy: [{ sistema: "desc" }, { nombre: "asc" }] }),
  ]);
  const nombre = new Map((procesos ?? []).map((p) => [p.id, p.titulo]));

  return (
    <>
      <h1>Correspondencias de vacantes</h1>
      <p className="p-sub">
        Para vacantes creadas directamente en el Simulador LinkedIn (las que publica el puente ya están asociadas a su proceso): qué vacante (externalJobId) corresponde a qué proceso del Simulador BUK. Sin correspondencia activa ni publicación, el puente responde
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
              <label htmlFor="fuente">Fuente</label>
              <select id="fuente" name="fuente" defaultValue="apply-connect">
                {fuentes.map((x) => (
                  <option key={x.id} value={x.nombre}>
                    {etiquetaFuente(x.nombre)}
                  </option>
                ))}
              </select>
            </div>
            <div className="p-campo">
              <label htmlFor="externalJobId">Código de la vacante en el Simulador LinkedIn (o en la fuente elegida)</label>
              <input id="externalJobId" name="externalJobId" placeholder="RT-2026-103" required />
            </div>
            <div className="p-campo">
              <label htmlFor="procesoAtsId">Proceso del Simulador BUK</label>
              <select id="procesoAtsId" name="procesoAtsId" required defaultValue="">
                <option value="" disabled>
                  Elige un proceso…
                </option>
                {procesos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} · {p.titulo}
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
                  <th scope="col">Fuente</th>
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
                    <td title={`Fuente «${c.fuente}»`}>{etiquetaFuente(c.fuente)}</td>
                    <td className="mono">{c.vacanteExterna ?? c.externalJobId}</td>
                    <td>
                      {c.procesoAtsId} · {nombre.get(String(c.procesoAtsId)) ?? "proceso no encontrado en el ATS"}
                    </td>
                    <td>
                      <span className={`p-estado ${c.activa ? "p-estado-COMPLETADO" : "p-estado-RECHAZADO"}`}>
                        {c.activa ? "Activa" : "Desvinculada"}
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

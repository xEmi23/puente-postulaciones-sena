import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { exigirUsuarioAccion } from "@/lib/sesion-servidor";
import { conectorATS } from "@/salidas";
import { FUENTE_FORMULARIO, crearEnlace, desactivarEnlace, formatoCodigo, urlFormulario } from "@/entradas/formulario/servicio";
import { EnlaceCopiable } from "./copiar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Formulario público" };

const volver = (clave: "ok" | "error", texto: string) => redirect(`/formulario?${clave}=${encodeURIComponent(texto)}`);

async function crear(formData: FormData) {
  "use server";
  const u = await exigirUsuarioAccion("ADMIN");
  const id = z.coerce.number().int().positive().safeParse(formData.get("procesoAtsId"));
  if (!id.success) volver("error", "Elige un proceso del ATS.");
  // El proceso se valida contra el ATS por HTTP (el puente no lee sus tablas) y su título queda como título público.
  const procesos = await conectorATS().listarProcesos().catch(() => null);
  const p = procesos?.find((x) => x.id === String(id.data));
  if (!procesos) volver("error", "No se pudo consultar el ATS para validar el proceso.");
  if (!p) volver("error", `El proceso ${id.data} no existe en el ATS.`);
  await crearEnlace(id.data!, p!.titulo, { tipo: "usuario", id: u.id });
  volver("ok", `Enlace público listo para el proceso ${id.data}.`);
}

async function desactivar(formData: FormData) {
  "use server";
  const u = await exigirUsuarioAccion("ADMIN");
  const codigo = String(formData.get("codigo") ?? "");
  if (!formatoCodigo.test(codigo)) volver("error", "Código inválido.");
  await desactivarEnlace(codigo, { tipo: "usuario", id: u.id });
  volver("ok", "Enlace desactivado: el formulario ya no recibe postulaciones.");
}

export default async function Formulario({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const [enlaces, procesos] = await Promise.all([
    prisma.correspondencia.findMany({ where: { fuente: FUENTE_FORMULARIO }, orderBy: { creadaEn: "asc" } }),
    conectorATS().listarProcesos().catch(() => null),
  ]);
  const porProceso = new Map(enlaces.map((e) => [e.procesoAtsId, e]));

  return (
    <>
      <h1>Formulario público</h1>
      <p className="p-sub">
        Cada vacante vinculada a un proceso del Simulador BUK tiene un enlace público. Pégalo como enlace externo de la oferta: quien se postule llena nombre, correo,
        teléfono y hoja de vida en PDF, acepta el <a href="/privacidad">aviso de privacidad</a> y la postulación entra al Puente como fuente «Formulario público».
      </p>
      <div role="status" aria-live="polite">
        {ok && <div className="alerta alerta-exito">{ok}</div>}
        {error && <div className="alerta alerta-error">{error}</div>}
      </div>

      <section className="p-tarjeta" aria-labelledby="t-enlaces">
        <h2 id="t-enlaces">Vacantes y enlaces</h2>
        {!procesos ? (
          <p className="alerta alerta-error">No se pudo consultar la lista de procesos del ATS. Verifica la conexión en Conexiones.</p>
        ) : procesos.length === 0 ? (
          <p className="vacio">El ATS no tiene procesos.</p>
        ) : (
          <div className="p-tabla-contenedor">
            <table className="p-tabla">
              <thead>
                <tr>
                  <th scope="col">Proceso del ATS</th>
                  <th scope="col">Enlace público</th>
                  <th scope="col">Acción</th>
                </tr>
              </thead>
              <tbody>
                {procesos.map((p) => {
                  const e = porProceso.get(Number(p.id));
                  const activo = e?.activa && e.vacanteExterna;
                  return (
                    <tr key={p.id} data-testid="fila-formulario" data-proceso={p.id}>
                      <td>
                        {p.id} · {p.titulo}
                      </td>
                      <td>{activo ? <EnlaceCopiable url={urlFormulario(e.vacanteExterna!)} etiqueta={`Enlace público del proceso ${p.id}`} /> : <span className="p-nota">Sin enlace activo</span>}</td>
                      <td>
                        {activo ? (
                          <form action={desactivar}>
                            <input type="hidden" name="codigo" value={e.vacanteExterna!} />
                            <button className="p-boton p-boton-secundario" type="submit">
                              Desactivar
                            </button>
                          </form>
                        ) : (
                          <form action={crear}>
                            <input type="hidden" name="procesoAtsId" value={p.id} />
                            <button className="p-boton" type="submit" aria-label={`Crear el enlace público del proceso ${p.id}`}>
                              {e ? "Activar enlace" : "Crear enlace"}
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

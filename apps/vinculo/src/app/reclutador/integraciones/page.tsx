import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { exigirUsuario, exigirUsuarioAccion } from "@/lib/sesion-servidor";
import { fechaHora } from "@/lib/fechas";
import { autorizarAplicacion, revocarAutorizacion } from "@/modules/aplicaciones";
import { ActualizarCada } from "@/components/actualizar-cada";

export const dynamic = "force-dynamic";
export const metadata = { title: "Integraciones" };

const volver = (p: Record<string, string>) => redirect(`/reclutador/integraciones?${new URLSearchParams(p)}`);

async function autorizar(formData: FormData) {
  "use server";
  const u = await exigirUsuarioAccion("RECLUTADOR");
  const r = await autorizarAplicacion(u.empresaId ?? "", String(formData.get("clientId") ?? ""), u.id);
  if (!r.ok) return volver({ error: r.error });
  volver({ ok: `«${r.app.nombre}» quedó autorizada para publicar vacantes de la empresa y recibir sus postulaciones.` });
}

async function revocar(formData: FormData) {
  "use server";
  const u = await exigirUsuarioAccion("RECLUTADOR");
  await revocarAutorizacion(u.empresaId ?? "", String(formData.get("aplicacionId")));
  volver({ ok: "Autorización revocada. La aplicación ya no puede publicar en nombre de la empresa." });
}

const ENTREGA: Record<string, string> = { PENDIENTE: "Pendiente", ENVIADO: "Entregada", FALLIDO: "Fallida" };

export default async function Integraciones({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const u = await exigirUsuario("/reclutador/integraciones", "RECLUTADOR");
  const { ok, error } = await searchParams;
  const empresa = await prisma.empresa.findUnique({ where: { id: u.empresaId ?? "" } });
  const autorizaciones = await prisma.autorizacionEmpresa.findMany({ where: { empresaId: u.empresaId ?? "" }, include: { aplicacion: true }, orderBy: { creadaEn: "desc" } });
  const envios = await prisma.outbox.findMany({
    where: { postulacion: { vacante: { empresaId: u.empresaId ?? "" } } },
    orderBy: { creadoEn: "desc" },
    take: 20,
    include: { aplicacion: { select: { nombre: true } }, postulacion: { select: { nombre: true, apellido: true, vacante: { select: { titulo: true } } } }, intentosEntrega: { orderBy: { enviadoEn: "desc" }, take: 1 } },
  });
  return (
    <>
      <ActualizarCada ms={5000} />
      <h1>Integraciones</h1>
      <p className="v-subtitulo">
        Conecta el ATS de {empresa?.nombre}: autoriza la aplicación del integrador para que publique vacantes y reciba cada solicitud automáticamente.
      </p>
      <div role="status" aria-live="polite">
        {ok && <div className="alerta alerta-exito">{ok}</div>}
        {error && <div className="alerta alerta-error">{error}</div>}
      </div>
      <section className="v-tarjeta" aria-labelledby="t-id">
        <h2 id="t-id">Identificador de la empresa</h2>
        <p>
          El integrador lo usa como <code>companyId</code> al publicar: <code data-testid="company-id">{empresa?.id}</code>
        </p>
      </section>
      <form action={autorizar} className="v-tarjeta" aria-labelledby="t-conectar">
        <h2 id="t-conectar">Conectar ATS</h2>
        <div className="v-campo">
          <label htmlFor="clientId">Client ID de la aplicación del integrador</label>
          <input id="clientId" name="clientId" required placeholder="vin_…" />
          <p className="v-ayuda">Lo encuentras en el portal de desarrolladores de la aplicación (o te lo da tu proveedor de ATS).</p>
        </div>
        <button type="submit" className="v-boton">
          Autorizar aplicación
        </button>
      </form>
      <section className="v-tarjeta" aria-labelledby="t-autorizadas">
        <h2 id="t-autorizadas">Aplicaciones autorizadas</h2>
        {autorizaciones.length === 0 ? (
          <p className="vacio">Aún no hay aplicaciones conectadas.</p>
        ) : (
          <div className="v-tabla-contenedor">
            <table className="v-tabla">
              <caption className="visualmente-oculto">Aplicaciones autorizadas</caption>
              <thead>
                <tr>
                  <th scope="col">Aplicación</th>
                  <th scope="col">Webhook</th>
                  <th scope="col">Autorizada</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {autorizaciones.map((a) => (
                  <tr key={a.id} data-testid="fila-autorizacion">
                    <td>
                      {a.aplicacion.nombre}
                      <div className="v-meta">
                        <code>{a.aplicacion.clientId}</code>
                      </div>
                    </td>
                    <td>
                      <span className={a.aplicacion.webhookEstado === "VALIDADO" ? "v-estado-ok" : a.aplicacion.webhookEstado === "FALLIDO" ? "v-estado-mal" : ""}>
                        {a.aplicacion.webhookEstado === "VALIDADO" ? "Validado" : a.aplicacion.webhookEstado === "FALLIDO" ? "Falló la validación" : "Sin validar"}
                      </span>
                      {a.aplicacion.webhookValidadoEn && <div className="v-meta">{fechaHora(a.aplicacion.webhookValidadoEn)}</div>}
                    </td>
                    <td>{fechaHora(a.creadaEn)}</td>
                    <td>
                      {a.revocadaEn ? (
                        "Revocada"
                      ) : (
                        <form action={revocar}>
                          <input type="hidden" name="aplicacionId" value={a.aplicacionId} />
                          Activa ·{" "}
                          <button type="submit" className="v-enlace-boton" aria-label={`Revocar ${a.aplicacion.nombre}`}>
                            Revocar
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
      <section className="v-tarjeta" aria-labelledby="t-envios">
        <h2 id="t-envios">Últimos envíos al ATS</h2>
        {envios.length === 0 ? (
          <p className="vacio">Aún no se ha entregado ninguna solicitud.</p>
        ) : (
          <div className="v-tabla-contenedor">
            <table className="v-tabla">
              <caption className="visualmente-oculto">Últimos envíos</caption>
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Vacante</th>
                  <th scope="col">Persona</th>
                  <th scope="col">Aplicación</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {envios.map((e) => (
                  <tr key={e.id} data-testid="fila-envio">
                    <td>{fechaHora(e.creadoEn)}</td>
                    <td>{e.postulacion?.vacante.titulo}</td>
                    {/* Sin datos personales completos: nombre e inicial del apellido. */}
                    <td>{e.postulacion ? `${e.postulacion.nombre} ${e.postulacion.apellido.charAt(0)}.` : "—"}</td>
                    <td>{e.aplicacion.nombre}</td>
                    <td>
                      {ENTREGA[e.estado]} · {e.intentos} {e.intentos === 1 ? "intento" : "intentos"}
                      {e.intentosEntrega[0]?.httpStatus && <div className="v-meta">Último: HTTP {e.intentosEntrega[0].httpStatus}</div>}
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

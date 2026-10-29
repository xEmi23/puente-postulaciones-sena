import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { exigirUsuario } from "@/lib/sesion-servidor";
import { fechaHora } from "@/lib/fechas";
import { urlPublica } from "@/lib/config";
import { ActualizarCada } from "@/components/actualizar-cada";
import { revocar } from "../../acciones";
import { BotonReenviar, Consola, FormularioWebhook, RegenerarSecreto } from "../../componentes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Aplicación" };

const ESTADO_WEBHOOK: Record<string, string> = { SIN_VALIDAR: "Sin validar", VALIDADO: "Validado", FALLIDO: "Falló la validación" };
const ENTREGA: Record<string, string> = { PENDIENTE: "Pendiente", ENVIADO: "Entregada", FALLIDO: "Fallida" };

export default async function Aplicacion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await exigirUsuario(`/developers/aplicaciones/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const app = await prisma.aplicacionDev.findFirst({
    where: { id, propietarioId: u.id },
    include: {
      autorizaciones: { where: { revocadaEn: null }, include: { empresa: { select: { nombre: true } } } },
      outbox: { orderBy: { creadoEn: "desc" }, take: 15, include: { postulacion: { select: { jobApplicationId: true } }, intentosEntrega: { orderBy: { enviadoEn: "desc" }, take: 1 } } },
    },
  });
  if (!app) notFound();
  return (
    <>
      <ActualizarCada ms={5000} />
      <p>
        <Link href="/developers">← Mis aplicaciones</Link>
      </p>
      <h1>{app.nombre}</h1>
      {app.revocadaEn && (
        <div className="alerta alerta-error" role="status">
          Aplicación revocada el {fechaHora(app.revocadaEn)}. Sus tokens ya no funcionan y no recibe entregas.
        </div>
      )}
      <section className="v-tarjeta" aria-labelledby="t-credenciales">
        <h2 id="t-credenciales">Credenciales</h2>
        <dl className="v-dato">
          <dt>Client ID</dt>
          <dd>
            <code data-testid="client-id-app">{app.clientId}</code>
          </dd>
          <dt>Client Secret</dt>
          <dd>•••••••• (solo se mostró al crearlo o regenerarlo)</dd>
          <dt>Token</dt>
          <dd>
            <code>POST {urlPublica()}/oauth/v2/accessToken</code> con <code>grant_type=client_credentials</code>
          </dd>
          <dt>Empresas que la autorizaron</dt>
          <dd>{app.autorizaciones.length ? app.autorizaciones.map((a) => a.empresa.nombre).join(", ") : "Ninguna todavía"}</dd>
        </dl>
        {!app.revocadaEn && (
          <div style={{ marginTop: "1rem", display: "grid", gap: "0.75rem" }}>
            <RegenerarSecreto appId={app.id} />
            <form action={revocar}>
              <input type="hidden" name="appId" value={app.id} />
              <button type="submit" className="v-boton v-boton-peligro">
                Revocar aplicación
              </button>
            </form>
          </div>
        )}
      </section>
      <section className="v-tarjeta" aria-labelledby="t-webhook">
        <h2 id="t-webhook">Webhook</h2>
        <p>
          Estado: <strong data-testid="estado-webhook">{ESTADO_WEBHOOK[app.webhookEstado]}</strong>
          {app.webhookValidadoEn && ` · validado el ${fechaHora(app.webhookValidadoEn)}`}
        </p>
        {app.webhookDetalle && <p className="v-ayuda">{app.webhookDetalle}</p>}
        {!app.revocadaEn && <FormularioWebhook appId={app.id} actual={app.webhookUrl} />}
      </section>
      <section className="v-tarjeta" aria-labelledby="t-entregas">
        <h2 id="t-entregas">Entregas recientes</h2>
        {app.outbox.length === 0 ? (
          <p className="vacio">Aún no hay entregas.</p>
        ) : (
          <div className="v-tabla-contenedor">
            <table className="v-tabla">
              <caption className="visualmente-oculto">Entregas recientes</caption>
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">jobApplicationId</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Acción</th>
                </tr>
              </thead>
              <tbody>
                {app.outbox.map((o) => (
                  <tr key={o.id} data-testid="fila-entrega" data-job-application-id={o.postulacion?.jobApplicationId}>
                    <td>{fechaHora(o.creadoEn)}</td>
                    <td>
                      <code>{o.postulacion?.jobApplicationId}</code>
                    </td>
                    <td>
                      {ENTREGA[o.estado]} · {o.intentos} {o.intentos === 1 ? "intento" : "intentos"}
                      {o.intentosEntrega[0]?.httpStatus && <div className="v-meta">Último: HTTP {o.intentosEntrega[0].httpStatus}</div>}
                      {o.ultimoError && <div className="v-meta">{o.ultimoError}</div>}
                    </td>
                    <td>{!app.revocadaEn && <BotonReenviar appId={app.id} outboxId={o.id} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {!app.revocadaEn && app.webhookUrl && (
        <section className="v-tarjeta" aria-labelledby="t-consola">
          <h2 id="t-consola">Consola de pruebas del webhook</h2>
          <p className="v-ayuda">Envía a tu webhook entregas inválidas a propósito (como con Postman) para comprobar que las rechaza con el código correcto.</p>
          <Consola appId={app.id} />
        </section>
      )}
    </>
  );
}

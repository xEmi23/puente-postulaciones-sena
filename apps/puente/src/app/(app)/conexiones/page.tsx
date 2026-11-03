import { exigirUsuario } from "@/lib/sesion-servidor";
import { urlWebhook } from "@/lib/config";
import { fechaHora } from "@/lib/fechas";
import { enmascarar } from "@/modules/conexiones";
import { estadoConexiones } from "@/modules/prueba-conexion";
import { ActualizarCada } from "@/components/actualizar-cada";
import { quitar } from "./acciones";
import { Copiar, FormularioConexion } from "./componentes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Conexiones" };

const ESTADO: Record<string, string> = { SIN_PROBAR: "Sin probar", OK: "Funciona", FALLIDA: "Falló la última prueba" };

export default async function Conexiones() {
  const u = await exigirUsuario("/conexiones");
  const { vinculo, talentia } = await estadoConexiones();
  const admin = u.rol === "ADMIN";
  const vOk = vinculo?.estadoPrueba === "OK";
  const tOk = talentia?.estadoPrueba === "OK";
  const webhookOk = !!vinculo?.webhookValidadoEn;
  const actual = !vOk ? 1 : !tOk ? 2 : 3;

  return (
    <>
      <ActualizarCada ms={8000} />
      <h1>Conexiones</h1>
      <p className="p-sub">
        Credenciales con las que el puente habla con el Simulador LinkedIn (red profesional) y el Simulador BUK (ATS). Cambiar de sistema real es cambiar esta configuración.
      </p>
      {!admin && <p className="p-nota">Tu rol de operador permite ver y probar las conexiones; solo un administrador puede cambiarlas.</p>}

      <ol className="p-asistente" aria-label="Asistente de configuración" data-testid="asistente">
        <li data-hecho={vOk} aria-current={actual === 1 ? "step" : undefined}>
          1. Simulador LinkedIn {vOk && "✓"}
        </li>
        <li data-hecho={tOk} aria-current={actual === 2 ? "step" : undefined}>
          2. Simulador BUK {tOk && "✓"}
        </li>
        <li data-hecho={vOk && tOk && webhookOk} aria-current={actual === 3 ? "step" : undefined}>
          3. Webhook validado y listo {vOk && tOk && webhookOk && "✓"}
        </li>
      </ol>

      <div className="p-rejilla-2">
        <section className="p-tarjeta" aria-labelledby="t-vinculo" data-testid="conexion-vinculo">
          <h2 id="t-vinculo">1 · Simulador LinkedIn</h2>
          <p className="p-nota">
            Crea una aplicación en el portal de desarrolladores del Simulador LinkedIn, copia su Client ID y su Client Secret, y pide a la empresa que la autorice (Integraciones → Conectar ATS).
          </p>
          <dl className="p-datos">
            <dt>Estado</dt>
            <dd data-testid="estado-vinculo">{vinculo ? ESTADO[vinculo.estadoPrueba] : "Sin configurar"}</dd>
            {vinculo?.detallePrueba && (
              <>
                <dt>Última prueba</dt>
                <dd>
                  {vinculo.detallePrueba} {vinculo.probadaEn && `(${fechaHora(vinculo.probadaEn)})`}
                </dd>
              </>
            )}
            <dt>Empresa</dt>
            <dd>{vinculo?.empresaNombre ?? "—"}</dd>
          </dl>
          <FormularioConexion tipo="VINCULO" nombre="Simulador LinkedIn" urlBase={vinculo?.urlBase ?? ""} clientId={vinculo?.clientId ?? ""} secretoMascara={enmascarar(vinculo?.secretoFinal)} editable={admin} conectada={!!vinculo} />
          {vinculo && admin && (
            <form action={quitar}>
              <input type="hidden" name="tipo" value="VINCULO" />
              <button type="submit" className="p-boton-texto">
                Desconectar el Simulador LinkedIn
              </button>
            </form>
          )}
        </section>

        <section className="p-tarjeta" aria-labelledby="t-talentia" data-testid="conexion-talentia">
          <h2 id="t-talentia">2 · Simulador BUK</h2>
          <p className="p-nota">Crea una API Key en el Simulador BUK (Administración → API Keys) con permisos de Selección: Lectura y Modificación.</p>
          <dl className="p-datos">
            <dt>Estado</dt>
            <dd data-testid="estado-talentia">{talentia ? ESTADO[talentia.estadoPrueba] : "Sin configurar"}</dd>
            {talentia?.detallePrueba && (
              <>
                <dt>Última prueba</dt>
                <dd>
                  {talentia.detallePrueba} {talentia.probadaEn && `(${fechaHora(talentia.probadaEn)})`}
                </dd>
              </>
            )}
          </dl>
          <FormularioConexion tipo="TALENTIA" nombre="Simulador BUK" urlBase={talentia?.urlBase ?? ""} secretoMascara={enmascarar(talentia?.secretoFinal)} editable={admin} conectada={!!talentia} />
          {talentia && admin && (
            <form action={quitar}>
              <input type="hidden" name="tipo" value="TALENTIA" />
              <button type="submit" className="p-boton-texto">
                Desconectar el Simulador BUK
              </button>
            </form>
          )}
        </section>
      </div>

      <section className="p-tarjeta" aria-labelledby="t-webhook">
        <h2 id="t-webhook">3 · Webhook del puente</h2>
        <p>Registra esta URL como webhook de la aplicación en el portal de desarrolladores del Simulador LinkedIn:</p>
        <Copiar texto={urlWebhook()} etiqueta="Copiar la URL del webhook" />
        <p data-testid="estado-webhook">
          {webhookOk ? (
            <span className="p-ok">✓ El Simulador LinkedIn validó el webhook (desafío respondido el {fechaHora(vinculo!.webhookValidadoEn!)}).</span>
          ) : (
            "El Simulador LinkedIn aún no ha validado el webhook. Ocurre al registrar la URL y antes de publicar cada vacante con Solicitud sencilla."
          )}
        </p>
      </section>
    </>
  );
}

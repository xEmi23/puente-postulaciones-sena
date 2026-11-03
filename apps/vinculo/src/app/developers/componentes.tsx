"use client";

import { useActionState, useState } from "react";
import { consola, crearApp, guardarWebhook, reenviar, regenerar, type EstadoEnvio, type EstadoSecreto, type EstadoWebhook } from "./acciones";
import { CASOS_CONSOLA } from "./casos";

function SecretoUnaVez({ e }: { e: EstadoSecreto }) {
  const [copiado, setCopiado] = useState(false);
  if (!e.clientSecret) return null;
  return (
    <div className="v-secreto" role="alert" data-testid="secreto-nuevo">
      <strong>Copia el Client Secret ahora: no se volverá a mostrar.</strong>
      <p style={{ margin: "0.4rem 0 0" }}>
        Client ID: <code data-testid="client-id">{e.clientId}</code>
      </p>
      Client Secret: <code data-testid="client-secret">{e.clientSecret}</code>
      <button
        type="button"
        className="v-boton v-boton-borde"
        onClick={async () => {
          await navigator.clipboard?.writeText(e.clientSecret!).catch(() => undefined);
          setCopiado(true);
        }}
      >
        {copiado ? "Copiado" : "Copiar secreto"}
      </button>
      {e.validacion && <p className="v-ayuda">Webhook: {e.validacion}</p>}
      {e.appId && (
        <p style={{ margin: "0.5rem 0 0" }}>
          <a href={`/developers/aplicaciones/${e.appId}`}>Ir a la aplicación</a>
        </p>
      )}
    </div>
  );
}

export function FormularioNuevaApp() {
  const [estado, accion, enviando] = useActionState<EstadoSecreto, FormData>(crearApp, {});
  return (
    <>
      <SecretoUnaVez e={estado} />
      <form action={accion} className="v-tarjeta" aria-labelledby="t-nueva-app">
        <h2 id="t-nueva-app">Crear aplicación</h2>
        {estado.error && (
          <div className="alerta alerta-error" role="alert">
            {estado.error}
          </div>
        )}
        <div className="v-campo">
          <label htmlFor="nombre">Nombre de la aplicación</label>
          <input id="nombre" name="nombre" required minLength={3} maxLength={60} placeholder="Por ejemplo: Puente de postulaciones" />
        </div>
        <div className="v-campo">
          <label htmlFor="webhookUrl">URL del webhook (opcional)</label>
          <input id="webhookUrl" name="webhookUrl" type="url" placeholder="https://…/api/webhooks/vinculo" />
          <p className="v-ayuda">El Simulador LinkedIn la valida con un desafío firmado con el Client Secret. Puedes agregarla después.</p>
        </div>
        <button type="submit" className="v-boton" disabled={enviando}>
          {enviando ? "Creando…" : "Crear aplicación"}
        </button>
      </form>
    </>
  );
}

export function RegenerarSecreto({ appId }: { appId: string }) {
  const [estado, accion, enviando] = useActionState<EstadoSecreto, FormData>(regenerar, {});
  return (
    <>
      <SecretoUnaVez e={estado} />
      <form action={accion}>
        <input type="hidden" name="appId" value={appId} />
        <button type="submit" className="v-boton v-boton-borde" disabled={enviando}>
          Regenerar Client Secret
        </button>
        <p className="v-ayuda">El secreto anterior y los tokens emitidos con él dejan de funcionar de inmediato.</p>
      </form>
    </>
  );
}

export function FormularioWebhook({ appId, actual }: { appId: string; actual: string | null }) {
  const [estado, accion, enviando] = useActionState<EstadoWebhook, FormData>(guardarWebhook, {});
  return (
    <form action={accion}>
      <input type="hidden" name="appId" value={appId} />
      <div className="v-campo">
        <label htmlFor="webhookUrl">URL del webhook</label>
        <input id="webhookUrl" name="webhookUrl" type="url" required defaultValue={actual ?? ""} />
      </div>
      <button type="submit" className="v-boton" disabled={enviando}>
        {enviando ? "Validando…" : "Guardar y validar"}
      </button>
      {estado.detalle && (
        <p role="status" className={estado.ok ? "v-estado-ok" : "v-estado-mal"} data-testid="resultado-validacion">
          {estado.ok ? "✓ " : "✗ "}
          {estado.detalle}
        </p>
      )}
    </form>
  );
}

export function BotonReenviar({ appId, outboxId }: { appId: string; outboxId: string }) {
  const [estado, accion, enviando] = useActionState<EstadoEnvio, FormData>(reenviar, {});
  return (
    <form action={accion}>
      <input type="hidden" name="appId" value={appId} />
      <input type="hidden" name="outboxId" value={outboxId} />
      <button type="submit" className="v-enlace-boton" disabled={enviando}>
        Reenviar evento
      </button>
      {estado.status && (
        <span role="status" data-testid="resultado-reenvio">
          {" "}
          {estado.status} · {estado.cuerpo?.slice(0, 120)}
        </span>
      )}
    </form>
  );
}

export function Consola({ appId }: { appId: string }) {
  const [estado, accion, enviando] = useActionState<EstadoEnvio, FormData>(consola, {});
  return (
    <form action={accion}>
      <input type="hidden" name="appId" value={appId} />
      <div className="v-campo">
        <label htmlFor="caso">Caso</label>
        <select id="caso" name="caso">
          {Object.entries(CASOS_CONSOLA).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="v-boton v-boton-borde" disabled={enviando}>
        Enviar al webhook
      </button>
      {estado.status && (
        <div role="status" style={{ marginTop: "0.75rem" }}>
          Respuesta: <strong data-testid="consola-status">{estado.status}</strong>
          <pre className="v-pre" data-testid="consola-cuerpo">
            {estado.cuerpo}
          </pre>
        </div>
      )}
    </form>
  );
}

"use client";

import { useActionState, useEffect, useState } from "react";
import { guardar, probar, type EstadoAccion } from "./acciones";

/** Muestra «Despertando…» si la acción tarda más de 3 s (los servicios gratuitos de Render tardan cerca de un minuto). */
function useDespertando(enCurso: boolean) {
  const [lento, setLento] = useState(false);
  useEffect(() => {
    if (!enCurso) return;
    const t = setTimeout(() => setLento(true), 3000);
    return () => {
      clearTimeout(t);
      setLento(false);
    };
  }, [enCurso]);
  return lento;
}

function Resultado({ estado, testid }: { estado: EstadoAccion; testid: string }) {
  if (!estado.mensaje) return null;
  return (
    <p role="status" className={estado.ok ? "p-ok" : "p-mal"} data-testid={testid}>
      {estado.ok ? "✓ " : "✗ "}
      {estado.mensaje}
    </p>
  );
}

interface PropsFormulario {
  tipo: "VINCULO" | "TALENTIA";
  nombre: string;
  urlBase: string;
  clientId?: string;
  secretoMascara: string;
  editable: boolean;
}

export function FormularioConexion({ tipo, nombre, urlBase, clientId, secretoMascara, editable }: PropsFormulario) {
  const [estado, accion, enCurso] = useActionState<EstadoAccion, FormData>(guardar, {});
  const lento = useDespertando(enCurso);
  const prefijo = tipo === "VINCULO" ? "vin" : "tal";
  return (
    <form action={accion}>
      <input type="hidden" name="tipo" value={tipo} />
      <div className="p-campo">
        <label htmlFor={`${prefijo}-url`}>URL base de {nombre}</label>
        <input id={`${prefijo}-url`} name="urlBase" type="url" required defaultValue={urlBase} disabled={!editable} placeholder="https://…" />
      </div>
      {tipo === "VINCULO" && (
        <div className="p-campo">
          <label htmlFor="vin-client-id">Client ID</label>
          <input id="vin-client-id" name="clientId" required defaultValue={clientId} disabled={!editable} />
        </div>
      )}
      <div className="p-campo">
        <label htmlFor={`${prefijo}-secreto`}>{tipo === "VINCULO" ? "Client Secret" : "API Key"}</label>
        <input
          id={`${prefijo}-secreto`}
          name={tipo === "VINCULO" ? "clientSecret" : "apiKey"}
          type="password"
          autoComplete="off"
          disabled={!editable}
          placeholder={secretoMascara ? `${secretoMascara} (déjalo vacío para conservarla)` : ""}
          required={!secretoMascara}
        />
        <p className="p-nota">Se guarda cifrada (AES-256-GCM) y nunca se vuelve a mostrar completa.</p>
      </div>
      {editable && (
        <button type="submit" className="p-boton" disabled={enCurso}>
          {enCurso ? "Guardando y probando…" : "Guardar y probar"}
        </button>
      )}
      {lento && (
        <p className="p-despertando" role="status">
          Despertando {nombre}… En el plan gratuito puede tardar cerca de un minuto.
        </p>
      )}
      <Resultado estado={estado} testid={`resultado-guardar-${prefijo}`} />
    </form>
  );
}

export function ProbarConexion({ tipo, nombre }: { tipo: "VINCULO" | "TALENTIA"; nombre: string }) {
  const [estado, accion, enCurso] = useActionState<EstadoAccion, FormData>(probar, {});
  const lento = useDespertando(enCurso);
  const prefijo = tipo === "VINCULO" ? "vin" : "tal";
  return (
    <form action={accion}>
      <input type="hidden" name="tipo" value={tipo} />
      <button type="submit" className="p-boton p-boton-secundario" disabled={enCurso}>
        {enCurso ? "Probando…" : "Probar conexión"}
      </button>
      {lento && (
        <p className="p-despertando" role="status">
          Despertando {nombre}… En el plan gratuito puede tardar cerca de un minuto.
        </p>
      )}
      <Resultado estado={estado} testid={`resultado-probar-${prefijo}`} />
    </form>
  );
}

export function Copiar({ texto, etiqueta }: { texto: string; etiqueta: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <span className="p-copiar">
      <code data-testid="url-webhook">{texto}</code>
      <button
        type="button"
        className="p-boton p-boton-secundario"
        aria-label={etiqueta}
        onClick={async () => {
          await navigator.clipboard?.writeText(texto).catch(() => undefined);
          setCopiado(true);
        }}
      >
        {copiado ? "Copiado" : "Copiar"}
      </button>
    </span>
  );
}

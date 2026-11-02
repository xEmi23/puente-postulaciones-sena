"use client";

import { useActionState } from "react";
import { crear, token, type EstadoFuente } from "./acciones";

function Mensaje({ e, testid }: { e: EstadoFuente; testid: string }) {
  if (!e.mensaje) return null;
  return (
    <p role="status" className={e.ok ? "p-ok" : "p-mal"} data-testid={testid}>
      {e.ok ? "✓ " : "✗ "}
      {e.mensaje}
    </p>
  );
}

export function FormularioFuente() {
  const [estado, accion, enCurso] = useActionState<EstadoFuente, FormData>(crear, {});
  return (
    <form action={accion}>
      <div className="p-rejilla-2">
        <div className="p-campo">
          <label htmlFor="fuente-nombre">Nombre corto</label>
          <input id="fuente-nombre" name="nombre" required pattern="[a-z0-9][a-z0-9\-]{1,39}" placeholder="importador, linkedin-bot…" />
        </div>
        <div className="p-campo">
          <label htmlFor="fuente-descripcion">Descripción (opcional)</label>
          <input id="fuente-descripcion" name="descripcion" maxLength={200} />
        </div>
      </div>
      <button className="p-boton" type="submit" disabled={enCurso}>
        {enCurso ? "Creando…" : "Crear fuente"}
      </button>
      <Mensaje e={estado} testid="resultado-crear-fuente" />
    </form>
  );
}

/** Genera o rota el token y lo muestra UNA sola vez. */
export function GenerarToken({ nombre, tieneToken }: { nombre: string; tieneToken: boolean }) {
  const [estado, accion, enCurso] = useActionState<EstadoFuente, FormData>(token, {});
  return (
    <form action={accion}>
      <input type="hidden" name="nombre" value={nombre} />
      <button className="p-boton p-boton-secundario" type="submit" disabled={enCurso} aria-label={`${tieneToken ? "Rotar" : "Generar"} el token de ${nombre}`}>
        {tieneToken ? "Rotar token" : "Generar token"}
      </button>
      {estado.token ? (
        <div className="p-token" role="alert" data-testid="token-nuevo">
          <p>
            <strong>Token de «{estado.fuente}»</strong> (cópialo ahora; no se volverá a mostrar):
          </p>
          <code data-testid="valor-token">{estado.token}</code>
        </div>
      ) : (
        <Mensaje e={estado} testid="resultado-token" />
      )}
    </form>
  );
}

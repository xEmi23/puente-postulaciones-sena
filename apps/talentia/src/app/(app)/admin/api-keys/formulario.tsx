"use client";

import { useActionState, useState } from "react";
import { crearLlave, type EstadoCreacion } from "./acciones";

export function FormularioLlave() {
  const [estado, accion, enviando] = useActionState<EstadoCreacion, FormData>(crearLlave, {});
  const [copiada, setCopiada] = useState(false);
  return (
    <>
      {estado.llave && (
        <div className="a-llave" role="alert" data-testid="llave-nueva">
          <strong>Llave «{estado.nombre}» creada. Cópiala ahora: no se volverá a mostrar.</strong>
          <code data-testid="valor-llave">{estado.llave}</code>
          <button
            type="button"
            className="a-boton a-boton-claro"
            onClick={async () => {
              await navigator.clipboard?.writeText(estado.llave!).catch(() => undefined);
              setCopiada(true);
            }}
          >
            {copiada ? "Copiada" : "Copiar llave"}
          </button>
          <p className="a-ayuda">El Simulador BUK solo guarda su huella SHA-256 y el prefijo. Si la pierdes, revócala y crea otra.</p>
        </div>
      )}
      <form action={accion} className="a-form" aria-labelledby="t-nueva">
        <h2 id="t-nueva" style={{ marginTop: 0, fontSize: "1rem" }}>
          Nueva API Key
        </h2>
        {estado.error && (
          <div className="alerta alerta-error" role="alert">
            {estado.error}
          </div>
        )}
        <div className="a-campo">
          <label htmlFor="nombre">Nombre</label>
          <input id="nombre" name="nombre" className="a-input" required minLength={3} maxLength={60} placeholder="Por ejemplo: Puente de postulaciones" />
        </div>
        <div className="a-campo">
          <fieldset>
            <legend>Permisos · Módulo Selección</legend>
            <div className="a-casillas">
              <label>
                <input type="checkbox" name="lectura" defaultChecked /> Lectura
              </label>
              <label>
                <input type="checkbox" name="modificacion" /> Modificación
              </label>
            </div>
          </fieldset>
          <p className="a-ayuda">Lectura permite consultar (GET). Modificación permite crear y actualizar (POST y PATCH).</p>
        </div>
        <button type="submit" className="a-boton" disabled={enviando}>
          {enviando ? "Creando…" : "Crear llave"}
        </button>
      </form>
    </>
  );
}

"use client";

import { useActionState } from "react";
import type { ErroresVacante } from "@/modules/origen/vacantes";

export interface EstadoVacante {
  errores: ErroresVacante;
  valores: Record<string, string>;
}

interface Props {
  accion: (previo: EstadoVacante, formData: FormData) => Promise<EstadoVacante>;
  inicial: Record<string, string>;
  textoBoton: string;
}

const CAMPOS = [
  { id: "titulo", etiqueta: "Título del cargo" },
  { id: "area", etiqueta: "Área" },
  { id: "ciudad", etiqueta: "Ciudad" },
] as const;

export function FormularioVacante({ accion, inicial, textoBoton }: Props) {
  const [estado, enviar, enviando] = useActionState(accion, { errores: {}, valores: inicial });
  const e = estado.errores;
  const v = estado.valores;
  return (
    <form action={enviar} noValidate>
      {e.general && (
        <div className="alerta alerta-error" role="alert">
          {e.general}
        </div>
      )}
      {CAMPOS.map((c) => (
        <div className="o-campo" key={c.id}>
          <label htmlFor={c.id}>{c.etiqueta}</label>
          <input id={c.id} name={c.id} defaultValue={v[c.id]} aria-invalid={e[c.id] ? true : undefined} aria-describedby={e[c.id] ? `${c.id}-error` : undefined} />
          {e[c.id] && (
            <p id={`${c.id}-error`} className="mensaje-error">
              {e[c.id]}
            </p>
          )}
        </div>
      ))}
      <div className="o-campo">
        <label htmlFor="modalidad">Modalidad</label>
        <select id="modalidad" name="modalidad" defaultValue={v.modalidad ?? "Híbrido"} className="o-select">
          <option>Presencial</option>
          <option>Híbrido</option>
          <option>Remoto</option>
        </select>
      </div>
      <div className="o-campo">
        <label htmlFor="descripcion">Descripción</label>
        <textarea
          id="descripcion"
          name="descripcion"
          rows={6}
          defaultValue={v.descripcion}
          aria-invalid={e.descripcion ? true : undefined}
          aria-describedby={`descripcion-ayuda${e.descripcion ? " descripcion-error" : ""}`}
        />
        <p id="descripcion-ayuda" className="o-ayuda">
          Mínimo 60 caracteres.
        </p>
        {e.descripcion && (
          <p id="descripcion-error" className="mensaje-error">
            {e.descripcion}
          </p>
        )}
      </div>
      <button type="submit" className="o-boton" disabled={enviando} aria-busy={enviando}>
        {enviando ? "Guardando…" : textoBoton}
      </button>
    </form>
  );
}

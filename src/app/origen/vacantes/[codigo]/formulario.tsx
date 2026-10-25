"use client";

import { useActionState, useEffect, useRef } from "react";
import { postular, type EstadoFormulario } from "./acciones";

const inicial: EstadoFormulario = { errores: {}, valores: {} };

interface Props {
  vacanteId: string;
  maxMb: number;
}

function Campo(props: {
  id: string;
  etiqueta: string;
  error?: string;
  ayuda?: string;
  tipo?: string;
  requerido?: boolean;
  valor?: string;
  autoComplete?: string;
}) {
  const descr = [props.ayuda ? `${props.id}-ayuda` : null, props.error ? `${props.id}-error` : null].filter(Boolean).join(" ");
  return (
    <div className="o-campo">
      <label htmlFor={props.id}>
        {props.etiqueta}
        {props.requerido ? <span aria-hidden="true"> *</span> : <span style={{ fontWeight: 400 }}> (opcional)</span>}
      </label>
      <input
        id={props.id}
        name={props.id}
        type={props.tipo ?? "text"}
        required={props.requerido}
        defaultValue={props.valor}
        autoComplete={props.autoComplete}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={descr || undefined}
      />
      {props.ayuda && (
        <p id={`${props.id}-ayuda`} className="o-ayuda">
          {props.ayuda}
        </p>
      )}
      {props.error && (
        <p id={`${props.id}-error`} className="mensaje-error">
          {props.error}
        </p>
      )}
    </div>
  );
}

export function FormularioPostulacion({ vacanteId, maxMb }: Props) {
  const [estado, accion, enviando] = useActionState(postular.bind(null, vacanteId), inicial);
  const formRef = useRef<HTMLFormElement>(null);
  const e = estado.errores;
  const v = estado.valores;

  // Lleva el foco al primer campo con error para quien navega con teclado o lector de pantalla.
  useEffect(() => {
    const primero = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-error-general]');
    primero?.focus();
  }, [estado]);

  return (
    <form ref={formRef} action={accion} noValidate aria-describedby="nota-obligatorios">
      <p id="nota-obligatorios" className="o-ayuda" style={{ fontSize: "0.85rem", color: "#78716c", marginTop: 0 }}>
        Los campos con * son obligatorios.
      </p>
      {e.general && (
        <div className="alerta alerta-error" role="alert" tabIndex={-1} data-error-general>
          {e.general}
        </div>
      )}
      {Object.keys(e).length > 0 && !e.general && (
        <div className="alerta alerta-error" role="alert">
          Revisa los campos marcados para continuar.
        </div>
      )}
      <div className="o-fila">
        <Campo id="nombre" etiqueta="Nombre" requerido valor={v.nombre} error={e.nombre} autoComplete="given-name" />
        <Campo id="apellido" etiqueta="Apellido" requerido valor={v.apellido} error={e.apellido} autoComplete="family-name" />
      </div>
      <Campo id="correo" etiqueta="Correo electrónico" tipo="email" requerido valor={v.correo} error={e.correo} autoComplete="email" />
      <div className="o-fila">
        <Campo id="telefono" etiqueta="Teléfono" tipo="tel" valor={v.telefono} error={e.telefono} autoComplete="tel" ayuda="Ej.: 300 000 0000" />
        <Campo id="ciudad" etiqueta="Ciudad" requerido valor={v.ciudad} error={e.ciudad} autoComplete="address-level2" />
      </div>
      <div className="o-campo">
        <label htmlFor="cv">
          Hoja de vida (PDF)<span aria-hidden="true"> *</span>
        </label>
        <input
          id="cv"
          name="cv"
          type="file"
          accept="application/pdf,.pdf"
          required
          aria-invalid={e.cv ? true : undefined}
          aria-describedby={`cv-ayuda${e.cv ? " cv-error" : ""}`}
        />
        <p id="cv-ayuda" className="o-ayuda">
          Solo PDF, máximo {maxMb} MB.{v.nombre ? " Por seguridad, vuelve a adjuntar el archivo si corriges algún dato." : ""}
        </p>
        {e.cv && (
          <p id="cv-error" className="mensaje-error">
            {e.cv}
          </p>
        )}
      </div>
      <p style={{ fontSize: "0.8rem", color: "#78716c" }}>
        Al postularte aceptas que tus datos se compartan con la empresa que publicó la vacante. Este es un entorno de simulación:
        usa solo datos ficticios.
      </p>
      <button type="submit" className="o-boton" disabled={enviando} aria-busy={enviando}>
        {enviando ? "Enviando postulación…" : "Enviar postulación"}
      </button>
    </form>
  );
}

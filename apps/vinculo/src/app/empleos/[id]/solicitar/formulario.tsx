"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { enviar, type EstadoSolicitud } from "./acciones";

interface Props {
  vacanteId: string;
  titulo: string;
  empresa: string;
  maxMb: number;
  inicial: { nombre: string; apellido: string; correo: string; telefono: string; ciudad: string };
  cvPerfil: { nombre: string; tamano: string } | null;
}

const CAMPOS = [
  { id: "nombre", etiqueta: "Nombre", tipo: "text", auto: "given-name" },
  { id: "apellido", etiqueta: "Apellido", tipo: "text", auto: "family-name" },
  { id: "correo", etiqueta: "Correo electrónico", tipo: "email", auto: "email" },
  { id: "telefono", etiqueta: "Teléfono", tipo: "tel", auto: "tel" },
  { id: "ciudad", etiqueta: "Ciudad", tipo: "text", auto: "address-level2" },
] as const;

/** «Solicitud sencilla»: paso 1 confirma los datos de contacto; paso 2 elige el CV y envía. */
export function FormularioSolicitud({ vacanteId, titulo, empresa, maxMb, inicial, cvPerfil }: Props) {
  const [estado, accion, enviando] = useActionState<EstadoSolicitud, FormData>(enviar, {});
  const [paso, setPaso] = useState<1 | 2>(1);
  const [origen, setOrigen] = useState<"perfil" | "nuevo">(cvPerfil ? "perfil" : "nuevo");
  const formulario = useRef<HTMLFormElement>(null);
  const errores = estado.errores ?? {};
  const valores = { ...inicial, ...(estado.valores ?? {}) };
  const hayErroresContacto = CAMPOS.some((c) => errores[c.id]);

  // Con errores del servidor: vuelve al paso de contacto si ahí están los errores (ajuste de estado durante el render)
  // y después lleva el foco al primer campo con error.
  const [estadoVisto, setEstadoVisto] = useState(estado);
  if (estado !== estadoVisto) {
    setEstadoVisto(estado);
    if (estado.errores && hayErroresContacto) setPaso(1);
  }
  useEffect(() => {
    if (!estado.errores) return;
    requestAnimationFrame(() => formulario.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  }, [estado, hayErroresContacto]);

  // El paso 1 solo exige que los obligatorios no estén vacíos; el formato lo valida el servidor (una sola fuente de reglas).
  const [faltantes, setFaltantes] = useState<string[]>([]);
  const continuar = () => {
    const vacios = CAMPOS.filter((c) => c.id !== "telefono" && !(formulario.current?.elements.namedItem(c.id) as HTMLInputElement | null)?.value.trim()).map((c) => c.id);
    setFaltantes(vacios);
    if (vacios.length) {
      requestAnimationFrame(() => document.getElementById(vacios[0])?.focus());
      return;
    }
    setPaso(2);
    requestAnimationFrame(() => document.getElementById("t-paso-2")?.focus());
  };

  return (
    <form ref={formulario} action={accion} noValidate className="v-tarjeta" aria-labelledby="t-solicitud">
      <h1 id="t-solicitud" style={{ marginTop: 0 }}>
        Solicitud sencilla
      </h1>
      <p className="v-subtitulo">
        {titulo} · {empresa}
      </p>
      <ol className="v-pasos" aria-label="Pasos de la solicitud">
        <li aria-current={paso === 1 ? "step" : undefined}>1. Datos de contacto</li>
        <li aria-current={paso === 2 ? "step" : undefined}>2. Hoja de vida</li>
      </ol>
      <input type="hidden" name="vacanteId" value={vacanteId} />
      {estado.errores && (
        <div className="alerta alerta-error" role="alert">
          {errores.general ?? "Revisa los campos marcados para continuar."}
        </div>
      )}

      <fieldset hidden={paso !== 1} style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="visualmente-oculto">Datos de contacto</legend>
        <p className="v-ayuda">La empresa verá estos datos. Vienen de tu perfil; puedes corregirlos para esta solicitud.</p>
        {CAMPOS.map((c) => (
          <div className="v-campo" key={c.id}>
            <label htmlFor={c.id}>
              {c.etiqueta}
              {c.id === "telefono" && <span className="v-ayuda"> (opcional)</span>}
            </label>
            <input
              id={c.id}
              name={c.id}
              type={c.tipo === "email" ? "text" : c.tipo}
              inputMode={c.tipo === "email" ? "email" : undefined}
              autoComplete={c.auto}
              defaultValue={valores[c.id]}
              required={c.id !== "telefono"}
              aria-invalid={errores[c.id] || faltantes.includes(c.id) ? true : undefined}
              aria-describedby={errores[c.id] || faltantes.includes(c.id) ? `${c.id}-error` : undefined}
            />
            {(errores[c.id] || faltantes.includes(c.id)) && (
              <p id={`${c.id}-error`} className="mensaje-error">
                {errores[c.id] ?? "Este campo es obligatorio."}
              </p>
            )}
          </div>
        ))}
        <button type="button" className="v-boton" onClick={continuar}>
          Continuar
        </button>
      </fieldset>

      <fieldset hidden={paso !== 2} style={{ border: 0, padding: 0, margin: 0 }}>
        <legend id="t-paso-2" tabIndex={-1} className="visualmente-oculto">
          Hoja de vida
        </legend>
        <div className="v-campo">
          <fieldset>
            <legend>¿Qué hoja de vida envías?</legend>
            {cvPerfil && (
              <label className="v-opcion">
                <input type="radio" name="origenCv" value="perfil" checked={origen === "perfil"} onChange={() => setOrigen("perfil")} />
                <span>
                  La de mi perfil: <strong>{cvPerfil.nombre}</strong> ({cvPerfil.tamano})
                </span>
              </label>
            )}
            <label className="v-opcion">
              <input type="radio" name="origenCv" value="nuevo" checked={origen === "nuevo"} onChange={() => setOrigen("nuevo")} />
              <span>Subir otra hoja de vida</span>
            </label>
          </fieldset>
        </div>
        {origen === "nuevo" && (
          <>
            <div className="v-campo">
              <label htmlFor="cv">Hoja de vida (PDF)</label>
              <input
                id="cv"
                name="cv"
                type="file"
                accept="application/pdf,.pdf"
                aria-invalid={errores.cv ? true : undefined}
                aria-describedby={errores.cv ? "cv-error cv-ayuda" : "cv-ayuda"}
              />
              <p id="cv-ayuda" className="v-ayuda">
                Solo PDF, máximo {maxMb} MB.
              </p>
            </div>
            <label className="v-opcion">
              <input type="checkbox" name="guardarEnPerfil" /> Guardar también como la hoja de vida de mi perfil
            </label>
          </>
        )}
        {errores.cv && (
          <p id="cv-error" className="mensaje-error">
            {errores.cv}
          </p>
        )}
        <p className="v-ayuda">
          Al enviar, la empresa recibe tus datos de contacto y tu hoja de vida para este proceso de selección (Ley 1581 de 2012). Si la empresa tiene un ATS conectado, se le entregan automáticamente.
        </p>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", flexWrap: "wrap" }}>
          <button type="button" className="v-boton v-boton-borde" onClick={() => setPaso(1)}>
            Atrás
          </button>
          <button type="submit" className="v-boton" disabled={enviando}>
            {enviando ? "Enviando…" : "Enviar solicitud"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

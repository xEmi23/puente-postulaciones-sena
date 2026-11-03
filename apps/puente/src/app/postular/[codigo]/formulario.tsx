"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CAMPO_TRAMPA,
  INDICATIVOS,
  INDICATIVO_POR_DEFECTO,
  MENSAJES_ERROR,
  validarCampo,
  validarFormulario,
  type CampoFormulario,
  type ErroresCampos,
  type ValoresFormulario,
} from "@/entradas/formulario/campos";

// Formulario de postulación. Con JavaScript: validación en línea, envío por fetch (los datos escritos no se pierden si
// algo falla) y estado «Enviando…». Sin JavaScript: el envío normal del navegador sigue funcionando (303).

const MAX_CV = 5 * 1024 * 1024;
type ErroresTodos = ErroresCampos & { cv?: string; autorizacion?: string };

const VACIO: ValoresFormulario = { nombres: "", apellidos: "", correo: "", indicativo: INDICATIVO_POR_DEFECTO, telefono: "", ciudad: "", perfil: "" };

function Obligatorio() {
  return (
    <span className="e-obligatorio" aria-hidden="true">
      {" "}
      *
    </span>
  );
}

function validarCv(archivo: File | null | undefined): string | null {
  if (!archivo || archivo.size === 0) return "Adjunta tu hoja de vida en PDF.";
  if (archivo.size > MAX_CV) return "El archivo supera el máximo de 5 MB.";
  if (!/\.pdf$/i.test(archivo.name) && archivo.type !== "application/pdf") return "El archivo debe ser un PDF.";
  return null;
}

export function FormularioPostulacion({ codigo, marca, errorInicial }: { codigo: string; marca: string; errorInicial: string | null }) {
  const [valores, setValores] = useState<ValoresFormulario>(VACIO);
  const [errores, setErrores] = useState<ErroresTodos>({});
  const [general, setGeneral] = useState<string | null>(errorInicial);
  const [enviando, setEnviando] = useState(false);
  const resumen = useRef<HTMLDivElement>(null);
  const formulario = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const accion = `/api/postular/${codigo}`;

  // Con JavaScript la validación es la de la página (mensajes en español junto a cada campo), no la del navegador.
  useEffect(() => formulario.current?.setAttribute("novalidate", ""), []);

  const cambiar = (campo: keyof ValoresFormulario) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const siguiente = { ...valores, [campo]: e.target.value };
    setValores(siguiente);
    // Si el campo ya mostraba un error, se revalida mientras se corrige.
    if (campo !== "indicativo" && errores[campo as CampoFormulario]) setErrores((x) => ({ ...x, [campo]: validarCampo(campo as CampoFormulario, siguiente) ?? undefined }));
    if (campo === "indicativo" && errores.telefono) setErrores((x) => ({ ...x, telefono: validarCampo("telefono", siguiente) ?? undefined }));
  };
  const salir = (campo: CampoFormulario) => () => setErrores((x) => ({ ...x, [campo]: validarCampo(campo, valores) ?? undefined }));

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (enviando) return;
    const form = e.currentTarget;
    const datos = new FormData(form);
    const v = validarFormulario(valores);
    const nuevos: ErroresTodos = v.ok ? {} : { ...v.errores };
    const cv = validarCv(datos.get("cv") as File | null);
    if (cv) nuevos.cv = cv;
    if (datos.get("autorizacion") !== "si") nuevos.autorizacion = MENSAJES_ERROR.consentimiento;
    setErrores(nuevos);
    if (Object.values(nuevos).some(Boolean)) {
      setGeneral(`Revisa ${Object.values(nuevos).filter(Boolean).length === 1 ? "el campo marcado" : "los campos marcados"}.`);
      requestAnimationFrame(() => resumen.current?.focus());
      return;
    }
    setGeneral(null);
    setEnviando(true);
    try {
      const r = await fetch(accion, { method: "POST", body: datos, headers: { Accept: "application/json" } });
      const cuerpo = (await r.json()) as { ok: boolean; referencia?: string; error?: string; mensaje?: string; campos?: ErroresCampos };
      if (cuerpo.ok && cuerpo.referencia) {
        router.push(`/postular/${codigo}/enviado?ref=${cuerpo.referencia}`);
        return;
      }
      if (cuerpo.error === "vacante") {
        router.refresh();
        return;
      }
      setErrores({
        ...(cuerpo.campos ?? {}),
        ...(cuerpo.error === "no_pdf" || cuerpo.error === "grande" || cuerpo.error === "sin_cv" ? { cv: cuerpo.mensaje } : {}),
        ...(cuerpo.error === "consentimiento" ? { autorizacion: cuerpo.mensaje } : {}),
      });
      setGeneral(cuerpo.mensaje ?? MENSAJES_ERROR.datos);
    } catch {
      setGeneral(MENSAJES_ERROR.red);
    }
    setEnviando(false);
    requestAnimationFrame(() => resumen.current?.focus());
  }

  const props = (campo: CampoFormulario) => ({
    id: campo,
    name: campo,
    value: valores[campo],
    onChange: cambiar(campo),
    onBlur: salir(campo),
    "aria-invalid": errores[campo] ? (true as const) : undefined,
    "aria-describedby": [errores[campo] ? `${campo}-error` : "", campo === "telefono" || campo === "perfil" ? `${campo}-ayuda` : ""].filter(Boolean).join(" ") || undefined,
  });
  const error = (campo: keyof ErroresTodos) =>
    errores[campo] ? (
      <p className="e-error" id={`${campo}-error`}>
        {errores[campo]}
      </p>
    ) : null;
  return (
    <form method="post" action={accion} encType="multipart/form-data" ref={formulario} onSubmit={enviar} aria-describedby="nota-obligatorios">
      <div ref={resumen} tabIndex={-1} role="alert" aria-live="assertive" className={general ? "e-resumen-error" : undefined} data-testid="error-formulario">
        {general}
      </div>
      <p className="empleo-nota" id="nota-obligatorios">
        Los campos con <span className="e-obligatorio">*</span> son obligatorios.
      </p>
      <input type="hidden" name="t" value={marca} />

      <div className="e-fila">
        <div className="e-campo">
          <label htmlFor="nombres">
            Nombres
            <Obligatorio />
          </label>
          <input type="text" autoComplete="given-name" maxLength={120} required {...props("nombres")} />
          {error("nombres")}
        </div>
        <div className="e-campo">
          <label htmlFor="apellidos">
            Apellidos
            <Obligatorio />
          </label>
          <input type="text" autoComplete="family-name" maxLength={120} required {...props("apellidos")} />
          {error("apellidos")}
        </div>
      </div>

      <div className="e-campo">
        <label htmlFor="correo">
          Correo
          <Obligatorio />
        </label>
        <input type="email" autoComplete="email" inputMode="email" maxLength={200} required {...props("correo")} />
        {error("correo")}
      </div>

      <div className="e-campo">
        <span className="e-etiqueta" id="telefono-etiqueta">
          Teléfono
          <Obligatorio />
        </span>
        <div className="e-telefono">
          <select name="indicativo" aria-label="Indicativo del país" value={valores.indicativo} onChange={cambiar("indicativo")} autoComplete="tel-country-code">
            {INDICATIVOS.map((i) => (
              <option key={i.valor} value={i.valor}>
                {i.valor} {i.pais}
              </option>
            ))}
          </select>
          <input type="tel" autoComplete="tel-national" inputMode="tel" maxLength={20} required aria-labelledby="telefono-etiqueta" {...props("telefono")} />
        </div>
        <p className="e-ayuda" id="telefono-ayuda">
          Sin el indicativo, por ejemplo 300 555 0142.
        </p>
        {error("telefono")}
      </div>

      <div className="e-campo">
        <label htmlFor="ciudad">
          Ciudad de residencia
          <Obligatorio />
        </label>
        <input type="text" autoComplete="address-level2" maxLength={100} required {...props("ciudad")} />
        {error("ciudad")}
      </div>

      <div className="e-campo">
        <label htmlFor="perfil">
          Perfil de LinkedIn <span className="e-opcional">(opcional)</span>
        </label>
        <input type="url" inputMode="url" autoComplete="url" maxLength={200} placeholder="https://www.linkedin.com/in/tu-nombre" {...props("perfil")} />
        <p className="e-ayuda" id="perfil-ayuda">
          La dirección completa de tu perfil público.
        </p>
        {error("perfil")}
      </div>

      <div className="e-campo">
        <label htmlFor="cv">
          Hoja de vida en PDF
          <Obligatorio />
        </label>
        <input
          id="cv"
          name="cv"
          type="file"
          accept="application/pdf,.pdf"
          required
          aria-invalid={errores.cv ? true : undefined}
          aria-describedby={["cv-ayuda", errores.cv ? "cv-error" : ""].filter(Boolean).join(" ")}
          onChange={(e) => setErrores((x) => ({ ...x, cv: validarCv(e.target.files?.[0]) ?? undefined }))}
        />
        <p className="e-ayuda" id="cv-ayuda">
          Un solo archivo PDF de máximo 5 MB.
        </p>
        {error("cv")}
      </div>

      {/* Campo trampa para robots: nombre neutro, oculto con CSS y para los lectores de pantalla. */}
      <div className="e-trampa" aria-hidden="true">
        <label htmlFor={CAMPO_TRAMPA}>No llenar</label>
        <input id={CAMPO_TRAMPA} name={CAMPO_TRAMPA} type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <div className="e-casilla">
        <input
          id="autorizacion"
          name="autorizacion"
          type="checkbox"
          value="si"
          required
          aria-invalid={errores.autorizacion ? true : undefined}
          aria-describedby={errores.autorizacion ? "autorizacion-error" : undefined}
          onChange={(e) => e.target.checked && setErrores((x) => ({ ...x, autorizacion: undefined }))}
        />
        <label htmlFor="autorizacion">
          Autorizo el tratamiento de mis datos personales según el{" "}
          <a href="/privacidad" target="_blank" rel="noopener">
            aviso de privacidad
          </a>
          .<Obligatorio />
        </label>
      </div>
      {error("autorizacion")}

      <button className="e-boton" type="submit" disabled={enviando} aria-busy={enviando || undefined}>
        {enviando ? "Enviando…" : "Enviar postulación"}
      </button>
    </form>
  );
}

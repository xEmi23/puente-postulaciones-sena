// Campos del formulario público y su validación (V4 F6). Sin dependencias del servidor: la usan la página (validación en
// línea) y el servidor (que nunca confía en el navegador). Minimización de datos: solo lo que una solicitud típica
// necesita para que el equipo de selección contacte y evalúe a la persona.

export const INDICATIVOS = [
  { valor: "+57", pais: "Colombia" },
  { valor: "+1", pais: "Estados Unidos / Canadá" },
  { valor: "+52", pais: "México" },
  { valor: "+51", pais: "Perú" },
  { valor: "+56", pais: "Chile" },
  { valor: "+54", pais: "Argentina" },
  { valor: "+593", pais: "Ecuador" },
  { valor: "+58", pais: "Venezuela" },
  { valor: "+507", pais: "Panamá" },
  { valor: "+506", pais: "Costa Rica" },
  { valor: "+34", pais: "España" },
] as const;
export const INDICATIVO_POR_DEFECTO = "+57";

export const MODALIDADES = ["Presencial", "Híbrido", "Remoto"] as const;
export const TIPOS_EMPLEO = ["Tiempo completo", "Medio tiempo", "Contrato temporal", "Prácticas"] as const;

/** Nombre del campo trampa: neutro, distinto de cualquier campo real; oculto con CSS y aria-hidden. */
export const CAMPO_TRAMPA = "campo_auxiliar";

export type CampoFormulario = "nombres" | "apellidos" | "correo" | "telefono" | "ciudad" | "perfil";
export type ValoresFormulario = Record<CampoFormulario | "indicativo", string>;
export type ErroresCampos = Partial<Record<CampoFormulario, string>>;

export interface DatosValidos {
  nombres: string;
  apellidos: string;
  correo: string;
  /** E.164 (indicativo + número). */
  telefono: string;
  ciudad: string;
  perfil?: string;
}

const limpio = (v: string) => v.replace(/\s+/g, " ").trim();

/** Teléfono a E.164 con el indicativo elegido: «+57» + «300 555 0142» → «+573005550142». */
export function telefonoE164(indicativo: string, numero: string): string | null {
  if (!INDICATIVOS.some((i) => i.valor === indicativo)) return null;
  const digitos = numero.replace(/[\s().\-/]/g, "");
  if (!/^\d{6,14}$/.test(digitos)) return null;
  const e164 = `${indicativo}${digitos}`;
  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

/** URL de un perfil de LinkedIn (https y dominio linkedin.com). Cabe en «Referencia externa» del ATS (≤ 200). */
export function perfilValido(v: string): boolean {
  if (v.length > 200) return false;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && (u.hostname === "linkedin.com" || u.hostname.endsWith(".linkedin.com")) && u.pathname.length > 1;
  } catch {
    return false;
  }
}

/** Valida un campo. Devuelve el mensaje de error o null. */
export function validarCampo(campo: CampoFormulario, v: ValoresFormulario): string | null {
  const valor = limpio(v[campo] ?? "");
  switch (campo) {
    case "nombres":
      return !valor ? "Escribe tus nombres." : valor.length > 120 ? "Máximo 120 caracteres." : null;
    case "apellidos":
      return !valor ? "Escribe tus apellidos." : valor.length > 120 ? "Máximo 120 caracteres." : null;
    case "correo":
      if (!valor) return "Escribe tu correo.";
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor) && valor.length <= 200 ? null : "Escribe un correo válido, por ejemplo nombre@correo.com.";
    case "telefono":
      if (!valor) return "Escribe tu teléfono.";
      return telefonoE164(v.indicativo, valor) ? null : "Escribe un teléfono válido (solo números, sin el indicativo).";
    case "ciudad":
      if (!valor) return "Escribe tu ciudad de residencia.";
      return valor.length < 2 || valor.length > 100 ? "Escribe una ciudad de 2 a 100 caracteres." : null;
    case "perfil":
      if (!valor) return null;
      return perfilValido(valor) ? null : "Escribe la dirección completa de tu perfil, por ejemplo https://www.linkedin.com/in/tu-nombre.";
  }
}

export const CAMPOS: CampoFormulario[] = ["nombres", "apellidos", "correo", "telefono", "ciudad", "perfil"];

export function validarFormulario(v: ValoresFormulario): { ok: true; datos: DatosValidos } | { ok: false; errores: ErroresCampos } {
  const errores: ErroresCampos = {};
  for (const c of CAMPOS) {
    const e = validarCampo(c, v);
    if (e) errores[c] = e;
  }
  if (Object.keys(errores).length) return { ok: false, errores };
  const perfil = limpio(v.perfil ?? "");
  return {
    ok: true,
    datos: {
      nombres: limpio(v.nombres),
      apellidos: limpio(v.apellidos),
      correo: limpio(v.correo).toLowerCase(),
      telefono: telefonoE164(v.indicativo, limpio(v.telefono))!,
      ciudad: limpio(v.ciudad),
      ...(perfil ? { perfil } : {}),
    },
  };
}

/** Mensajes de error generales del envío (los de cada campo salen de validarCampo). */
export const MENSAJES_ERROR: Record<string, string> = {
  limite: "Recibimos demasiados envíos desde tu conexión. Espera unos minutos y vuelve a intentarlo.",
  rapido: "El formulario se envió demasiado rápido. Revisa tus datos y vuelve a enviarlo.",
  datos: "Revisa los campos marcados.",
  consentimiento: "Para postularte debes autorizar el tratamiento de tus datos (marca la casilla).",
  sin_cv: "Adjunta tu hoja de vida en PDF.",
  no_pdf: "El archivo no es un PDF válido. Adjunta tu hoja de vida en formato PDF.",
  grande: "El archivo supera el máximo de 5 MB.",
  vacante: "Esta vacante ya no recibe postulaciones.",
  red: "No pudimos enviar tu postulación. Revisa tu conexión y vuelve a intentarlo.",
};

export const formatoReferencia = /^[A-Z0-9]{8}$/;

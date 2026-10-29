import type { EstadoRecepcion, PasoRecepcion } from "@/generated/prisma/client";

// Textos en español comprensible para el panel. Cada error dice qué pasó y qué hacer.

export const ETIQUETA_ESTADO: Record<EstadoRecepcion, string> = {
  RECIBIDO: "Recibido",
  PROCESANDO: "Procesando",
  COMPLETADO: "Completado",
  RECHAZADO: "Rechazado",
  FALLIDO_REINTENTABLE: "Fallido (reintentable)",
  REQUIERE_VERIFICACION: "Requiere verificación",
};

export const ETIQUETA_PASO: Record<PasoRecepcion, string> = {
  cv_descargado: "CV descargado",
  candidato_creado: "Candidato creado",
  documento_subido: "Documento subido",
  postulacion_creada: "Postulación creada",
};

export const PASOS: PasoRecepcion[] = ["cv_descargado", "candidato_creado", "documento_subido", "postulacion_creada"];

interface Explicacion {
  que: string;
  hacer: string;
}

const ERRORES: Record<string, Explicacion> = {
  JOB_POSTING_CLOSED: {
    que: "La vacante no está vinculada a ningún proceso del ATS o la vinculación está desactivada.",
    hacer: "Revisa la pantalla de correspondencias. El puente no adivina el proceso.",
  },
  CV_INVALIDO: { que: "El archivo del CV no es un PDF válido.", hacer: "No se puede corregir desde el puente; el postulante debe enviar un PDF." },
  CV_DEMASIADO_GRANDE: { que: "El CV supera el tamaño máximo permitido.", hacer: "No se reintenta. Revisa el límite CV_MAX_BYTES si es correcto." },
  CV_NO_DISPONIBLE: { que: "El enlace del CV expiró o ya no existe en el origen.", hacer: "No se reintenta. Los enlaces duran 30 días." },
  CV_URL_NO_PERMITIDA: { que: "El enlace del CV no pertenece al origen autorizado o intentó redirigir.", hacer: "Posible manipulación: no se descarga." },
  CV_TRANSFERENCIA_INCOMPLETA: {
    que: "La descarga o la subida del CV quedó incompleta (el tamaño o el SHA-256 no coinciden).",
    hacer: "Se reintenta automáticamente; no queda documento corrupto en el ATS.",
  },
  ORIGEN_NO_DISPONIBLE: { que: "El origen no respondió al descargar el CV.", hacer: "Se reintenta automáticamente con espera creciente." },
  ORIGEN_AUTENTICACION: {
    que: "Vínculo rechazó las credenciales del puente al descargar el CV.",
    hacer: "Revisa el Client ID y el Client Secret de Vínculo. No se reintenta solo; luego usa «Reintentar».",
  },
  ATS_NO_DISPONIBLE: { que: "El ATS no estaba disponible.", hacer: "Se reintenta automáticamente con espera creciente; el progreso por paso se conserva." },
  ATS_SIN_RESPUESTA: {
    que: "El ATS no respondió al crear la postulación: no se sabe si quedó creada.",
    hacer: "Antes de volver a escribir, el puente consulta al ATS por la referencia externa (reconciliación).",
  },
  ATS_AUTENTICACION: {
    que: "El ATS rechazó las credenciales del puente.",
    hacer: "Revisa ATS_API_KEY del puente. No se reintenta solo para no insistir con credenciales malas; corrígelas y usa «Reintentar».",
  },
  ATS_PROCESO_CERRADO: { que: "El proceso del ATS está cerrado.", hacer: "Reabre el proceso o cambia la correspondencia." },
  ATS_PROCESO_NO_EXISTE: { que: "El proceso vinculado no existe en el ATS.", hacer: "Corrige la correspondencia de la vacante." },
  ATS_VALIDACION: { que: "El ATS rechazó los datos enviados.", hacer: "Revisa el detalle técnico." },
  ERROR_INTERNO: { que: "Error inesperado en el puente.", hacer: "Se reintenta automáticamente. Si persiste, revisa los registros del worker." },
};

export function explicarError(codigo: string | null | undefined): Explicacion | null {
  if (!codigo) return null;
  return ERRORES[codigo] ?? { que: `Error ${codigo}.`, hacer: "Revisa el detalle técnico." };
}

export const ETIQUETA_RECHAZO_ENTRADA: Record<string, string> = {
  SIGNATURE_MISMATCH: "Firma inválida",
  MISSING_REQUIRED_RESPONSE: "Faltan datos obligatorios",
  INPUT_VALIDATION_FAILED: "Datos con formato inválido",
  JOB_POSTING_CLOSED: "Vacante sin correspondencia o cerrada",
};

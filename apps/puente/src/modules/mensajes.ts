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
  postulante_listo: "Postulante listo",
  documento_subido: "Documento subido",
  postulacion_creada: "Postulación creada",
};

export const PASOS: PasoRecepcion[] = ["cv_descargado", "postulante_listo", "documento_subido", "postulacion_creada"];

export const ETIQUETA_AVISO: Record<string, string> = {
  NO_APLICA: "—",
  PENDIENTE: "Pendiente",
  ENVIADO: "Enviado",
  FALLIDO: "Fallido",
};

interface Explicacion {
  que: string;
  hacer: string;
}

const ERRORES: Record<string, Explicacion> = {
  JOB_POSTING_CLOSED: {
    que: "La vacante no tiene un proceso de Talentia asociado, se cerró antes de la postulación o está desvinculada.",
    hacer: "Revisa «Procesos» (publicaciones) y «Correspondencias». El puente no adivina el proceso.",
  },
  PUENTE_SIN_CONEXION: { que: "Falta configurar la conexión con Vínculo o con Talentia.", hacer: "Configúrala en «Conexiones» y luego usa «Reintentar»." },
  CV_INVALIDO: { que: "El archivo del CV no es un PDF válido.", hacer: "No se puede corregir desde el puente; el postulante debe enviar un PDF." },
  CV_DEMASIADO_GRANDE: { que: "El CV supera el tamaño máximo permitido.", hacer: "No se reintenta. Revisa el límite CV_MAX_BYTES si es correcto." },
  CV_NO_DISPONIBLE: { que: "El enlace del CV venció o ya no existe en Vínculo.", hacer: "No se reintenta. Los enlaces duran 30 días." },
  CV_URL_NO_PERMITIDA: { que: "El enlace del CV no pertenece a la URL de Vínculo configurada o intentó redirigir.", hacer: "Posible manipulación: no se descarga." },
  CV_TRANSFERENCIA_INCOMPLETA: {
    que: "La descarga o la subida del CV quedó incompleta (el tamaño o el SHA-256 no coinciden).",
    hacer: "Se reintenta automáticamente; no queda documento corrupto en Talentia.",
  },
  ORIGEN_NO_DISPONIBLE: { que: "Vínculo no respondió al descargar el CV.", hacer: "Se reintenta automáticamente con espera creciente (cubre el arranque en frío)." },
  ORIGEN_AUTENTICACION: {
    que: "Vínculo rechazó las credenciales del puente.",
    hacer: "Revisa el Client ID y el Client Secret en «Conexiones» (¿se regeneró el secreto?). No se reintenta solo; luego usa «Reintentar».",
  },
  ATS_NO_DISPONIBLE: { que: "Talentia no estaba disponible.", hacer: "Se reintenta automáticamente con espera creciente; el progreso por paso se conserva." },
  ATS_LIMITE: { que: "Talentia limitó las solicitudes (429).", hacer: "Se reintenta solo cuando Talentia lo indica (Retry-After)." },
  ATS_SIN_RESPUESTA: {
    que: "Talentia no respondió al crear la postulación: no se sabe si quedó creada.",
    hacer: "Antes de volver a escribir, el puente consulta a Talentia por la referencia externa (reconciliación).",
  },
  ATS_AUTENTICACION: {
    que: "La API Key de Talentia fue revocada o no es válida.",
    hacer: "Crea una llave nueva en Talentia (Administración → API Keys), guárdala en «Conexiones» y usa «Reintentar». No se reintenta solo para no insistir con una llave mala.",
  },
  ATS_PERMISO: {
    que: "La API Key de Talentia no tiene el permiso necesario (Selección: Lectura y Modificación).",
    hacer: "Crea una llave con ambos permisos y guárdala en «Conexiones»; luego usa «Reintentar».",
  },
  ATS_PROCESO_CERRADO: { que: "El proceso de Talentia está cerrado.", hacer: "Reabre el proceso o cambia la correspondencia." },
  ATS_PROCESO_NO_EXISTE: { que: "El proceso vinculado no existe en Talentia.", hacer: "Corrige la publicación o la correspondencia de la vacante." },
  ATS_VALIDACION: { que: "Talentia rechazó los datos enviados.", hacer: "Revisa el detalle técnico." },
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
  JOB_POSTING_CLOSED: "Vacante sin proceso o cerrada",
  TRANSIENT_ERROR: "Puente sin conexión configurada",
};

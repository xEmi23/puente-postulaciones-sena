// Estado V4 visible de una recepción (ESPECIFICACION_V4 §7), derivado de los estados guardados (D-52).

export type EstadoV4 =
  | "RECIBIDA"
  | "REQUIERE_REVISION"
  | "EN_PROCESO"
  | "COMPLETADA"
  | "FALLIDA_REINTENTABLE"
  | "FALLIDA_DEFINITIVA"
  | "REQUIERE_VERIFICACION";

export function estadoV4(estado: string, estadoTrabajo?: string | null): EstadoV4 {
  switch (estado) {
    case "RECIBIDO":
      return "RECIBIDA";
    case "PROCESANDO":
      return "EN_PROCESO";
    case "COMPLETADO":
      return "COMPLETADA";
    case "RECHAZADO":
      return "FALLIDA_DEFINITIVA";
    case "FALLIDO_REINTENTABLE":
      return estadoTrabajo === "DETENIDO" ? "FALLIDA_DEFINITIVA" : "FALLIDA_REINTENTABLE";
    case "REQUIERE_REVISION":
      return "REQUIERE_REVISION";
    case "REQUIERE_VERIFICACION":
      return "REQUIERE_VERIFICACION";
    default:
      return "RECIBIDA";
  }
}

export const ETIQUETA_ESTADO_V4: Record<EstadoV4, string> = {
  RECIBIDA: "Recibida",
  REQUIERE_REVISION: "Requiere revisión",
  EN_PROCESO: "En proceso",
  COMPLETADA: "Completada",
  FALLIDA_REINTENTABLE: "Fallida (se reintenta)",
  FALLIDA_DEFINITIVA: "Fallida (definitiva)",
  REQUIERE_VERIFICACION: "Requiere verificación",
};

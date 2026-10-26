// Atributos de un proceso tal como se ven en el ATS de la empresa (docs/referencia-ats.md):
// identificador, título, prioridad, fecha de inicio, vigencia y estado («Iniciado»).

export const PRIORIDADES = ["Alta", "Media", "Baja"] as const;
export type Prioridad = (typeof PRIORIDADES)[number];

export const ESTADO_INICIADO = "INICIADO";

const ETIQUETA_ESTADO: Record<string, string> = { INICIADO: "Iniciado", CERRADO: "Cerrado" };

export function etiquetaEstadoProceso(estado: string): string {
  return ETIQUETA_ESTADO[estado] ?? estado;
}

/** Vigencia: días completos transcurridos desde la fecha de inicio (0 si empieza hoy o en el futuro). */
export function vigenciaDias(fechaInicio: Date, ahora: Date = new Date()): number {
  return Math.max(0, Math.floor((ahora.getTime() - fechaInicio.getTime()) / 86_400_000));
}

export function textoVigencia(dias: number): string {
  return dias === 1 ? "1 día" : `${dias} días`;
}

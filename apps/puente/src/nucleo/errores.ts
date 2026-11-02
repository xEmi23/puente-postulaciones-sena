// Error de procesamiento del núcleo: cada adaptador lo lanza con un código visible y el modo en que debe terminar el
// intento (rechazar = definitivo, reintentar = temporal, detener = espera a una persona).

export type ModoFallo = "rechazar" | "reintentar" | "detener";

export class ErrorProcesamiento extends Error {
  constructor(
    public codigo: string,
    message: string,
    public modo: ModoFallo,
    /** Espera mínima antes del próximo intento (p. ej., Retry-After de un 429). */
    public esperaMinimaMs = 0,
  ) {
    super(message);
    this.name = "ErrorProcesamiento";
  }
}

// Límite de 60 peticiones por minuto por token (ESPECIFICACION_V4 §8.1), en memoria del proceso.
// Limitación conocida: con varias instancias del Puente cada una cuenta por su lado (el límite efectivo se multiplica
// por el número de instancias). En Render gratuito hay una sola instancia. Para varias, mover el contador a PostgreSQL
// (como LimiteTasa de Talentia).

export const LIMITE_POR_MINUTO = () => Number(process.env.PUENTE_ENTRADA_LIMITE_POR_MINUTO ?? 60);

const ventanas = new Map<string, { inicio: number; usadas: number }>();

/** Devuelve null si se permite, o los segundos que faltan para la siguiente ventana. */
export function consumirCupo(clave: string, ahora = Date.now()): number | null {
  const v = ventanas.get(clave);
  if (!v || ahora - v.inicio >= 60_000) {
    ventanas.set(clave, { inicio: ahora, usadas: 1 });
    return null;
  }
  if (v.usadas >= LIMITE_POR_MINUTO()) return Math.max(1, Math.ceil((v.inicio + 60_000 - ahora) / 1000));
  v.usadas++;
  return null;
}

/** Solo pruebas. */
export function reiniciarCupos() {
  ventanas.clear();
}

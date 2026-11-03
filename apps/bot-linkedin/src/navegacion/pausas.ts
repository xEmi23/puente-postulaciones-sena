// Pausas entre acciones (§8.3): espera aleatoria entre BOT_PAUSA_MIN_MS y BOT_PAUSA_MAX_MS. El reloj y el azar se
// inyectan para probar los límites sin esperar de verdad.

export interface Reloj {
  dormir(ms: number): Promise<void>;
  azar(): number;
}

export const relojReal: Reloj = {
  dormir: (ms) => new Promise((ok) => setTimeout(ok, ms)),
  azar: Math.random,
};

export function crearPausa(min: number, max: number, reloj: Reloj = relojReal) {
  return async () => {
    const ms = Math.round(min + reloj.azar() * (max - min));
    await reloj.dormir(ms);
    return ms;
  };
}

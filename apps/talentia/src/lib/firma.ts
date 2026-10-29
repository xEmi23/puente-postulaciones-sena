import { createHmac, timingSafeEqual } from "node:crypto";

// Decisión interna (docs/contratos.md §Firma): seguimos la guía compartida de webhooks de LinkedIn.
//   stringToSign   = "hmacsha256=" + cuerpo crudo
//   X-LI-Signature = hex en minúsculas de HMAC-SHA256(stringToSign, clientSecret)
// El header lleva solo el hex. La comparación es en tiempo constante y sobre el cuerpo crudo.
export const PREFIJO_FIRMA = "hmacsha256=";
export const HEADER_FIRMA = "x-li-signature";

export function firmarCuerpo(cuerpoCrudo: string, secreto: string): string {
  return createHmac("sha256", secreto).update(PREFIJO_FIRMA + cuerpoCrudo, "utf8").digest("hex");
}

export function firmaValida(cuerpoCrudo: string, firmaRecibida: string | null | undefined, secreto: string): boolean {
  if (!firmaRecibida || !/^[0-9a-fA-F]{64}$/.test(firmaRecibida)) return false;
  const esperada = Buffer.from(firmarCuerpo(cuerpoCrudo, secreto), "hex");
  const recibida = Buffer.from(firmaRecibida.toLowerCase(), "hex");
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
}

/** challengeResponse = hex(HMAC-SHA256(challengeCode, clientSecret)). */
export function respuestaDesafio(challengeCode: string, secreto: string): string {
  return createHmac("sha256", secreto).update(challengeCode, "utf8").digest("hex");
}

/** Comparación en tiempo constante de dos cadenas (tokens Bearer, claves de API). */
export function igualesSeguro(a: string, b: string): boolean {
  const ha = createHmac("sha256", "cmp").update(a).digest();
  const hb = createHmac("sha256", "cmp").update(b).digest();
  return timingSafeEqual(ha, hb);
}

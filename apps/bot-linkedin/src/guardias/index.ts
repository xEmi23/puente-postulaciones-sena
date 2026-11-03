import type { Bloqueo, PerfilSitio } from "../sitios/tipos";

// Guardias (ESPECIFICACION_V4 §8.3): ante cualquier verificación, captcha, advertencia o sesión cerrada, el bot se
// DETIENE y pide a una persona. Nunca intenta resolver ni evadir nada.

export const MENSAJE_INTERVENCION = "Se requiere intervención humana";

export class ErrorIntervencionHumana extends Error {
  constructor(public bloqueo: Bloqueo) {
    super(`${MENSAJE_INTERVENCION}: ${bloqueo.detalle}`);
    this.name = "ErrorIntervencionHumana";
  }
}

// Señales genéricas de verificación, válidas para cualquier sitio (en minúsculas, sin tildes).
const SENALES_VERIFICACION = [
  "captcha",
  "recaptcha",
  "hcaptcha",
  "verificacion de seguridad",
  "verifica que eres una persona",
  "confirma que eres humano",
  "verify you are human",
  "security verification",
  "security check",
  "unusual activity",
  "actividad inusual",
  "cuenta restringida",
  "account restricted",
  "challenge-form",
];

const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Bloqueo genérico (verificación o captcha) o el propio del sitio (p. ej., la pantalla de ingreso). */
export function detectarBloqueo(perfil: PerfilSitio, html: string, url: string): Bloqueo | null {
  const propio = perfil.detectarBloqueo(html, url);
  if (propio && propio.tipo !== "pagina_inesperada") return propio;
  // Una verificación también es una «página inesperada» para el sitio: se informa como verificación, que es más claro.
  const t = normalizar(html);
  const senal = SENALES_VERIFICACION.find((s) => t.includes(s));
  if (senal) return { tipo: "verificacion", detalle: `el sitio muestra una verificación («${senal}»). Resuélvela tú en la ventana y vuelve a ejecutar el bot.` };
  return propio;
}

/** Lanza ErrorIntervencionHumana si la página bloquea. */
export function exigirSinBloqueo(perfil: PerfilSitio, html: string, url: string) {
  const b = detectarBloqueo(perfil, html, url);
  if (b) throw new ErrorIntervencionHumana(b);
}

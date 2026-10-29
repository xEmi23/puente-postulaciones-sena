// Autenticación de DEMOSTRACIÓN de este sistema (cookie propia: en localhost las cookies no se separan por puerto).
// Usa Web Crypto para funcionar igual en el proxy y en el servidor.
// No puede quedar activa por accidente en un entorno real (D-12): exige DEMO_AUTH_ENABLED=true,
// credenciales y secreto suficientemente largos, y APP_BASE_URL local. Si falta algo, el panel queda CERRADO.

export const COOKIE_SESION = "vin_sesion";
const DURACION_S = 8 * 3600;

export type MotivoNoDisponible = "desactivada" | "incompleta" | "no_local";

export function estadoAuthDemo(env: Record<string, string | undefined> = process.env): { disponible: true } | { disponible: false; motivo: MotivoNoDisponible } {
  if (env.DEMO_AUTH_ENABLED !== "true") return { disponible: false, motivo: "desactivada" };
  if (!env.DEMO_ADMIN_USER || (env.DEMO_ADMIN_PASSWORD?.length ?? 0) < 12 || (env.SESSION_SECRET?.length ?? 0) < 32) {
    return { disponible: false, motivo: "incompleta" };
  }
  let host = "";
  try {
    host = new URL(env.APP_BASE_URL ?? "").hostname;
  } catch {
    return { disponible: false, motivo: "no_local" };
  }
  const local = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(host) || host.endsWith(".test");
  return local ? { disponible: true } : { disponible: false, motivo: "no_local" };
}

const codificador = new TextEncoder();

async function firmar(datos: string, secreto: string): Promise<string> {
  const clave = await crypto.subtle.importKey("raw", codificador.encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const firma = await crypto.subtle.sign("HMAC", clave, codificador.encode(datos));
  return Array.from(new Uint8Array(firma), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparación en tiempo constante de dos cadenas hexadecimales. */
function igualesHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

export async function crearTokenSesion(usuario: string, ahora = Date.now()): Promise<string> {
  const exp = Math.floor(ahora / 1000) + DURACION_S;
  const datos = `${encodeURIComponent(usuario)}.${exp}`;
  return `${datos}.${await firmar(datos, process.env.SESSION_SECRET!)}`;
}

export async function tokenValido(token: string | undefined, ahora = Date.now()): Promise<boolean> {
  if (!token || !estadoAuthDemo().disponible) return false;
  const partes = token.split(".");
  if (partes.length !== 3) return false;
  const [usuario, exp, firma] = partes;
  if (!/^\d+$/.test(exp) || Number(exp) * 1000 < ahora) return false;
  if (decodeURIComponent(usuario) !== process.env.DEMO_ADMIN_USER) return false;
  return igualesHex(await firmar(`${usuario}.${exp}`, process.env.SESSION_SECRET!), firma);
}

/** Verifica usuario y contraseña de demo comparando huellas HMAC (tiempo constante). */
export async function credencialesValidas(usuario: string, clave: string): Promise<boolean> {
  if (!estadoAuthDemo().disponible) return false;
  const s = process.env.SESSION_SECRET!;
  const [a, b, c, d] = await Promise.all([
    firmar(usuario, s),
    firmar(process.env.DEMO_ADMIN_USER!, s),
    firmar(clave, s),
    firmar(process.env.DEMO_ADMIN_PASSWORD!, s),
  ]);
  return igualesHex(a, b) && igualesHex(c, d);
}

export const DURACION_SESION_S = DURACION_S;

/** Solo rutas internas relativas (evita redirecciones abiertas). */
export function destinoSeguro(siguiente: string | null | undefined): string {
  if (!siguiente || !siguiente.startsWith("/") || siguiente.startsWith("//") || siguiente.startsWith("/\\")) return "/admin";
  return siguiente;
}

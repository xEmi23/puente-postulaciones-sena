import { z } from "zod";
import { prisma } from "@/lib/db";
import { cifrar, descifrar } from "@/lib/cifrado";
import { motivoUrlNoPermitida } from "@/lib/red";

// Conexiones del puente con Vínculo y Talentia, configuradas en /conexiones (no en variables de entorno, §6).
// Los secretos se guardan cifrados y solo se muestran como ••••abcd.

export type TipoConexion = "VINCULO" | "TALENTIA";

export interface ConexionVinculo {
  urlBase: string;
  clientId: string;
  clientSecret: string;
  empresaId: string | null;
  empresaNombre: string | null;
}
export interface ConexionTalentia {
  urlBase: string;
  apiKey: string;
}

const limpiarUrl = (u: string) => u.trim().replace(/\/+$/, "");
export const enmascarar = (final: string | null | undefined) => (final ? `••••${final}` : "");

export async function conexionVinculo(): Promise<ConexionVinculo | null> {
  const c = await prisma.conexion.findUnique({ where: { tipo: "VINCULO" } });
  if (!c?.clientId) return null;
  return { urlBase: c.urlBase, clientId: c.clientId, clientSecret: descifrar(c.secretoCifrado), empresaId: c.empresaId, empresaNombre: c.empresaNombre };
}

export async function conexionTalentia(): Promise<ConexionTalentia | null> {
  const c = await prisma.conexion.findUnique({ where: { tipo: "TALENTIA" } });
  if (!c) return null;
  return { urlBase: c.urlBase, apiKey: descifrar(c.secretoCifrado) };
}

const url = z.string().trim().min(1, "Escribe la URL base.").pipe(z.url({ protocol: /^https?$/, error: "Escribe una URL http(s) válida, por ejemplo https://vinculo.onrender.com." }));

const esquemaVinculo = z.object({
  urlBase: url,
  clientId: z.string().trim().min(4, "Escribe el Client ID."),
  clientSecret: z.string().trim().optional(),
});
const esquemaTalentia = z.object({ urlBase: url, apiKey: z.string().trim().optional() });

export type ResultadoGuardar = { ok: true } | { ok: false; error: string };

async function validarUrl(u: string): Promise<string | null> {
  const motivo = await motivoUrlNoPermitida(u);
  return motivo ? `URL no permitida: ${motivo}` : null;
}

/** Guarda la conexión con Vínculo. Si no se envía un secreto nuevo, conserva el guardado. */
export async function guardarVinculo(entrada: unknown): Promise<ResultadoGuardar> {
  const r = esquemaVinculo.safeParse(entrada);
  if (!r.success) return { ok: false, error: r.error.issues[0].message };
  const urlBase = limpiarUrl(r.data.urlBase);
  const motivo = await validarUrl(urlBase);
  if (motivo) return { ok: false, error: motivo };
  const actual = await prisma.conexion.findUnique({ where: { tipo: "VINCULO" } });
  const secreto = r.data.clientSecret || null;
  if (!secreto && !actual) return { ok: false, error: "Escribe el Client Secret." };
  const cambioIdentidad = !actual || actual.urlBase !== urlBase || actual.clientId !== r.data.clientId || !!secreto;
  const datos = {
    urlBase,
    clientId: r.data.clientId,
    ...(secreto ? { secretoCifrado: cifrar(secreto), secretoFinal: secreto.slice(-4) } : {}),
    // Otra aplicación u otro secreto: hay que volver a probar y a elegir la empresa.
    ...(cambioIdentidad ? { estadoPrueba: "SIN_PROBAR", detallePrueba: null, empresaId: null, empresaNombre: null, webhookValidadoEn: null } : {}),
  };
  if (actual) await prisma.conexion.update({ where: { tipo: "VINCULO" }, data: datos });
  else await prisma.conexion.create({ data: { tipo: "VINCULO", ...datos, secretoCifrado: cifrar(secreto!), secretoFinal: secreto!.slice(-4) } });
  return { ok: true };
}

export async function guardarTalentia(entrada: unknown): Promise<ResultadoGuardar> {
  const r = esquemaTalentia.safeParse(entrada);
  if (!r.success) return { ok: false, error: r.error.issues[0].message };
  const urlBase = limpiarUrl(r.data.urlBase);
  const motivo = await validarUrl(urlBase);
  if (motivo) return { ok: false, error: motivo };
  const actual = await prisma.conexion.findUnique({ where: { tipo: "TALENTIA" } });
  const llave = r.data.apiKey || null;
  if (!llave && !actual) return { ok: false, error: "Escribe la API Key del Simulador BUK." };
  const datos = {
    urlBase,
    ...(llave ? { secretoCifrado: cifrar(llave), secretoFinal: llave.slice(-4) } : {}),
    ...(llave || actual?.urlBase !== urlBase ? { estadoPrueba: "SIN_PROBAR", detallePrueba: null, permisoLectura: null, permisoEscritura: null } : {}),
  };
  if (actual) await prisma.conexion.update({ where: { tipo: "TALENTIA" }, data: datos });
  else await prisma.conexion.create({ data: { tipo: "TALENTIA", ...datos, secretoCifrado: cifrar(llave!), secretoFinal: llave!.slice(-4) } });
  return { ok: true };
}

export async function desconectar(tipo: TipoConexion) {
  await prisma.conexion.deleteMany({ where: { tipo } });
}

export async function marcarPrueba(tipo: TipoConexion, ok: boolean, detalle: string, extra: Record<string, unknown> = {}) {
  await prisma.conexion.updateMany({ where: { tipo }, data: { estadoPrueba: ok ? "OK" : "FALLIDA", detallePrueba: detalle, probadaEn: new Date(), ...extra } });
}

/** Cada respuesta del sistema remoto se anota: sirve para saber si probablemente esté dormido (Render gratuito). */
export async function marcarContacto(tipo: TipoConexion) {
  await prisma.conexion.updateMany({ where: { tipo }, data: { ultimoContactoEn: new Date() } });
}

const DORMIDO_TRAS_MS = 10 * 60_000;

/**
 * Tiempo de espera por llamada: 75 s si el sistema no ha respondido en los últimos 10 minutos (en Render gratuito
 * puede estar despertando, cerca de un minuto), 20 s en otro caso (§6). PUENTE_TIMEOUT_MS lo fija para pruebas.
 */
export async function tiempoDeEspera(tipo: TipoConexion): Promise<number> {
  if (process.env.PUENTE_TIMEOUT_MS) return Number(process.env.PUENTE_TIMEOUT_MS);
  const c = await prisma.conexion.findUnique({ where: { tipo }, select: { ultimoContactoEn: true } });
  const dormido = !c?.ultimoContactoEn || Date.now() - c.ultimoContactoEn.getTime() > DORMIDO_TRAS_MS;
  return dormido ? 75_000 : 20_000;
}

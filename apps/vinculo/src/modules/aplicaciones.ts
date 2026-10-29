import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { cifrar, descifrar } from "@/lib/cifrado";
import { respuestaDesafio, igualesSeguro } from "@/lib/firma";
import { motivoUrlNoPermitida } from "@/lib/red";
import { fetchSaliente } from "@/lib/salida";
import type { AplicacionDev } from "@/generated/prisma/client";

// Aplicaciones del portal de desarrolladores (como las apps de un socio de Apply Connect).
// El Client Secret se muestra una sola vez al crearlo o regenerarlo y se guarda cifrado (D-31).

export const nuevoClientId = () => `vin_${randomBytes(8).toString("hex")}`;
export const nuevoClientSecret = () => randomBytes(32).toString("base64url");

export const esquemaAplicacion = z.object({
  nombre: z.string().trim().min(3, "El nombre debe tener al menos 3 caracteres.").max(60, "Máximo 60 caracteres."),
  webhookUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => v || undefined),
});

export function secretoDe(app: Pick<AplicacionDev, "secretoCifrado">): string {
  return descifrar(app.secretoCifrado);
}

/** Compara un Client Secret presentado con el guardado (tiempo constante). */
export function secretoCorrecto(app: Pick<AplicacionDev, "secretoCifrado">, presentado: string): boolean {
  return igualesSeguro(secretoDe(app), presentado);
}

export async function crearAplicacion(propietarioId: string, entrada: unknown, opciones: { clientSecret?: string; clientId?: string; demo?: boolean } = {}) {
  const r = esquemaAplicacion.safeParse(entrada);
  if (!r.success) return { ok: false as const, error: r.error.issues[0].message };
  const clientSecret = opciones.clientSecret ?? nuevoClientSecret();
  const app = await prisma.aplicacionDev.create({
    data: { id: randomUUID(), nombre: r.data.nombre, clientId: opciones.clientId ?? nuevoClientId(), secretoCifrado: cifrar(clientSecret), propietarioId, demo: opciones.demo ?? false },
  });
  let validacion: ResultadoValidacion | null = null;
  if (r.data.webhookUrl) validacion = await registrarWebhook(app.id, r.data.webhookUrl);
  return { ok: true as const, app, clientSecret, validacion };
}

/** Nuevo Client Secret: el anterior deja de valer y los tokens emitidos con él también (secretoVersion). */
export async function regenerarSecreto(appId: string) {
  const clientSecret = nuevoClientSecret();
  await prisma.aplicacionDev.update({ where: { id: appId }, data: { secretoCifrado: cifrar(clientSecret), secretoVersion: { increment: 1 } } });
  return clientSecret;
}

export async function revocarAplicacion(appId: string) {
  await prisma.aplicacionDev.update({ where: { id: appId }, data: { revocadaEn: new Date(), secretoVersion: { increment: 1 } } });
}

export interface ResultadoValidacion {
  ok: boolean;
  detalle: string;
}

/**
 * Validación del webhook por desafío (docs/contratos.md, F2): GET {url}?challengeCode=<uuid>&applicationId=<clientId>.
 * Se espera 200 con JSON { challengeCode, challengeResponse = hex(HMAC-SHA256(challengeCode, clientSecret)) } en menos de 3 s.
 */
export async function validarWebhook(url: string, app: Pick<AplicacionDev, "clientId" | "secretoCifrado">, fetchImpl: typeof fetch = fetchSaliente()): Promise<ResultadoValidacion> {
  const motivo = await motivoUrlNoPermitida(url);
  if (motivo) return { ok: false, detalle: motivo };
  const challengeCode = randomUUID();
  const destino = new URL(url);
  destino.searchParams.set("challengeCode", challengeCode);
  destino.searchParams.set("applicationId", app.clientId);
  let r: Response;
  try {
    r = await fetchImpl(destino, { redirect: "manual", signal: AbortSignal.timeout(Number(process.env.VINCULO_TIMEOUT_DESAFIO_MS ?? 3000)) });
  } catch (e) {
    const nombre = e instanceof Error ? e.name : "";
    return { ok: false, detalle: nombre === "TimeoutError" ? "El webhook no respondió en 3 segundos." : "No fue posible conectar con el webhook." };
  }
  if (r.status !== 200) return { ok: false, detalle: `El webhook respondió HTTP ${r.status} (se espera 200).` };
  let cuerpo: { challengeCode?: unknown; challengeResponse?: unknown };
  try {
    cuerpo = await r.json();
  } catch {
    return { ok: false, detalle: "La respuesta del webhook no es JSON." };
  }
  if (cuerpo.challengeCode !== challengeCode) return { ok: false, detalle: "El webhook no devolvió el mismo challengeCode." };
  if (typeof cuerpo.challengeResponse !== "string" || !igualesSeguro(cuerpo.challengeResponse, respuestaDesafio(challengeCode, secretoDe(app)))) {
    return { ok: false, detalle: "challengeResponse no coincide: el webhook no conoce el Client Secret de esta aplicación." };
  }
  return { ok: true, detalle: "El webhook respondió el desafío correctamente." };
}

/** Guarda la URL del webhook y la valida en el momento (el resultado queda visible para el desarrollador y la empresa). */
export async function registrarWebhook(appId: string, url: string, fetchImpl?: typeof fetch): Promise<ResultadoValidacion> {
  const app = await prisma.aplicacionDev.findUniqueOrThrow({ where: { id: appId } });
  const v = await validarWebhook(url, app, fetchImpl);
  await prisma.aplicacionDev.update({
    where: { id: appId },
    data: { webhookUrl: url, webhookEstado: v.ok ? "VALIDADO" : "FALLIDO", webhookValidadoEn: v.ok ? new Date() : app.webhookValidadoEn, webhookDetalle: v.detalle },
  });
  return v;
}

/** ¿La empresa autorizó (y no revocó) a esta aplicación? */
export async function aplicacionAutorizada(aplicacionId: string, empresaId: string) {
  const a = await prisma.autorizacionEmpresa.findUnique({ where: { empresaId_aplicacionId: { empresaId, aplicacionId } } });
  return !!a && !a.revocadaEn;
}

/** «Conectar ATS»: la empresa autoriza a la aplicación indicada por su Client ID. */
export async function autorizarAplicacion(empresaId: string, clientId: string, autorizadaPorId: string) {
  const app = await prisma.aplicacionDev.findUnique({ where: { clientId: clientId.trim() } });
  if (!app || app.revocadaEn) return { ok: false as const, error: "No existe una aplicación activa con ese Client ID." };
  await prisma.autorizacionEmpresa.upsert({
    where: { empresaId_aplicacionId: { empresaId, aplicacionId: app.id } },
    create: { empresaId, aplicacionId: app.id, autorizadaPorId },
    update: { revocadaEn: null, autorizadaPorId, creadaEn: new Date() },
  });
  return { ok: true as const, app };
}

export async function revocarAutorizacion(empresaId: string, aplicacionId: string) {
  await prisma.autorizacionEmpresa.updateMany({ where: { empresaId, aplicacionId, revocadaEn: null }, data: { revocadaEn: new Date() } });
}

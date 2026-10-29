import { prisma } from "@/lib/db";
import { firmarCuerpo } from "@/lib/firma";
import { motivoUrlNoPermitida } from "@/lib/red";
import { fetchSaliente } from "@/lib/salida";
import { CODIGOS_SIN_REINTENTO } from "@/modules/contrato-apply-connect";
import { secretoDe } from "./aplicaciones";

// Despachador de Vínculo: entrega cada postulación al webhook de la aplicación (como LinkedIn con Apply Connect),
// firmada con el Client Secret de esa aplicación (X-LI-Signature, D-04). Outbox con FOR UPDATE SKIP LOCKED.
// Reintentos: máximo 6 intentos en total (F1) con espera exponencial desde 30 s → ventana de unos 15 minutos,
// suficiente para que un servicio gratuito de Render se despierte (ESPECIFICACION §2.3 y §6).

export const MAX_INTENTOS_ENTREGA = 6;
const TIMEOUT_MS = () => Number(process.env.VINCULO_TIMEOUT_ENTREGA_MS ?? 75_000);
export const BASE_BACKOFF_MS = () => Number(process.env.VINCULO_BACKOFF_BASE_MS ?? 30_000);

export interface OpcionesDespacho {
  fetchImpl?: typeof fetch;
  limite?: number;
  baseBackoffMs?: number;
}

/** Espera antes del intento n+1: base·2^(n−1) con 20 % de variación aleatoria. */
export function esperaBackoff(intento: number, baseMs: number): number {
  const exponencial = baseMs * 2 ** (intento - 1);
  return Math.round(exponencial * (0.9 + Math.random() * 0.2));
}

async function reclamar(limite: number): Promise<string[]> {
  const filas = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "Outbox" SET "bloqueadoHasta" = now() + interval '120 seconds'
    WHERE id IN (
      SELECT id FROM "Outbox"
      WHERE estado = 'PENDIENTE' AND "proximoIntentoEn" <= now()
        AND ("bloqueadoHasta" IS NULL OR "bloqueadoHasta" < now())
      ORDER BY "creadoEn"
      LIMIT ${limite}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id`;
  return filas.map((f) => f.id);
}

function leerCodigoError(cuerpo: string): string | undefined {
  try {
    return (JSON.parse(cuerpo) as { errors?: { errorCode?: string }[] }).errors?.[0]?.errorCode;
  } catch {
    return undefined;
  }
}

export interface ResultadoEnvio {
  httpStatus?: number;
  respuesta: string;
  error?: string;
  duracionMs: number;
  exito: boolean;
  codigoError?: string;
}

/** POST firmado al webhook. `firma` permite a la consola de pruebas enviar una firma alterada a propósito. */
export async function enviarAlWebhook(url: string, cuerpo: string, secreto: string, opciones: { fetchImpl?: typeof fetch; firma?: string } = {}): Promise<ResultadoEnvio> {
  const inicio = Date.now();
  const motivo = await motivoUrlNoPermitida(url);
  if (motivo) return { respuesta: "", error: `URL no permitida: ${motivo}`, duracionMs: 0, exito: false };
  let httpStatus: number | undefined;
  let respuesta = "";
  let error: string | undefined;
  try {
    const r = await (opciones.fetchImpl ?? fetchSaliente())(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-LI-Signature": opciones.firma ?? firmarCuerpo(cuerpo, secreto) },
      body: cuerpo,
      signal: AbortSignal.timeout(TIMEOUT_MS()),
      redirect: "manual",
    });
    httpStatus = r.status;
    respuesta = (await r.text()).slice(0, 2000);
  } catch (e) {
    error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  }
  const exito = httpStatus !== undefined && httpStatus >= 200 && httpStatus < 300;
  return { httpStatus, respuesta, error, duracionMs: Date.now() - inicio, exito, codigoError: exito ? undefined : leerCodigoError(respuesta) };
}

export async function entregarUno(outboxId: string, opciones: OpcionesDespacho = {}): Promise<void> {
  const fila = await prisma.outbox.findUniqueOrThrow({ where: { id: outboxId }, include: { aplicacion: true } });
  if (fila.estado !== "PENDIENTE") return;
  const numero = fila.intentos + 1;
  const r = fila.aplicacion.revocadaEn
    ? { respuesta: "", error: "La aplicación fue revocada.", duracionMs: 0, exito: false, httpStatus: undefined, codigoError: undefined }
    : await enviarAlWebhook(fila.url, fila.payload, secretoDe(fila.aplicacion), { fetchImpl: opciones.fetchImpl });
  const sinReintento = (r.codigoError !== undefined && CODIGOS_SIN_REINTENTO.has(r.codigoError)) || !!fila.aplicacion.revocadaEn;
  const agotado = numero >= MAX_INTENTOS_ENTREGA;

  await prisma.$transaction([
    prisma.intentoEntrega.create({
      data: { outboxId, numero, httpStatus: r.httpStatus ?? null, codigoError: r.codigoError ?? null, respuesta: r.respuesta, duracionMs: r.duracionMs, error: r.error ?? null },
    }),
    prisma.outbox.update({
      where: { id: outboxId },
      data: r.exito
        ? { estado: "ENVIADO", intentos: numero, enviadoEn: new Date(), bloqueadoHasta: null, ultimoError: null }
        : {
            estado: sinReintento || agotado ? "FALLIDO" : "PENDIENTE",
            intentos: numero,
            bloqueadoHasta: null,
            ultimoError: r.codigoError ?? r.error ?? `HTTP ${r.httpStatus}`,
            proximoIntentoEn: new Date(Date.now() + esperaBackoff(numero, opciones.baseBackoffMs ?? BASE_BACKOFF_MS())),
          },
    }),
  ]);
}

/**
 * Reenvía el mismo evento (mismo cuerpo y misma firma) desde el portal de desarrolladores, como un «redeliver».
 * Queda registrado como intento manual sin cambiar el estado de una entrega ya enviada.
 */
export async function reenviarEvento(outboxId: string, fetchImpl?: typeof fetch): Promise<ResultadoEnvio> {
  const fila = await prisma.outbox.findUniqueOrThrow({ where: { id: outboxId }, include: { aplicacion: true } });
  const r = await enviarAlWebhook(fila.url, fila.payload, secretoDe(fila.aplicacion), { fetchImpl });
  await prisma.$transaction([
    prisma.intentoEntrega.create({
      data: { outboxId, numero: fila.intentos + 1, httpStatus: r.httpStatus ?? null, codigoError: r.codigoError ?? null, respuesta: r.respuesta, duracionMs: r.duracionMs, error: r.error ?? null, manual: true },
    }),
    prisma.outbox.update({ where: { id: outboxId }, data: { intentos: { increment: 1 }, ...(r.exito && fila.estado !== "ENVIADO" ? { estado: "ENVIADO", enviadoEn: new Date() } : {}) } }),
  ]);
  return r;
}

/** Un ciclo del despachador. Devuelve cuántas entregas intentó. */
export async function despacharPendientes(opciones: OpcionesDespacho = {}): Promise<number> {
  const ids = await reclamar(opciones.limite ?? 10);
  for (const id of ids) await entregarUno(id, opciones);
  return ids.length;
}

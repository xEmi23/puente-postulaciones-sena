import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import { firmarCuerpo } from "@/lib/firma";
import { CODIGOS_SIN_REINTENTO, TIPO_ESTADO_VACANTE, TIPO_EVENTO } from "@/modules/contrato-apply-connect";

// Despachador del origen: simula a LinkedIn entregando cada postulación al webhook del puente.
// Reintenta solo ante respuestas distintas de 2xx (o fallos de red), con backoff exponencial y jitter,
// hasta 6 intentos en total, y registra cada intento. Los códigos que LinkedIn no reintenta se respetan.

export const MAX_INTENTOS_ENTREGA = 6;
const TIMEOUT_MS = 10_000;

export interface OpcionesDespacho {
  fetchImpl?: typeof fetch;
  limite?: number;
  /** Base del backoff en ms (1 s por defecto; las pruebas lo reducen). */
  baseBackoffMs?: number;
}

export function esperaBackoff(intento: number, baseMs: number): number {
  const exponencial = baseMs * 2 ** (intento - 1);
  return Math.round(exponencial + Math.random() * exponencial * 0.3);
}

async function reclamar(limite: number): Promise<string[]> {
  const filas = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE origen."Outbox" SET "bloqueadoHasta" = now() + interval '30 seconds'
    WHERE id IN (
      SELECT id FROM origen."Outbox"
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
    const json = JSON.parse(cuerpo) as { errors?: { errorCode?: string }[] };
    return json.errors?.[0]?.errorCode;
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

/** Destino según el tipo de evento: postulaciones al webhook; cambios de estado de vacante a su endpoint. */
export function urlDestino(tipo: string): string {
  const webhook = config().PUENTE_WEBHOOK_URL;
  return tipo === TIPO_ESTADO_VACANTE ? new URL("/api/puente/vacantes/estado", webhook).toString() : webhook;
}

/** POST firmado al webhook del puente. `firma` permite a la consola de pruebas enviar una firma alterada. */
export async function enviarAlWebhook(
  cuerpo: string,
  fetchImpl: typeof fetch = fetch,
  firma?: string,
  url: string = urlDestino(TIPO_EVENTO),
): Promise<ResultadoEnvio> {
  const cfg = config();
  const inicio = Date.now();
  let httpStatus: number | undefined;
  let respuesta = "";
  let error: string | undefined;
  try {
    const r = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-LI-Signature": firma ?? firmarCuerpo(cuerpo, cfg.SIM_CLIENT_SECRET),
      },
      body: cuerpo,
      signal: AbortSignal.timeout(TIMEOUT_MS),
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

/**
 * Reenvía manualmente el mismo evento (mismo cuerpo, misma firma), como haría LinkedIn al reintentar.
 * Registra el intento sin cambiar el estado de una entrega ya enviada.
 */
export async function reenviarEvento(outboxId: string, fetchImpl?: typeof fetch): Promise<ResultadoEnvio> {
  const fila = await prisma.outboxOrigen.findUniqueOrThrow({ where: { id: outboxId } });
  const r = await enviarAlWebhook(fila.payload, fetchImpl, undefined, urlDestino(fila.tipo));
  await prisma.$transaction([
    prisma.intentoEntregaOrigen.create({
      data: {
        outboxId,
        numero: fila.intentos + 1,
        httpStatus: r.httpStatus ?? null,
        codigoError: r.codigoError ?? null,
        respuesta: r.respuesta,
        duracionMs: r.duracionMs,
        error: r.error ? `Reenvío manual: ${r.error}` : "Reenvío manual",
      },
    }),
    prisma.outboxOrigen.update({ where: { id: outboxId }, data: { intentos: { increment: 1 } } }),
  ]);
  return r;
}

export async function entregarUno(outboxId: string, opciones: OpcionesDespacho = {}): Promise<void> {
  const fila = await prisma.outboxOrigen.findUniqueOrThrow({ where: { id: outboxId } });
  if (fila.estado !== "PENDIENTE") return;

  const numero = fila.intentos + 1;
  const { httpStatus, respuesta, error, duracionMs, exito, codigoError } = await enviarAlWebhook(
    fila.payload,
    opciones.fetchImpl,
    undefined,
    urlDestino(fila.tipo),
  );
  const sinReintento = codigoError !== undefined && CODIGOS_SIN_REINTENTO.has(codigoError);
  const agotado = numero >= MAX_INTENTOS_ENTREGA;

  await prisma.$transaction([
    prisma.intentoEntregaOrigen.create({
      data: {
        outboxId,
        numero,
        httpStatus: httpStatus ?? null,
        codigoError: codigoError ?? null,
        respuesta,
        duracionMs,
        error: error ?? null,
      },
    }),
    prisma.outboxOrigen.update({
      where: { id: outboxId },
      data: exito
        ? { estado: "ENVIADO", intentos: numero, enviadoEn: new Date(), bloqueadoHasta: null, ultimoError: null }
        : {
            estado: sinReintento || agotado ? "FALLIDO" : "PENDIENTE",
            intentos: numero,
            bloqueadoHasta: null,
            ultimoError: codigoError ?? error ?? `HTTP ${httpStatus}`,
            proximoIntentoEn: new Date(Date.now() + esperaBackoff(numero, opciones.baseBackoffMs ?? 1000)),
          },
    }),
  ]);
}

/** Un ciclo del despachador. Devuelve cuántas entregas intentó. */
export async function despacharPendientes(opciones: OpcionesDespacho = {}): Promise<number> {
  const ids = await reclamar(opciones.limite ?? 10);
  for (const id of ids) await entregarUno(id, opciones);
  return ids.length;
}

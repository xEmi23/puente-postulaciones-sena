import { prisma, esViolacionUnica } from "@/lib/db";
import { sha256Hex } from "@/lib/archivos";
import type { ApiKey } from "@/generated/prisma/client";
import type { Fallo } from "@/modules/seleccion";
import { hashLlave, prefijoDe } from "./llaves";

// Capa HTTP de la API v1 de Talentia (contrato del simulador, docs/contratos.md §3):
// - Autenticación con la API Key en el encabezado `auth_token` (Supuesto pendiente: BUK no publica el nombre del encabezado).
// - GET exige permiso de Lectura; POST y PATCH, de Modificación.
// - 120 solicitudes por minuto por llave → 429 con Retry-After.
// - Errores uniformes: { error: { codigo, mensaje, detalle? } }.
// - Idempotency-Key en las escrituras (capacidad del simulador, NO atribuida a BUK).
// - Cada llamada queda en el registro de actividad (sin cuerpos ni datos personales).

export const ENCABEZADO_LLAVE = "auth_token";
export const LIMITE_POR_MINUTO = () => Number(process.env.TALENTIA_LIMITE_POR_MINUTO ?? 120);

export type Permiso = "lectura" | "modificacion";

export function respuesta(status: number, cuerpo: unknown, encabezados: Record<string, string> = {}) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...encabezados },
  });
}

export function error(status: number, codigo: string, mensaje: string, detalle?: Record<string, unknown>, encabezados: Record<string, string> = {}) {
  return respuesta(status, { error: detalle ? { codigo, mensaje, detalle } : { codigo, mensaje } }, encabezados);
}

export const desdeFallo = (f: Fallo) => error(f.status, f.codigo, f.mensaje, f.detalle);

export interface ContextoApi {
  llave: ApiKey;
  /** Texto para el historial: «API · <prefijo>». */
  autor: string;
}

/** Cuenta la solicitud en la ventana del minuto actual (atómico en PostgreSQL). Devuelve los segundos que faltan si se excede. */
async function excedeLimite(apiKeyId: string): Promise<number | null> {
  const ahora = Date.now();
  const ventana = new Date(Math.floor(ahora / 60_000) * 60_000);
  const [fila] = await prisma.$queryRaw<{ conteo: number }[]>`
    INSERT INTO "LimiteTasa" ("apiKeyId", ventana, conteo) VALUES (${apiKeyId}::uuid, ${ventana}, 1)
    ON CONFLICT ("apiKeyId", ventana) DO UPDATE SET conteo = "LimiteTasa".conteo + 1
    RETURNING conteo`;
  if (fila.conteo <= LIMITE_POR_MINUTO()) return null;
  return Math.max(1, Math.ceil((ventana.getTime() + 60_000 - ahora) / 1000));
}

/**
 * Envuelve un manejador de la API: autentica, autoriza, aplica el límite, ejecuta y registra la actividad.
 * `ruta` es la plantilla documentada (p. ej. «/api/v1/seleccion/postulantes/{id}») para no guardar identificadores.
 */
export async function conApi(req: Request, ruta: string, permiso: Permiso, manejador: (ctx: ContextoApi) => Promise<Response>): Promise<Response> {
  const inicio = Date.now();
  const presentada = req.headers.get(ENCABEZADO_LLAVE)?.trim() ?? "";
  let llave: ApiKey | null = null;
  let r: Response;
  try {
    llave = presentada ? await prisma.apiKey.findUnique({ where: { hash: hashLlave(presentada) } }) : null;
    if (!presentada) r = error(401, "NO_AUTORIZADO", `Falta la API Key en el encabezado ${ENCABEZADO_LLAVE}.`);
    else if (!llave) r = error(401, "NO_AUTORIZADO", "La API Key no es válida.");
    else if (llave.revocadaEn) r = error(401, "NO_AUTORIZADO", "La API Key fue revocada.");
    else if (permiso === "lectura" ? !llave.permisoLectura : !llave.permisoModificacion) {
      r = error(403, "PERMISO_INSUFICIENTE", `La API Key no tiene el permiso de ${permiso === "lectura" ? "Lectura" : "Modificación"} del módulo Selección.`);
    } else {
      const espera = await excedeLimite(llave.id);
      if (espera !== null) {
        r = error(429, "LIMITE_EXCEDIDO", `Se superó el límite de ${LIMITE_POR_MINUTO()} solicitudes por minuto.`, undefined, { "Retry-After": String(espera) });
      } else {
        r = await manejador({ llave, autor: `API · ${llave.prefijo}` });
      }
    }
  } catch (e) {
    console.error("[talentia:api] error inesperado", e instanceof Error ? e.message : e);
    r = error(500, "ERROR_INTERNO", "Error inesperado en Talentia.");
  }
  const duracionMs = Date.now() - inicio;
  await prisma
    .$transaction([
      prisma.actividadApi.create({
        data: { apiKeyId: llave?.id ?? null, prefijo: llave?.prefijo ?? prefijoDe(presentada), metodo: req.method, ruta, estado: r.status, duracionMs },
      }),
      ...(llave && !llave.revocadaEn ? [prisma.apiKey.update({ where: { id: llave.id }, data: { ultimoUsoEn: new Date() } })] : []),
    ])
    .catch((e) => console.error("[talentia:api] no se pudo registrar la actividad", e instanceof Error ? e.message : e));
  return r;
}

/**
 * Escritura con Idempotency-Key (por llave): la misma clave con la misma solicitud devuelve la respuesta guardada sin
 * volver a escribir; con otra solicitud responde 422 CLAVE_REUTILIZADA. Las respuestas 5xx no se guardan.
 */
export async function conIdempotencia(req: Request, ctx: ContextoApi, huella: string, operacion: () => Promise<Response>): Promise<Response> {
  const clave = req.headers.get("idempotency-key");
  if (!clave) return operacion();
  if (clave.length > 200) return error(400, "CLAVE_INVALIDA", "La Idempotency-Key no puede superar 200 caracteres.");
  const hashSolicitud = sha256Hex(Buffer.from(`${req.method} ${new URL(req.url).pathname}\n${huella}`, "utf8"));
  const previa = await prisma.claveIdempotencia.findUnique({ where: { apiKeyId_clave: { apiKeyId: ctx.llave.id, clave } } });
  if (previa) {
    if (previa.hashSolicitud !== hashSolicitud) return error(422, "CLAVE_REUTILIZADA", "La Idempotency-Key ya se usó con otra solicitud.");
    return new Response(previa.respuesta, {
      status: previa.estadoHttp,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Idempotent-Replayed": "true" },
    });
  }
  const r = await operacion();
  if (r.status < 500) {
    const texto = await r.clone().text();
    await prisma.claveIdempotencia
      .create({ data: { apiKeyId: ctx.llave.id, clave, ruta: new URL(req.url).pathname, hashSolicitud, estadoHttp: r.status, respuesta: texto } })
      .catch((e) => {
        if (!esViolacionUnica(e)) throw e;
      });
  }
  return r;
}

/** Lee el cuerpo JSON; devuelve el texto crudo (para la huella de idempotencia) y el objeto, o una respuesta de error. */
export async function leerJson(req: Request): Promise<{ ok: true; crudo: string; datos: unknown } | { ok: false; respuesta: Response }> {
  const crudo = await req.text();
  try {
    return { ok: true, crudo, datos: JSON.parse(crudo) };
  } catch {
    return { ok: false, respuesta: error(400, "JSON_INVALIDO", "El cuerpo no es JSON válido.") };
  }
}

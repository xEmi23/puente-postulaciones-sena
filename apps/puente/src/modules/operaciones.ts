import { prisma } from "@/lib/db";
import { completar } from "./procesador";
import { conectorATS } from "@/salidas";

// Acciones manuales del panel. Cada una valida que sea segura antes de actuar.

export type ResultadoAccion = { ok: true; mensaje: string } | { ok: false; mensaje: string };

/**
 * Reintento manual: solo para FALLIDO_REINTENTABLE con los reintentos automáticos detenidos.
 * Es seguro porque cada escritura en el ATS lleva Idempotency-Key y el candidato se busca por correo.
 * No aplica a REQUIERE_VERIFICACION: ahí primero hay que reconciliar.
 */
export async function reintentar(recepcionId: string): Promise<ResultadoAccion> {
  const rec = await prisma.recepcion.findUnique({ where: { id: recepcionId }, include: { trabajo: true } });
  if (!rec || !rec.trabajo) return { ok: false, mensaje: "La operación no existe." };
  if (rec.estado !== "FALLIDO_REINTENTABLE" || rec.trabajo.estado !== "DETENIDO") {
    return { ok: false, mensaje: "Esta operación no se puede reintentar de forma segura en su estado actual." };
  }
  await prisma.$transaction([
    prisma.trabajo.update({ where: { id: rec.trabajo.id }, data: { estado: "PENDIENTE", intentos: 0, proximoIntentoEn: new Date(), leaseHasta: null } }),
    prisma.eventoRecepcion.create({ data: { recepcionId, tipo: "REINTENTO_MANUAL", detalle: "Reintento manual solicitado desde el panel." } }),
  ]);
  return { ok: true, mensaje: "Reintento programado. El worker lo tomará en segundos." };
}

/**
 * Reconciliación: pregunta al ATS (por ConectorATS) si la postulación de esa persona en ese proceso ya existe.
 * - Existe → se marca COMPLETADO sin escribir nada.
 * - No existe → es seguro volver a crearla: queda FALLIDO_REINTENTABLE y se programa.
 * - No se puede consultar → sigue en REQUIERE_VERIFICACION.
 */
export async function reconciliar(recepcionId: string, opciones: { fetchImpl?: typeof fetch } = {}): Promise<ResultadoAccion> {
  const rec = await prisma.recepcion.findUnique({ where: { id: recepcionId }, include: { trabajo: true } });
  if (!rec || !rec.trabajo) return { ok: false, mensaje: "La operación no existe." };
  if (rec.estado !== "REQUIERE_VERIFICACION") return { ok: false, mensaje: "Solo se reconcilian operaciones que requieren verificación." };

  let existente: { id: string } | null;
  try {
    existente =
      rec.atsPostulanteId && rec.procesoAtsId !== null
        ? await conectorATS(opciones).consultarPostulacion(rec.atsPostulanteId, String(rec.procesoAtsId))
        : null;
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e);
    await prisma.eventoRecepcion.create({ data: { recepcionId, tipo: "RECONCILIACION", detalle: `No se pudo consultar el ATS: ${detalle}` } });
    return { ok: false, mensaje: `No se pudo consultar el ATS (${detalle}). Intenta de nuevo más tarde.` };
  }
  if (existente) {
    await completar(rec, existente.id, "Reconciliado desde el panel: Talentia ya tenía la postulación.");
    return { ok: true, mensaje: "Talentia ya tenía la postulación. Operación marcada como completada." };
  }
  await prisma.$transaction([
    prisma.recepcion.update({ where: { id: recepcionId }, data: { estado: "FALLIDO_REINTENTABLE", errorCodigo: null, errorDetalle: null } }),
    prisma.trabajo.update({ where: { id: rec.trabajo.id }, data: { estado: "PENDIENTE", intentos: 0, proximoIntentoEn: new Date(), leaseHasta: null } }),
    prisma.eventoRecepcion.create({
      data: { recepcionId, tipo: "RECONCILIACION", detalle: "El ATS confirma que la postulación no existe; se programa crearla de nuevo." },
    }),
  ]);
  return { ok: true, mensaje: "El ATS no tenía la postulación. Se programó crearla de nuevo." };
}

export interface Metricas {
  recibidas: number;
  completadas: number;
  rechazadasProcesamiento: number;
  rechazadasEntrada: number;
  enCurso: number;
  requierenAtencion: number;
  enReintento: number;
  requierenVerificacion: number;
  duplicadosEvitados: number;
  medianaSegundos: number | null;
  p95Segundos: number | null;
  muestra: number;
  rechazosPorCodigo: { codigo: string; total: number }[];
  porProceso: { procesoId: number; recibidas: number; completadas: number; medianaSegundos: number | null }[];
}

/** Métricas medidas sobre los datos reales de la base (no estimadas). */
export async function calcularMetricas(): Promise<Metricas> {
  const [r] = await prisma.$queryRaw<
    {
      recibidas: bigint;
      completadas: bigint;
      rechazadas: bigint;
      en_curso: bigint;
      atencion: bigint;
      reintento: bigint;
      verificacion: bigint;
      duplicados: bigint | null;
      mediana: number | null;
      p95: number | null;
      muestra: bigint;
    }[]
  >`
    SELECT count(*) AS recibidas,
           count(*) FILTER (WHERE estado = 'COMPLETADO') AS completadas,
           count(*) FILTER (WHERE estado = 'RECHAZADO') AS rechazadas,
           count(*) FILTER (WHERE estado IN ('RECIBIDO', 'PROCESANDO')) AS en_curso,
           count(*) FILTER (WHERE estado IN ('FALLIDO_REINTENTABLE', 'REQUIERE_VERIFICACION')) AS atencion,
           count(*) FILTER (WHERE estado = 'FALLIDO_REINTENTABLE') AS reintento,
           count(*) FILTER (WHERE estado = 'REQUIERE_VERIFICACION') AS verificacion,
           sum("duplicadosEvitados") AS duplicados,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM ("completadaEn" - "recibidaEn")))
             FILTER (WHERE "completadaEn" IS NOT NULL) AS mediana,
           percentile_cont(0.95) WITHIN GROUP (ORDER BY extract(epoch FROM ("completadaEn" - "recibidaEn")))
             FILTER (WHERE "completadaEn" IS NOT NULL) AS p95,
           count("completadaEn") AS muestra
    FROM "Recepcion"`;
  const porCodigo = await prisma.entregaRechazada.groupBy({ by: ["codigo"], _count: { _all: true }, orderBy: { codigo: "asc" } });
  const porProceso = await prisma.$queryRaw<{ proceso: number; recibidas: bigint; completadas: bigint; mediana: number | null }[]>`
    SELECT "procesoAtsId" AS proceso, count(*) AS recibidas, count(*) FILTER (WHERE estado = 'COMPLETADO') AS completadas,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM ("completadaEn" - "recibidaEn")))
             FILTER (WHERE "completadaEn" IS NOT NULL) AS mediana
    FROM "Recepcion" WHERE "procesoAtsId" IS NOT NULL GROUP BY "procesoAtsId" ORDER BY "procesoAtsId"`;
  const rechazadasEntrada = porCodigo.reduce((s, c) => s + c._count._all, 0);
  return {
    recibidas: Number(r.recibidas),
    completadas: Number(r.completadas),
    rechazadasProcesamiento: Number(r.rechazadas),
    rechazadasEntrada,
    enCurso: Number(r.en_curso),
    requierenAtencion: Number(r.atencion),
    enReintento: Number(r.reintento),
    requierenVerificacion: Number(r.verificacion),
    duplicadosEvitados: Number(r.duplicados ?? 0),
    medianaSegundos: r.mediana === null ? null : Number(r.mediana),
    p95Segundos: r.p95 === null ? null : Number(r.p95),
    muestra: Number(r.muestra),
    rechazosPorCodigo: porCodigo.map((c) => ({ codigo: c.codigo, total: c._count._all })),
    porProceso: porProceso.map((p) => ({ procesoId: p.proceso, recibidas: Number(p.recibidas), completadas: Number(p.completadas), medianaSegundos: p.mediana === null ? null : Number(p.mediana) })),
  };
}

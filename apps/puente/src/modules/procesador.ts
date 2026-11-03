import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { resolverDestino } from "./destino";
import type { PasoRecepcion, Recepcion } from "@/generated/prisma/client";
import { conectorATS, ErrorConectorATS } from "@/salidas";
import { obtenerCvRemoto } from "@/entradas";
import { ErrorProcesamiento } from "@/nucleo/errores";
import { etiquetaFuente } from "@/nucleo/fuentes";
import { ACTOR_PROCESADOR, auditar, log } from "@/nucleo/auditoria";
import { enmascararTexto } from "@/lib/privacidad";

export { ErrorProcesamiento } from "@/nucleo/errores";
export { descargarCv } from "@/entradas/apply-connect/cv";

// Procesador del puente (corre en el worker). No conoce la fuente ni el ATS: obtiene el CV por el adaptador de la
// fuente (src/entradas) y escribe en el ATS por la interfaz ConectorATS (src/salidas). Cada trabajo avanza por pasos:
//   cv_descargado → postulante_listo → documento_subido → postulacion_creada
// Cada paso se guarda en cuanto termina, así un reinicio retoma desde el último paso confirmado.
// Las escrituras en el ATS llevan Idempotency-Key derivada de la recepción.

// Texto visible de la fuente de Apply Connect en el ATS (D-19). Las demás fuentes: src/nucleo/fuentes.ts.
export const FUENTE_ATS = etiquetaFuente("apply-connect");

/** Solo para pruebas: simula que el proceso muere justo después de confirmar un paso. */
export class CaidaSimulada extends Error {
  constructor(paso: PasoRecepcion) {
    super(`Caída simulada después de ${paso}`);
    this.name = "CaidaSimulada";
  }
}

export interface OpcionesProcesador {
  fetchImpl?: typeof fetch;
  baseBackoffMs?: number;
  maxIntentos?: number;
  leaseSegundos?: number;
  dueno?: string;
  simularCaidaDespuesDe?: PasoRecepcion;
}

// V4 §7: 5 intentos por defecto (configurable con PUENTE_MAX_INTENTOS). Con espera exponencial desde 2 s y hasta 75 s
// por llamada cuando el ATS lleva tiempo sin responder, cubre el arranque en frío de Render (~90 s). Al agotarlos la
// recepción queda FALLIDA_DEFINITIVA (D-52) y se recupera con «Reintentar» (D-57, reemplaza los 10 de D-46).
export const MAX_INTENTOS_TRABAJO = 5;

export function backoffConJitter(intento: number, baseMs: number): number {
  const exponencial = Math.min(baseMs * 2 ** (intento - 1), 5 * 60_000);
  return Math.round(exponencial / 2 + Math.random() * exponencial);
}

/** Reserva trabajos con SELECT … FOR UPDATE SKIP LOCKED y lease: dos workers nunca toman el mismo. */
export async function reclamarTrabajos(dueno: string, limite: number, leaseSegundos = 60) {
  return prisma.$queryRaw<{ id: string; recepcionId: string; intentos: number }[]>`
    UPDATE "Trabajo" t
    SET estado = 'EN_CURSO', "leaseHasta" = now() + make_interval(secs => ${leaseSegundos}),
        "leaseDueno" = ${dueno}, intentos = t.intentos + 1, "actualizadoEn" = now()
    WHERE t.id IN (
      SELECT id FROM "Trabajo"
      WHERE (estado = 'PENDIENTE' AND "proximoIntentoEn" <= now())
         OR (estado = 'EN_CURSO' AND "leaseHasta" < now())
      ORDER BY "proximoIntentoEn"
      LIMIT ${limite}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING t.id, t."recepcionId", t.intentos`;
}

export async function procesarPendientes(opciones: OpcionesProcesador = {}): Promise<number> {
  const dueno = opciones.dueno ?? `worker-${process.pid}-${randomUUID().slice(0, 8)}`;
  const trabajos = await reclamarTrabajos(dueno, 5, opciones.leaseSegundos ?? 60);
  for (const t of trabajos) {
    try {
      await procesarTrabajo(t.id, opciones);
    } catch (e) {
      if (e instanceof CaidaSimulada) throw e;
      // Solo la primera línea del mensaje: sin la consulta completa ni datos personales.
      console.error(`[puente] Error inesperado en el trabajo ${t.id}:`, e instanceof Error ? e.message.split("\n")[0] : "desconocido");
    }
  }
  return trabajos.length;
}

async function evento(recepcionId: string, tipo: string, detalle: string, paso?: PasoRecepcion) {
  await prisma.eventoRecepcion.create({ data: { recepcionId, tipo, detalle, paso: paso ?? null } });
  log(recepcionId, `${tipo}${paso ? ` paso=${paso}` : ""}: ${enmascararTexto(detalle)}`);
}

export async function procesarTrabajo(trabajoId: string, opciones: OpcionesProcesador = {}): Promise<void> {
  const trabajo = await prisma.trabajo.findUniqueOrThrow({ where: { id: trabajoId }, include: { recepcion: true } });
  let rec = trabajo.recepcion;
  if (rec.estado === "COMPLETADO" || rec.estado === "RECHAZADO") {
    await prisma.trabajo.update({ where: { id: trabajoId }, data: { estado: "HECHO", leaseHasta: null } });
    return;
  }
  const caida = (paso: PasoRecepcion) => {
    if (opciones.simularCaidaDespuesDe === paso) throw new CaidaSimulada(paso);
  };
  const conector = conectorATS({ fetchImpl: opciones.fetchImpl });
  const ats = conector.nombre === "talentia" ? "Simulador BUK" : conector.nombre.toUpperCase();

  rec = await prisma.recepcion.update({ where: { id: rec.id }, data: { estado: "PROCESANDO" } });
  try {
    if (!rec.paso) {
      // El CV no llegó en bytes: lo obtiene el adaptador de la fuente (hoy, Apply Connect por mediaUrl).
      const cv = await obtenerCvRemoto(rec, opciones.fetchImpl);
      rec = await prisma.recepcion.update({
        where: { id: rec.id },
        data: { paso: "cv_descargado", cvContenido: Buffer.from(cv.bytes), cvSha256: cv.sha256, cvTamano: cv.bytes.length, cvNombreArchivo: cv.nombre },
      });
      await evento(rec.id, "PASO", `CV descargado (${cv.bytes.length} bytes, SHA-256 ${cv.sha256.slice(0, 12)}…).`, "cv_descargado");
      caida("cv_descargado");
    }

    if (rec.procesoAtsId === null) {
      const destino = await resolverDestino(rec.fuente, rec.vacanteExterna, rec.appliedAt);
      if (!destino.ok) throw new ErrorProcesamiento("JOB_POSTING_CLOSED", destino.motivo, "rechazar");
      rec = await prisma.recepcion.update({ where: { id: rec.id }, data: { procesoAtsId: destino.procesoId } });
    }

    if (rec.paso === "cv_descargado") {
      const postulante = await conector.crearPostulante(
        { nombres: rec.nombre, apellidos: rec.apellido, correo: rec.correo ?? undefined, telefono: rec.telefono ?? undefined, ciudad: rec.ciudad ?? undefined },
        `${rec.jobApplicationId}:postulante`,
        { referenciaExterna: rec.jobApplicant },
      );
      rec = await prisma.recepcion.update({ where: { id: rec.id }, data: { paso: "postulante_listo", atsPostulanteId: postulante.id } });
      await evento(rec.id, "PASO", postulante.existente ? `Postulante existente actualizado en el ${ats} (mismo correo).` : `Postulante creado en el ${ats}.`, "postulante_listo");
      caida("postulante_listo");
    }

    if (rec.paso === "postulante_listo") {
      if (!conector.capacidades.adjuntarCV) {
        // El ATS no admite el CV por API (riesgo R4 en BUK): se omite el paso y la recepción completa con advertencia.
        // El CV queda en el Puente hasta su retención.
        const advertencia = "CV no enviado: el ATS no lo admite por API";
        rec = await prisma.recepcion.update({ where: { id: rec.id }, data: { paso: "documento_subido", atsDocumentoId: null, advertencia } });
        await evento(rec.id, "PASO", `${advertencia}. El CV queda disponible en el Puente.`, "documento_subido");
      } else {
        if (!rec.cvContenido || !rec.cvSha256) throw new ErrorProcesamiento("CV_NO_DISPONIBLE", "Se perdió la copia temporal del CV.", "detener");
        const doc = await conector.adjuntarCV(
          rec.atsPostulanteId!,
          { nombreArchivo: rec.cvNombreArchivo ?? "cv.pdf", tipo: "application/pdf", bytes: new Uint8Array(rec.cvContenido), sha256: rec.cvSha256 },
          `${rec.jobApplicationId}:documento`,
        );
        rec = await prisma.recepcion.update({ where: { id: rec.id }, data: { paso: "documento_subido", atsDocumentoId: doc?.idDocumento ?? null } });
        await evento(rec.id, "PASO", `CV subido al ${ats}; el ${ats} confirmó el mismo SHA-256.`, "documento_subido");
      }
      caida("documento_subido");
    }

    if (rec.paso === "documento_subido") {
      // Si el intento anterior se quedó sin respuesta, primero se pregunta al ATS antes de escribir de nuevo.
      if (rec.errorCodigo === "ATS_SIN_RESPUESTA") {
        const existente = await conector.consultarPostulacion(rec.atsPostulanteId!, String(rec.procesoAtsId));
        if (existente) {
          await completar(rec, existente.id, "Reconciliado: el ATS ya tenía la postulación creada en el intento anterior.");
          return;
        }
        await evento(rec.id, "RECONCILIACION", "El ATS confirma que la postulación no existe; se crea de nuevo.");
      }
      let postulacionId: string;
      let detalle = `Postulación creada en la etapa Postulantes del ${ats}.`;
      try {
        const post = await conector.crearPostulacion(rec.atsPostulanteId!, String(rec.procesoAtsId), `${rec.jobApplicationId}:postulacion`, {
          idDocumento: rec.atsDocumentoId ?? undefined,
          fuente: etiquetaFuente(rec.fuente),
          referenciaExterna: rec.jobApplicationId,
        });
        postulacionId = post.id;
      } catch (e) {
        const existente = e instanceof ErrorConectorATS && e.tipo === "conflicto" ? (e.detalle?.postulacion_id as string | undefined) : undefined;
        if (!existente) throw e;
        postulacionId = existente;
        detalle = "La persona ya tenía una postulación en este proceso; se vinculó la existente sin duplicar.";
      }
      await completar(rec, postulacionId, detalle);
    }
  } catch (e) {
    if (e instanceof CaidaSimulada) throw e;
    await manejarFallo(trabajoId, rec, e, opciones);
  }
}

export async function completar(rec: Recepcion, atsPostulacionId: string, detalle: string) {
  await prisma.$transaction([
    prisma.recepcion.update({
      where: { id: rec.id },
      data: {
        estado: "COMPLETADO",
        paso: "postulacion_creada",
        atsPostulacionId,
        completadaEn: new Date(),
        // Si el ATS no admitió el CV, el binario se conserva en el Puente hasta su retención.
        ...(rec.advertencia ? {} : { cvContenido: null }),
        errorCodigo: null,
        errorDetalle: null,
        // Aviso RESUME_DOWNLOADED a Vínculo: se envía aparte y no bloquea el COMPLETADO (§4.3, paso 7).
        avisoEstado: "PENDIENTE",
        avisoProximoEn: new Date(),
      },
    }),
    prisma.trabajo.update({ where: { recepcionId: rec.id }, data: { estado: "HECHO", leaseHasta: null, ultimoError: null } }),
    prisma.eventoRecepcion.create({ data: { recepcionId: rec.id, tipo: "COMPLETADO", paso: "postulacion_creada", detalle } }),
  ]);
  await auditar(ACTOR_PROCESADOR, "recepcion.completada", rec.id);
  log(rec.id, "COMPLETADA");
}

function clasificar(e: unknown, rec: Recepcion): ErrorProcesamiento {
  if (e instanceof ErrorProcesamiento) return e;
  if (e instanceof ErrorConectorATS) {
    const codigoAts = e.codigo;
    if (e.tipo === "sin_conexion") return new ErrorProcesamiento("PUENTE_SIN_CONEXION", e.message, "detener");
    if (e.tipo === "no_implementado") return new ErrorProcesamiento("ATS_NO_IMPLEMENTADO", e.message, "detener");
    if (e.tipo === "autenticacion") return new ErrorProcesamiento("ATS_AUTENTICACION", e.message, "detener");
    if (e.tipo === "permiso") return new ErrorProcesamiento("ATS_PERMISO", e.message, "detener");
    if (e.status === 429) return new ErrorProcesamiento("ATS_LIMITE", e.message, "reintentar", (e.reintentarEn ?? 60) * 1000);
    if (e.resultadoIncierto) {
      const escritura = rec.paso === "documento_subido";
      return new ErrorProcesamiento(escritura ? "ATS_SIN_RESPUESTA" : "ATS_NO_DISPONIBLE", e.message, "reintentar");
    }
    if (codigoAts === "HASH_NO_COINCIDE") return new ErrorProcesamiento("CV_TRANSFERENCIA_INCOMPLETA", "El ATS recibió un archivo distinto al enviado.", "reintentar");
    const mensaje = e.message;
    return new ErrorProcesamiento(codigoAts ? `ATS_${codigoAts}` : "ATS_VALIDACION", mensaje, "rechazar");
  }
  const mensaje = e instanceof Error ? e.message : String(e);
  return new ErrorProcesamiento("ERROR_INTERNO", mensaje, "reintentar");
}

async function manejarFallo(trabajoId: string, rec: Recepcion, e: unknown, opciones: OpcionesProcesador) {
  const error = clasificar(e, rec);
  const trabajo = await prisma.trabajo.findUniqueOrThrow({ where: { id: trabajoId } });
  const max = opciones.maxIntentos ?? MAX_INTENTOS_TRABAJO;

  if (error.modo === "rechazar") {
    await prisma.$transaction([
      prisma.recepcion.update({ where: { id: rec.id }, data: { estado: "RECHAZADO", errorCodigo: error.codigo, errorDetalle: error.message, cvContenido: null } }),
      prisma.trabajo.update({ where: { id: trabajoId }, data: { estado: "HECHO", leaseHasta: null, ultimoError: error.message } }),
      prisma.eventoRecepcion.create({ data: { recepcionId: rec.id, tipo: "RECHAZO", detalle: `${error.codigo}: ${error.message}` } }),
    ]);
    await auditar(ACTOR_PROCESADOR, "recepcion.fallida_definitiva", rec.id, error.codigo);
    log(rec.id, `RECHAZADA codigo=${error.codigo}`);
    return;
  }

  const agotado = trabajo.intentos >= max;
  const detener = error.modo === "detener" || agotado;
  // Si el último fallo dejó una escritura con resultado desconocido y ya no se reintentará, alguien debe verificar.
  const estado = detener && error.codigo === "ATS_SIN_RESPUESTA" ? "REQUIERE_VERIFICACION" : "FALLIDO_REINTENTABLE";
  const espera = Math.max(backoffConJitter(trabajo.intentos, opciones.baseBackoffMs ?? 2000), error.esperaMinimaMs);
  await prisma.$transaction([
    prisma.recepcion.update({ where: { id: rec.id }, data: { estado, errorCodigo: error.codigo, errorDetalle: error.message } }),
    prisma.trabajo.update({
      where: { id: trabajoId },
      data: detener
        ? { estado: "DETENIDO", leaseHasta: null, ultimoError: error.message }
        : { estado: "PENDIENTE", leaseHasta: null, ultimoError: error.message, proximoIntentoEn: new Date(Date.now() + espera) },
    }),
    prisma.eventoRecepcion.create({
      data: {
        recepcionId: rec.id,
        tipo: "INTENTO_FALLIDO",
        paso: rec.paso,
        detalle: detener
          ? `Intento ${trabajo.intentos}: ${error.codigo}. ${error.message} Se detienen los reintentos automáticos.`
          : `Intento ${trabajo.intentos}: ${error.codigo}. ${error.message} Próximo intento en ${Math.round(espera / 1000)} s.`,
      },
    }),
  ]);
  await auditar(ACTOR_PROCESADOR, detener ? (estado === "REQUIERE_VERIFICACION" ? "recepcion.requiere_verificacion" : "recepcion.fallida_definitiva") : "recepcion.fallida_reintentable", rec.id, error.codigo);
  log(rec.id, `${detener ? "DETENIDA" : "REINTENTO"} codigo=${error.codigo} intento=${trabajo.intentos}`);
}

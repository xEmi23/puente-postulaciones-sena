import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import { pareceUnPdf, sha256Hex, nombreArchivoSeguro } from "@/lib/archivos";
import type { PasoRecepcion, Recepcion } from "@/generated/prisma/client";
import { urlDeMediaPermitida } from "./webhook";
import { admitePostulacion } from "./vacantes";
import * as ats from "./ats-cliente";

// Procesador del puente (corre en el worker). Cada trabajo avanza por pasos confirmados:
//   cv_descargado → candidato_creado → documento_subido → postulacion_creada
// Cada paso se guarda en cuanto termina, así un reinicio retoma desde el último paso confirmado.
// Las escrituras en el ATS llevan Idempotency-Key derivada de la recepción.

// Texto visible de la fuente en el ATS. El contrato técnico sigue el de LinkedIn (F1 pide marcar «LinkedIn Easy Apply»),
// pero ningún texto visible lo dice: el prototipo no está conectado a LinkedIn (CLAUDE.md, D-19).
export const FUENTE_ATS = "Portal simulado (tipo LinkedIn)";

/** Cómo debe terminar un intento fallido. */
type Modo = "rechazar" | "reintentar" | "detener";

export class ErrorProcesamiento extends Error {
  constructor(
    public codigo: string,
    message: string,
    public modo: Modo,
  ) {
    super(message);
    this.name = "ErrorProcesamiento";
  }
}

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

export const MAX_INTENTOS_TRABAJO = 8;

export function backoffConJitter(intento: number, baseMs: number): number {
  const exponencial = Math.min(baseMs * 2 ** (intento - 1), 5 * 60_000);
  return Math.round(exponencial / 2 + Math.random() * exponencial);
}

/** Reserva trabajos con SELECT … FOR UPDATE SKIP LOCKED y lease: dos workers nunca toman el mismo. */
export async function reclamarTrabajos(dueno: string, limite: number, leaseSegundos = 60) {
  return prisma.$queryRaw<{ id: string; recepcionId: string; intentos: number }[]>`
    UPDATE puente."Trabajo" t
    SET estado = 'EN_CURSO', "leaseHasta" = now() + make_interval(secs => ${leaseSegundos}),
        "leaseDueno" = ${dueno}, intentos = t.intentos + 1, "actualizadoEn" = now()
    WHERE t.id IN (
      SELECT id FROM puente."Trabajo"
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
      console.error(`[puente] Error inesperado en el trabajo ${t.id}`, e);
    }
  }
  return trabajos.length;
}

async function evento(recepcionId: string, tipo: string, detalle: string, paso?: PasoRecepcion) {
  await prisma.eventoRecepcion.create({ data: { recepcionId, tipo, detalle, paso: paso ?? null } });
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
  const o = { fetchImpl: opciones.fetchImpl };

  rec = await prisma.recepcion.update({ where: { id: rec.id }, data: { estado: "PROCESANDO" } });
  try {
    if (!rec.paso) {
      const cv = await descargarCv(rec, opciones.fetchImpl);
      rec = await prisma.recepcion.update({
        where: { id: rec.id },
        data: { paso: "cv_descargado", cvContenido: Buffer.from(cv.bytes), cvSha256: cv.sha256, cvTamano: cv.bytes.length, cvNombreArchivo: cv.nombre },
      });
      await evento(rec.id, "PASO", `CV descargado (${cv.bytes.length} bytes, SHA-256 ${cv.sha256.slice(0, 12)}…).`, "cv_descargado");
      caida("cv_descargado");
    }

    if (rec.procesoAtsId === null) {
      const corr = await prisma.correspondencia.findUnique({ where: { externalJobId: rec.externalJobId } });
      if (!admitePostulacion(corr, rec.appliedAt)) {
        throw new ErrorProcesamiento("JOB_POSTING_CLOSED", "La vacante ya no tiene un proceso del ATS vinculado.", "rechazar");
      }
      rec = await prisma.recepcion.update({ where: { id: rec.id }, data: { procesoAtsId: corr!.procesoAtsId } });
    }

    if (rec.paso === "cv_descargado") {
      const candidato = await ats.crearOBuscarCandidato(
        { nombre: rec.nombre, apellido: rec.apellido, correo: rec.correo, telefono: rec.telefono, ciudad: rec.ciudad, referenciaExterna: rec.jobApplicant },
        `${rec.id}:candidato`,
        o,
      );
      rec = await prisma.recepcion.update({ where: { id: rec.id }, data: { paso: "candidato_creado", atsCandidatoId: candidato.id } });
      await evento(rec.id, "PASO", candidato.existente ? "Candidato existente reutilizado en el ATS." : "Candidato creado en el ATS.", "candidato_creado");
      caida("candidato_creado");
    }

    if (rec.paso === "candidato_creado") {
      if (!rec.cvContenido || !rec.cvSha256) throw new ErrorProcesamiento("CV_NO_DISPONIBLE", "Se perdió la copia temporal del CV.", "detener");
      const doc = await ats.subirDocumento(
        rec.atsCandidatoId!,
        { nombreArchivo: rec.cvNombreArchivo ?? "cv.pdf", tipo: "CV", contenidoBase64: Buffer.from(rec.cvContenido).toString("base64"), sha256: rec.cvSha256 },
        `${rec.id}:documento`,
        o,
      );
      rec = await prisma.recepcion.update({ where: { id: rec.id }, data: { paso: "documento_subido", atsDocumentoId: doc.id } });
      await evento(rec.id, "PASO", "CV subido al ATS; el ATS confirmó el mismo SHA-256.", "documento_subido");
      caida("documento_subido");
    }

    if (rec.paso === "documento_subido") {
      // Si el intento anterior se quedó sin respuesta, primero se pregunta al ATS antes de escribir de nuevo.
      if (rec.errorCodigo === "ATS_SIN_RESPUESTA") {
        const existente = await ats.buscarPostulacionPorReferencia(rec.jobApplicationId, o);
        if (existente) {
          await completar(rec, existente.id, "Reconciliado: el ATS ya tenía la postulación creada en el intento anterior.");
          return;
        }
        await evento(rec.id, "RECONCILIACION", "El ATS confirma que la postulación no existe; se crea de nuevo.");
      }
      let postulacionId: string;
      let detalle = "Postulación creada en la etapa Postulantes.";
      try {
        const post = await ats.crearPostulacion(
          { procesoId: rec.procesoAtsId!, candidatoId: rec.atsCandidatoId!, documentoId: rec.atsDocumentoId!, fuente: FUENTE_ATS, referenciaExterna: rec.jobApplicationId },
          `${rec.id}:postulacion`,
          o,
        );
        postulacionId = post.id;
      } catch (e) {
        const existente = e instanceof ats.ErrorAts && e.tipo === "conflicto" ? (e.cuerpo as { postulacionId?: string } | null)?.postulacionId : undefined;
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
        cvContenido: null,
        errorCodigo: null,
        errorDetalle: null,
      },
    }),
    prisma.trabajo.update({ where: { recepcionId: rec.id }, data: { estado: "HECHO", leaseHasta: null, ultimoError: null } }),
    prisma.eventoRecepcion.create({ data: { recepcionId: rec.id, tipo: "COMPLETADO", paso: "postulacion_creada", detalle } }),
  ]);
}

function clasificar(e: unknown, rec: Recepcion): ErrorProcesamiento {
  if (e instanceof ErrorProcesamiento) return e;
  if (e instanceof ats.ErrorAts) {
    const codigoAts = (e.cuerpo as { codigo?: string } | null)?.codigo;
    if (e.tipo === "autenticacion") return new ErrorProcesamiento("ATS_AUTENTICACION", e.message, "detener");
    if (e.resultadoIncierto) {
      const escritura = rec.paso === "documento_subido";
      return new ErrorProcesamiento(escritura ? "ATS_SIN_RESPUESTA" : "ATS_NO_DISPONIBLE", e.message, "reintentar");
    }
    if (codigoAts === "HASH_NO_COINCIDE") return new ErrorProcesamiento("CV_TRANSFERENCIA_INCOMPLETA", "El ATS recibió un archivo distinto al enviado.", "reintentar");
    const mensaje = (e.cuerpo as { mensaje?: string } | null)?.mensaje ?? e.message;
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
    return;
  }

  const agotado = trabajo.intentos >= max;
  const detener = error.modo === "detener" || agotado;
  // Si el último fallo dejó una escritura con resultado desconocido y ya no se reintentará, alguien debe verificar.
  const estado = detener && error.codigo === "ATS_SIN_RESPUESTA" ? "REQUIERE_VERIFICACION" : "FALLIDO_REINTENTABLE";
  const espera = backoffConJitter(trabajo.intentos, opciones.baseBackoffMs ?? 2000);
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
}

interface CvDescargado {
  bytes: Uint8Array;
  sha256: string;
  nombre: string;
}

/** Descarga el CV del mediaUrl con Bearer, solo desde el origen configurado, con límite de tamaño y validación de PDF. */
export async function descargarCv(rec: Pick<Recepcion, "mediaUrl">, fetchImpl: typeof fetch = fetch): Promise<CvDescargado> {
  const cfg = config();
  if (!urlDeMediaPermitida(rec.mediaUrl, cfg.ORIGEN_BASE_URL)) {
    throw new ErrorProcesamiento("CV_URL_NO_PERMITIDA", "El enlace del CV no pertenece al origen autorizado.", "rechazar");
  }
  let r: Response;
  try {
    r = await fetchImpl(rec.mediaUrl, {
      headers: { Authorization: `Bearer ${cfg.ORIGEN_MEDIA_ACCESS_TOKEN}` },
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ErrorProcesamiento("ORIGEN_NO_DISPONIBLE", "No fue posible descargar el CV del origen.", "reintentar");
  }
  if (r.status >= 300 && r.status < 400) throw new ErrorProcesamiento("CV_URL_NO_PERMITIDA", "El origen intentó redirigir la descarga del CV.", "rechazar");
  if (r.status === 401 || r.status === 403) throw new ErrorProcesamiento("ORIGEN_AUTENTICACION", "El origen rechazó el token de descarga del CV.", "detener");
  if (r.status === 404 || r.status === 410) throw new ErrorProcesamiento("CV_NO_DISPONIBLE", "El enlace del CV expiró o no existe.", "rechazar");
  if (!r.ok) throw new ErrorProcesamiento("ORIGEN_NO_DISPONIBLE", `El origen respondió ${r.status} al descargar el CV.`, "reintentar");

  const max = cfg.CV_MAX_BYTES;
  const declarado = Number(r.headers.get("content-length") ?? "NaN");
  if (Number.isFinite(declarado) && declarado > max) {
    throw new ErrorProcesamiento("CV_DEMASIADO_GRANDE", `El CV supera el máximo de ${max} bytes.`, "rechazar");
  }
  const partes: Uint8Array[] = [];
  let total = 0;
  try {
    const lector = r.body?.getReader();
    if (!lector) throw new Error("sin cuerpo");
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      total += value.length;
      if (total > max) {
        await lector.cancel();
        throw new ErrorProcesamiento("CV_DEMASIADO_GRANDE", `El CV supera el máximo de ${max} bytes.`, "rechazar");
      }
      partes.push(value);
    }
  } catch (e) {
    if (e instanceof ErrorProcesamiento) throw e;
    throw new ErrorProcesamiento("CV_TRANSFERENCIA_INCOMPLETA", "La descarga del CV se interrumpió.", "reintentar");
  }
  const bytes = Buffer.concat(partes);
  if (Number.isFinite(declarado) && declarado !== bytes.length) {
    throw new ErrorProcesamiento("CV_TRANSFERENCIA_INCOMPLETA", `Se recibieron ${bytes.length} de ${declarado} bytes del CV.`, "reintentar");
  }
  if (!pareceUnPdf(bytes)) throw new ErrorProcesamiento("CV_INVALIDO", "El archivo descargado no es un PDF válido.", "rechazar");

  const disposicion = r.headers.get("content-disposition") ?? "";
  const nombre = /filename="?([^";]+)"?/i.exec(disposicion)?.[1] ?? "cv.pdf";
  return { bytes, sha256: sha256Hex(bytes), nombre: nombreArchivoSeguro(decodeURIComponent(nombre)) };
}

import { prisma, esViolacionUnica } from "@/lib/db";
import { config } from "@/lib/config";
import { pareceUnPdf, sha256Hex, nombreArchivoSeguro } from "@/lib/archivos";
import { resolverDestino } from "@/modules/destino";
import { validarCanonica, type PostulacionCanonica } from "../contrato/canonica";

// registrarRecepcion(): ÚNICA puerta de entrada al núcleo del Puente (ESPECIFICACION_V4 §5–§7). Todo adaptador de
// entrada (Apply Connect, entrada genérica, importador, bot) termina aquí con una PostulacionCanonica v1:
//   1. valida y normaliza la canónica;
//   2. deduplicación dura UNIQUE(fuente, idExterno): una segunda llegada no crea nada (DUPLICADA);
//   3. resuelve el proceso del ATS (nunca adivina: publicación o correspondencia);
//   4. si el CV viene en bytes, verifica que sea PDF, su tamaño y su SHA-256;
//   5. guarda la recepción y su trabajo persistente en la misma escritura (el worker la procesa).

/** El CV viaja aparte de la canónica: en bytes (entrada genérica, importador) o como enlace que el adaptador descarga después. */
export type CvEntrada = { tipo: "binario"; bytes: Uint8Array; nombreArchivo: string } | { tipo: "remoto"; mediaUrl: string; mediaUrn: string };

/** Quién hizo llegar la postulación (para la auditoría; nunca datos personales). */
export interface Actor {
  tipo: "fuente" | "usuario" | "sistema";
  id: string;
}

export interface OpcionesRegistro {
  /** Texto del evento RECIBIDO (cada adaptador describe su verificación). */
  detalleRecibido?: string;
  /** Texto del evento cuando llega de nuevo (deduplicación). */
  detalleDuplicado?: string;
  /** SHA-256 de lo que llegó por la red (en Apply Connect, el cuerpo firmado). */
  payloadSha256?: string;
}

export type ResultadoRecepcion =
  | { resultado: "RECIBIDA"; recepcionId: string }
  | { resultado: "DUPLICADA"; recepcionId: string; referencia: string }
  | { resultado: "SIN_CORRESPONDENCIA"; motivo: string }
  | { resultado: "INVALIDA"; errores: { campo: string; mensaje: string }[] }
  | { resultado: "CV_INVALIDO"; codigo: "NO_PDF" | "DEMASIADO_GRANDE" | "HASH_NO_COINCIDE"; mensaje: string };

/** Referencia global (Idempotency-Key y referencia externa en el ATS). Apply Connect conserva su jobApplicationId. */
export function referenciaDe(fuente: string, idExterno: string): string {
  return fuente === "apply-connect" ? idExterno : `${fuente}:${idExterno}`;
}

export async function registrarRecepcion(
  entrada: unknown,
  cv: CvEntrada | null,
  actor: Actor,
  opciones: OpcionesRegistro = {},
): Promise<ResultadoRecepcion> {
  const v = validarCanonica(entrada);
  if (!v.ok) return { resultado: "INVALIDA", errores: v.errores };
  const c: PostulacionCanonica = v.datos;
  const referencia = referenciaDe(c.fuente, c.idExterno);

  // Deduplicación dura antes de cualquier otra regla: la misma postulación siempre responde DUPLICADA.
  const existente = await prisma.recepcion.findUnique({ where: { fuente_idExterno: { fuente: c.fuente, idExterno: c.idExterno } } });
  if (existente) return await duplicada(existente.id, referencia, actor, opciones);

  const recibidaEn = c.recibidaEn ? new Date(c.recibidaEn) : new Date();
  const destino = await resolverDestino(c.vacanteExterna, recibidaEn);
  if (!destino.ok) return { resultado: "SIN_CORRESPONDENCIA", motivo: destino.motivo };

  let datosCv: Record<string, unknown> = {};
  if (cv?.tipo === "binario") {
    const bytes = Buffer.from(cv.bytes);
    if (bytes.length > config().CV_MAX_BYTES) return { resultado: "CV_INVALIDO", codigo: "DEMASIADO_GRANDE", mensaje: `El CV supera el máximo de ${config().CV_MAX_BYTES} bytes.` };
    if (!pareceUnPdf(bytes)) return { resultado: "CV_INVALIDO", codigo: "NO_PDF", mensaje: "El archivo no es un PDF (debe empezar por %PDF)." };
    const sha = sha256Hex(bytes);
    if (c.cv && (c.cv.sha256 !== sha || c.cv.bytes !== bytes.length)) {
      return { resultado: "CV_INVALIDO", codigo: "HASH_NO_COINCIDE", mensaje: "El SHA-256 o el tamaño declarados no coinciden con el archivo recibido." };
    }
    datosCv = { paso: "cv_descargado", cvContenido: bytes, cvSha256: sha, cvTamano: bytes.length, cvNombreArchivo: nombreArchivoSeguro(cv.nombreArchivo) };
  }

  const eventos = [{ tipo: "RECIBIDO", detalle: opciones.detalleRecibido ?? `Postulación recibida de la fuente «${c.fuente}» (${actor.tipo}).` }];
  if (cv?.tipo === "binario") {
    eventos.push({ tipo: "PASO", detalle: `CV recibido y verificado (${(datosCv.cvTamano as number) ?? 0} bytes, SHA-256 ${String(datosCv.cvSha256).slice(0, 12)}…).` });
  }

  try {
    const recepcion = await prisma.recepcion.create({
      data: {
        fuente: c.fuente,
        idExterno: c.idExterno,
        vacanteExterna: c.vacanteExterna,
        jobApplicationId: referencia,
        jobApplicant: c.candidato.perfilUrl ?? referencia,
        externalJobId: c.vacanteExterna,
        appliedAt: recibidaEn,
        payloadSha256: opciones.payloadSha256 ?? sha256Hex(Buffer.from(JSON.stringify(c), "utf8")),
        nombre: c.candidato.nombres,
        apellido: c.candidato.apellidos ?? "",
        correo: c.candidato.correo ?? "",
        telefono: c.candidato.telefono ?? null,
        ciudad: c.candidato.ciudad ?? null,
        mediaUrl: cv?.tipo === "remoto" ? cv.mediaUrl : "",
        mediaUrn: cv?.tipo === "remoto" ? cv.mediaUrn : "",
        ...datosCv,
        trabajo: { create: {} },
        eventos: { create: eventos.map((e, i) => ({ ...e, ...(i === 1 ? { paso: "cv_descargado" as const } : {}) })) },
      },
    });
    return { resultado: "RECIBIDA", recepcionId: recepcion.id };
  } catch (e) {
    // Dos llegadas simultáneas de la misma postulación: la restricción única deja pasar solo una.
    if (esViolacionUnica(e)) {
      const otra = await prisma.recepcion.findFirst({ where: { OR: [{ fuente: c.fuente, idExterno: c.idExterno }, { jobApplicationId: referencia }] } });
      if (otra) return await duplicada(otra.id, referencia, actor, opciones);
    }
    throw e;
  }
}

async function duplicada(recepcionId: string, referencia: string, actor: Actor, opciones: OpcionesRegistro): Promise<ResultadoRecepcion> {
  await prisma.recepcion.update({
    where: { id: recepcionId },
    data: {
      duplicadosEvitados: { increment: 1 },
      eventos: { create: { tipo: "DUPLICADO", detalle: opciones.detalleDuplicado ?? `Se recibió de nuevo la misma postulación (${actor.tipo}); no se creó nada.` } },
    },
  });
  return { resultado: "DUPLICADA", recepcionId, referencia };
}

import { prisma, esViolacionUnica } from "@/lib/db";
import { config } from "@/lib/config";
import { pareceUnPdf, sha256Hex, nombreArchivoSeguro } from "@/lib/archivos";
import { resolverDestino } from "@/modules/destino";
import { validarCanonica, type PostulacionCanonica } from "../contrato/canonica";
import { auditar, log, type Actor } from "../auditoria";

// registrarRecepcion(): ÚNICA puerta de entrada al núcleo del Puente (ESPECIFICACION_V4 §5–§7). Todo adaptador de
// entrada (Apply Connect, entrada genérica, importador, bot) termina aquí con una PostulacionCanonica v1:
//   1. valida y normaliza la canónica;
//   2. deduplicación dura UNIQUE(fuente, idExterno): una segunda llegada no crea nada (DUPLICADA);
//   3. resuelve el proceso del ATS (nunca adivina: publicación o correspondencia; el importador elige el proceso);
//   4. si el CV viene en bytes, verifica que sea PDF, su tamaño y su SHA-256;
//   5. decide si una persona debe revisarla (sin correo, sin CV, datos sin confirmar o posible duplicado);
//   6. guarda la recepción y su trabajo persistente en la misma escritura (el worker la procesa si no espera revisión).

export type { Actor } from "../auditoria";

/** El CV viaja aparte de la canónica: en bytes (entrada genérica, importador) o como enlace que el adaptador descarga después. */
export type CvEntrada = { tipo: "binario"; bytes: Uint8Array; nombreArchivo: string } | { tipo: "remoto"; mediaUrl: string; mediaUrn: string };

export type MotivoRevision = "sin_correo" | "sin_cv" | "datos_sin_confirmar" | "posible_duplicado";

export const ETIQUETA_MOTIVO: Record<MotivoRevision, string> = {
  sin_correo: "Falta el correo",
  sin_cv: "Falta el CV",
  datos_sin_confirmar: "Datos extraídos sin confirmar",
  posible_duplicado: "Posible duplicado: el mismo correo ya llegó a este proceso por otra fuente",
};

export interface OpcionesRegistro {
  /** Texto del evento RECIBIDO (cada adaptador describe su verificación). */
  detalleRecibido?: string;
  /** Texto del evento cuando llega de nuevo (deduplicación). */
  detalleDuplicado?: string;
  /** SHA-256 de lo que llegó por la red (en Apply Connect, el cuerpo firmado). */
  payloadSha256?: string;
  /** Proceso elegido por una persona (importador): no se busca correspondencia. */
  procesoAtsId?: number;
}

export type ResultadoRecepcion =
  | { resultado: "RECIBIDA"; recepcionId: string }
  | { resultado: "REQUIERE_REVISION"; recepcionId: string; motivos: MotivoRevision[] }
  | { resultado: "DUPLICADA"; recepcionId: string; referencia: string }
  | { resultado: "SIN_CORRESPONDENCIA"; motivo: string }
  | { resultado: "INVALIDA"; errores: { campo: string; mensaje: string }[] }
  | { resultado: "CV_INVALIDO"; codigo: "NO_PDF" | "DEMASIADO_GRANDE" | "HASH_NO_COINCIDE"; mensaje: string };

/** Referencia global (Idempotency-Key y referencia externa en el ATS). Apply Connect conserva su jobApplicationId. */
export function referenciaDe(fuente: string, idExterno: string): string {
  return fuente === "apply-connect" ? idExterno : `${fuente}:${idExterno}`;
}

/** ¿El mismo correo ya llegó a este proceso desde OTRA fuente? Nunca se fusiona solo: va a revisión. */
export async function hayPosibleDuplicado(correo: string | null | undefined, procesoAtsId: number, fuente: string, excluirId?: string) {
  if (!correo) return false;
  const otra = await prisma.recepcion.findFirst({
    where: { correo, procesoAtsId, fuente: { not: fuente }, estado: { not: "RECHAZADO" }, ...(excluirId ? { id: { not: excluirId } } : {}) },
    select: { id: true },
  });
  return otra !== null;
}

export function validarCvBinario(bytes: Uint8Array, declarado?: { sha256: string; bytes: number }) {
  const max = config().CV_MAX_BYTES;
  if (bytes.length > max) return { ok: false as const, codigo: "DEMASIADO_GRANDE" as const, mensaje: `El CV supera el máximo de ${max} bytes (5 MB).` };
  if (!pareceUnPdf(bytes)) return { ok: false as const, codigo: "NO_PDF" as const, mensaje: "El archivo no es un PDF (debe empezar por %PDF)." };
  const sha = sha256Hex(bytes);
  if (declarado && (declarado.sha256 !== sha || declarado.bytes !== bytes.length)) {
    return { ok: false as const, codigo: "HASH_NO_COINCIDE" as const, mensaje: "El SHA-256 o el tamaño declarados no coinciden con el archivo recibido." };
  }
  return { ok: true as const, sha };
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
  let procesoAtsId: number;
  if (opciones.procesoAtsId !== undefined) procesoAtsId = opciones.procesoAtsId;
  else {
    const destino = await resolverDestino(c.fuente, c.vacanteExterna, recibidaEn);
    if (!destino.ok) return { resultado: "SIN_CORRESPONDENCIA", motivo: destino.motivo };
    procesoAtsId = destino.procesoId;
  }

  let datosCv: Record<string, unknown> = {};
  if (cv?.tipo === "binario") {
    const r = validarCvBinario(cv.bytes, c.cv);
    if (!r.ok) return { resultado: "CV_INVALIDO", codigo: r.codigo, mensaje: r.mensaje };
    datosCv = { paso: "cv_descargado", cvContenido: Buffer.from(cv.bytes), cvSha256: r.sha, cvTamano: cv.bytes.length, cvNombreArchivo: nombreArchivoSeguro(cv.nombreArchivo) };
  }

  const motivos: MotivoRevision[] = [];
  if (!c.candidato.correo) motivos.push("sin_correo");
  if (!cv) motivos.push("sin_cv");
  if (c.origenDatos === "extraido-del-cv") motivos.push("datos_sin_confirmar");
  if (await hayPosibleDuplicado(c.candidato.correo, procesoAtsId, c.fuente)) motivos.push("posible_duplicado");
  const enRevision = motivos.length > 0;

  const eventos: { tipo: string; detalle: string; paso?: "cv_descargado" }[] = [
    { tipo: "RECIBIDO", detalle: opciones.detalleRecibido ?? `Postulación recibida de la fuente «${c.fuente}».` },
  ];
  if (cv?.tipo === "binario") {
    eventos.push({ tipo: "PASO", paso: "cv_descargado", detalle: `CV recibido y verificado (${datosCv.cvTamano} bytes, SHA-256 ${String(datosCv.cvSha256).slice(0, 12)}…).` });
  }
  if (enRevision) eventos.push({ tipo: "REVISION", detalle: `Requiere revisión: ${motivos.map((m) => ETIQUETA_MOTIVO[m]).join("; ")}.` });

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
        correo: c.candidato.correo ?? null,
        telefono: c.candidato.telefono ?? null,
        ciudad: c.candidato.ciudad ?? null,
        mediaUrl: cv?.tipo === "remoto" ? cv.mediaUrl : null,
        mediaUrn: cv?.tipo === "remoto" ? cv.mediaUrn : null,
        // Solo si una persona eligió el proceso (importador); si no, el procesador lo resuelve (y respeta cierres posteriores).
        procesoAtsId: opciones.procesoAtsId ?? null,
        ...datosCv,
        ...(enRevision ? { estado: "REQUIERE_REVISION" as const, motivoRevision: motivos.join(",") } : {}),
        // En revisión, el trabajo queda detenido: el worker no lo toma hasta que una persona apruebe.
        trabajo: { create: enRevision ? { estado: "DETENIDO" } : {} },
        eventos: { create: eventos },
      },
    });
    await auditar(actor, enRevision ? "recepcion.requiere_revision" : "recepcion.recibida", recepcion.id, enRevision ? motivos.join(",") : undefined);
    log(recepcion.id, `recibida fuente=${c.fuente}${enRevision ? ` revision=${motivos.join(",")}` : ""}`);
    return enRevision ? { resultado: "REQUIERE_REVISION", recepcionId: recepcion.id, motivos } : { resultado: "RECIBIDA", recepcionId: recepcion.id };
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
      eventos: { create: { tipo: "DUPLICADO", detalle: opciones.detalleDuplicado ?? "Se recibió de nuevo la misma postulación (misma fuente e id externo); no se creó nada." } },
    },
  });
  await auditar(actor, "recepcion.duplicada", recepcionId);
  return { resultado: "DUPLICADA", recepcionId, referencia };
}

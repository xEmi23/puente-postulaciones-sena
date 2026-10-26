import { z } from "zod";
import { prisma, esViolacionUnica } from "@/lib/db";
import { config } from "@/lib/config";
import { igualesSeguro } from "@/lib/firma";
import { pareceUnPdf, sha256Hex, nombreArchivoSeguro } from "@/lib/archivos";
import { ETAPAS_REFERENCIA, etapasParaCrear } from "./etapas";
import { ESTADO_INICIADO, PRIORIDADES } from "./procesos";

// ATS simulado. Su API es el "contrato del simulador" (docs/contratos.md §ATS): no reproduce rutas
// oficiales de BUK. Capacidades propias del simulador: Idempotency-Key y consulta por referencia externa.

export interface RespuestaAts {
  status: number;
  body: unknown;
}

const error = (status: number, codigo: string, mensaje: string, extra: Record<string, unknown> = {}): RespuestaAts => ({
  status,
  body: { codigo, mensaje, ...extra },
});

export function autorizado(cabeceraAuth: string | null): boolean {
  const token = cabeceraAuth?.match(/^Bearer (.+)$/)?.[1];
  return !!token && igualesSeguro(token, config().ATS_API_KEY);
}

/**
 * Ejecuta una escritura con Idempotency-Key: si la clave ya se usó con el mismo cuerpo, devuelve la
 * respuesta guardada sin volver a escribir; si se usó con otro cuerpo, responde 422.
 */
export async function conIdempotencia(
  clave: string | null,
  ruta: string,
  cuerpoCrudo: string,
  operacion: () => Promise<RespuestaAts>,
): Promise<RespuestaAts> {
  if (!clave) return operacion();
  if (clave.length > 200) return error(400, "CLAVE_INVALIDA", "Idempotency-Key demasiado larga.");
  const hash = sha256Hex(Buffer.from(`${ruta}\n${cuerpoCrudo}`, "utf8"));
  const previa = await prisma.claveIdempotencia.findUnique({ where: { clave } });
  if (previa) {
    if (previa.hashSolicitud !== hash) {
      return error(422, "CLAVE_REUTILIZADA", "La Idempotency-Key ya se usó con otra solicitud.");
    }
    return { status: previa.estadoHttp, body: JSON.parse(previa.respuesta) };
  }
  const resultado = await operacion();
  if (resultado.status < 500) {
    await prisma.claveIdempotencia
      .create({ data: { clave, ruta, hashSolicitud: hash, estadoHttp: resultado.status, respuesta: JSON.stringify(resultado.body) } })
      .catch((e) => {
        if (!esViolacionUnica(e)) throw e;
      });
  }
  return resultado;
}

function leerJson<T>(crudo: string, esquema: z.ZodType<T>): { ok: true; datos: T } | { ok: false; respuesta: RespuestaAts } {
  let json: unknown;
  try {
    json = JSON.parse(crudo);
  } catch {
    return { ok: false, respuesta: error(400, "JSON_INVALIDO", "El cuerpo no es JSON válido.") };
  }
  const r = esquema.safeParse(json);
  if (!r.success) {
    return {
      ok: false,
      respuesta: error(400, "DATOS_INVALIDOS", "Datos inválidos.", {
        campos: r.error.issues.map((i) => ({ campo: i.path.join("."), mensaje: i.message })),
      }),
    };
  }
  return { ok: true, datos: r.data };
}

const esquemaCandidato = z.object({
  nombre: z.string().trim().min(1).max(100),
  apellido: z.string().trim().min(1).max(100),
  correo: z.string().trim().toLowerCase().pipe(z.email()),
  telefono: z.string().max(30).nullish(),
  ciudad: z.string().max(100).nullish(),
  referenciaExterna: z.string().max(200).nullish(),
});

/** Crea el candidato o devuelve el existente con el mismo correo (un candidato por persona). */
export async function crearOBuscarCandidato(crudo: string): Promise<RespuestaAts> {
  const r = leerJson(crudo, esquemaCandidato);
  if (!r.ok) return r.respuesta;
  const d = r.datos;
  const existente = await prisma.candidato.findUnique({ where: { correo: d.correo } });
  if (existente) return { status: 200, body: { id: existente.id, existente: true } };
  try {
    const nuevo = await prisma.candidato.create({
      data: { nombre: d.nombre, apellido: d.apellido, correo: d.correo, telefono: d.telefono ?? null, ciudad: d.ciudad ?? null, referenciaExterna: d.referenciaExterna ?? null },
    });
    return { status: 201, body: { id: nuevo.id, existente: false } };
  } catch (e) {
    if (!esViolacionUnica(e)) throw e;
    const otro = await prisma.candidato.findUniqueOrThrow({ where: { correo: d.correo } });
    return { status: 200, body: { id: otro.id, existente: true } };
  }
}

const esquemaDocumento = z.object({
  nombreArchivo: z.string().min(1).max(200),
  tipo: z.literal("CV"),
  contenidoBase64: z.string().min(1),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});

export async function subirDocumento(candidatoId: string, crudo: string): Promise<RespuestaAts> {
  const r = leerJson(crudo, esquemaDocumento);
  if (!r.ok) return r.respuesta;
  const d = r.datos;
  if (!z.uuid().safeParse(candidatoId).success) return error(404, "CANDIDATO_NO_EXISTE", "El candidato no existe.");
  const candidato = await prisma.candidato.findUnique({ where: { id: candidatoId } });
  if (!candidato) return error(404, "CANDIDATO_NO_EXISTE", "El candidato no existe.");

  const bytes = Buffer.from(d.contenidoBase64, "base64");
  if (bytes.length > config().CV_MAX_BYTES) return error(413, "ARCHIVO_DEMASIADO_GRANDE", "El archivo supera el máximo permitido.");
  if (!pareceUnPdf(bytes)) return error(415, "ARCHIVO_NO_PDF", "El archivo no es un PDF.");
  const calculado = sha256Hex(bytes);
  if (calculado !== d.sha256) {
    return error(422, "HASH_NO_COINCIDE", "El SHA-256 del archivo recibido no coincide con el declarado.", { calculado });
  }
  const doc = await prisma.documento.create({
    data: { candidatoId, tipo: d.tipo, nombreArchivo: nombreArchivoSeguro(d.nombreArchivo), mime: "application/pdf", tamano: bytes.length, sha256: calculado, contenido: bytes },
  });
  return { status: 201, body: { id: doc.id, sha256: doc.sha256 } };
}

const esquemaPostulacion = z.object({
  procesoId: z.number().int().positive(),
  candidatoId: z.uuid(),
  documentoId: z.uuid().nullish(),
  fuente: z.string().min(1).max(100),
  referenciaExterna: z.string().min(1).max(200),
});

function vistaPostulacion(p: { id: string; procesoId: number; referenciaExterna: string; creadaEn: Date; etapa: { nombre: string } }) {
  return { id: p.id, procesoId: p.procesoId, etapa: p.etapa.nombre, referenciaExterna: p.referenciaExterna, creadaEn: p.creadaEn };
}

/** Crea la postulación en la primera etapa del proceso ("Postulantes"), sin calificar. */
export async function crearPostulacion(crudo: string): Promise<RespuestaAts> {
  const r = leerJson(crudo, esquemaPostulacion);
  if (!r.ok) return r.respuesta;
  const d = r.datos;

  const porReferencia = await prisma.postulacionAts.findUnique({ where: { referenciaExterna: d.referenciaExterna }, include: { etapa: true } });
  if (porReferencia) return { status: 200, body: vistaPostulacion(porReferencia) };

  const proceso = await prisma.proceso.findUnique({ where: { id: d.procesoId }, include: { etapas: { orderBy: { orden: "asc" }, take: 1 } } });
  if (!proceso) return error(404, "PROCESO_NO_EXISTE", "El proceso no existe en el ATS.");
  if (proceso.estado !== ESTADO_INICIADO) return error(422, "PROCESO_CERRADO", "El proceso está cerrado y no recibe postulaciones.");
  const primera = proceso.etapas[0];
  if (!primera) return error(422, "PROCESO_SIN_ETAPAS", "El proceso no tiene etapas configuradas.");

  const candidato = await prisma.candidato.findUnique({ where: { id: d.candidatoId } });
  if (!candidato) return error(404, "CANDIDATO_NO_EXISTE", "El candidato no existe.");
  if (d.documentoId) {
    const doc = await prisma.documento.findUnique({ where: { id: d.documentoId } });
    if (!doc || doc.candidatoId !== candidato.id) return error(422, "DOCUMENTO_INVALIDO", "El documento no pertenece al candidato.");
  }

  const yaEnProceso = await prisma.postulacionAts.findUnique({ where: { procesoId_candidatoId: { procesoId: proceso.id, candidatoId: candidato.id } } });
  if (yaEnProceso) {
    return error(409, "POSTULACION_EXISTENTE", "El candidato ya tiene una postulación en este proceso.", { postulacionId: yaEnProceso.id });
  }
  try {
    const p = await prisma.postulacionAts.create({
      data: {
        procesoId: proceso.id,
        candidatoId: candidato.id,
        etapaId: primera.id,
        documentoId: d.documentoId ?? null,
        fuente: d.fuente,
        referenciaExterna: d.referenciaExterna,
      },
      include: { etapa: true },
    });
    return { status: 201, body: vistaPostulacion(p) };
  } catch (e) {
    if (!esViolacionUnica(e)) throw e;
    const otra = await prisma.postulacionAts.findUnique({ where: { referenciaExterna: d.referenciaExterna }, include: { etapa: true } });
    if (otra) return { status: 200, body: vistaPostulacion(otra) };
    const mismaPersona = await prisma.postulacionAts.findUniqueOrThrow({ where: { procesoId_candidatoId: { procesoId: proceso.id, candidatoId: candidato.id } } });
    return error(409, "POSTULACION_EXISTENTE", "El candidato ya tiene una postulación en este proceso.", { postulacionId: mismaPersona.id });
  }
}

export async function buscarPostulaciones(referenciaExterna: string | null): Promise<RespuestaAts> {
  if (!referenciaExterna) return error(400, "FALTA_REFERENCIA", "Indica referenciaExterna.");
  const p = await prisma.postulacionAts.findUnique({ where: { referenciaExterna }, include: { etapa: true } });
  return { status: 200, body: { resultados: p ? [vistaPostulacion(p)] : [] } };
}

export async function listarProcesos(): Promise<RespuestaAts> {
  const procesos = await prisma.proceso.findMany({ orderBy: { id: "asc" }, include: { etapas: { orderBy: { orden: "asc" } } } });
  return {
    status: 200,
    body: {
      resultados: procesos.map((p) => ({ id: p.id, nombre: p.nombre, estado: p.estado, etapas: p.etapas.map((e) => e.nombre) })),
    },
  };
}

export const ETAPAS_PLANTILLA = ETAPAS_REFERENCIA.map((e) => e.nombre);

const esquemaProceso = z.object({
  nombre: z.string().trim().min(5, "El nombre debe tener al menos 5 caracteres.").max(120),
  area: z.string().trim().min(2, "Indica el área.").max(60),
  ciudad: z.string().trim().min(2, "Indica la ciudad.").max(60),
  prioridad: z.enum(PRIORIDADES, { error: "Elige una prioridad." }).default("Media"),
  fechaInicio: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Indica la fecha de inicio.")
    .optional()
    .transform((v) => (v ? new Date(`${v}T12:00:00-05:00`) : new Date())),
});

/** Crea un proceso con la plantilla de etapas (la primera siempre es «Postulantes»). Uso desde la interfaz del ATS. */
export async function crearProceso(entrada: Record<string, unknown>): Promise<{ ok: true; id: number } | { ok: false; errores: Record<string, string> }> {
  const r = esquemaProceso.safeParse(entrada);
  if (!r.success) {
    const errores: Record<string, string> = {};
    for (const i of r.error.issues) errores[String(i.path[0])] ??= i.message;
    return { ok: false, errores };
  }
  for (let intento = 0; intento < 3; intento++) {
    const max = await prisma.proceso.aggregate({ _max: { id: true } });
    const id = Math.max(9000, max._max.id ?? 9000) + 1;
    try {
      await prisma.proceso.create({
        data: { id, ...r.data, etapas: { create: etapasParaCrear() } },
      });
      return { ok: true, id };
    } catch (e) {
      if (!esViolacionUnica(e)) throw e;
    }
  }
  return { ok: false, errores: { general: "No se pudo asignar un identificador al proceso." } };
}

import { z } from "zod";
import { prisma, esViolacionUnica } from "@/lib/db";
import { config } from "@/lib/config";
import { pareceUnPdf, sha256Hex, nombreArchivoSeguro } from "@/lib/archivos";
import type { Prisma } from "@/generated/prisma/client";
import { etapasParaCrear } from "./etapas";
import { ESTADO_INICIADO, PRIORIDADES } from "./procesos";

// Dominio del módulo de Selección de Talentia. Lo usan la interfaz (server actions) y la API v1.
// Cada operación devuelve un resultado explícito; la capa HTTP lo traduce a códigos y al formato de error uniforme.

export type Fallo = { ok: false; status: number; codigo: string; mensaje: string; detalle?: Record<string, unknown> };
export type Resultado<T> = { ok: true; status: number; datos: T } | Fallo;

const fallo = (status: number, codigo: string, mensaje: string, detalle?: Record<string, unknown>): Fallo => ({ ok: false, status, codigo, mensaje, detalle });
const exito = <T>(status: number, datos: T): Resultado<T> => ({ ok: true, status, datos });

/** Convierte los problemas de Zod en una lista de campos legibles. */
export function camposInvalidos(issues: z.core.$ZodIssue[]) {
  return issues.map((i) => ({ campo: i.path.join("."), mensaje: i.message }));
}

// ───────────── Procesos ─────────────

export const esquemaNuevoProceso = z.object({
  titulo: z.string().trim().min(5, "El título debe tener al menos 5 caracteres.").max(120, "Máximo 120 caracteres."),
  area: z.string().trim().min(2, "Indica el área.").max(60, "Máximo 60 caracteres."),
  ciudad: z.string().trim().min(2, "Indica la ciudad.").max(60, "Máximo 60 caracteres."),
  descripcion: z.string().trim().max(4000, "Máximo 4000 caracteres.").default(""),
  prioridad: z.enum(PRIORIDADES, { error: "Elige una prioridad: Alta, Media o Baja." }).default("Media"),
  fecha_inicio: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha de inicio debe tener el formato AAAA-MM-DD.")
    .optional()
    .transform((v) => (v ? new Date(`${v}T12:00:00-05:00`) : new Date())),
});
export type NuevoProceso = z.input<typeof esquemaNuevoProceso>;

const incluirProceso = {
  etapas: { orderBy: { orden: "asc" as const }, include: { _count: { select: { postulaciones: { where: { descartadaEn: null } } } } } },
  _count: { select: { postulaciones: true } },
} satisfies Prisma.ProcesoInclude;
export type ProcesoCompleto = Prisma.ProcesoGetPayload<{ include: typeof incluirProceso }>;

/** Crea un proceso con la plantilla de etapas (la primera siempre es «Postulantes»). */
export async function crearProceso(entrada: unknown): Promise<Resultado<ProcesoCompleto>> {
  const r = esquemaNuevoProceso.safeParse(entrada);
  if (!r.success) return fallo(400, "DATOS_INVALIDOS", "Datos inválidos.", { campos: camposInvalidos(r.error.issues) });
  const { fecha_inicio, ...resto } = r.data;
  for (let intento = 0; intento < 3; intento++) {
    const max = await prisma.proceso.aggregate({ _max: { id: true } });
    const id = Math.max(9000, max._max.id ?? 9000) + 1;
    try {
      const p = await prisma.proceso.create({
        data: { id, ...resto, fechaInicio: fecha_inicio, etapas: { create: etapasParaCrear() } },
        include: incluirProceso,
      });
      return exito(201, p);
    } catch (e) {
      if (!esViolacionUnica(e)) throw e;
    }
  }
  return fallo(409, "ID_NO_DISPONIBLE", "No se pudo asignar un identificador al proceso. Intenta de nuevo.");
}

export async function listarProcesos(filtro: { estado?: string | null } = {}) {
  return prisma.proceso.findMany({
    where: filtro.estado ? { estado: filtro.estado } : undefined,
    orderBy: { id: "asc" },
    include: incluirProceso,
  });
}

export async function obtenerProceso(id: number) {
  return prisma.proceso.findUnique({ where: { id }, include: incluirProceso });
}

// ───────────── Postulantes ─────────────

const nombre = z.string().trim().min(1, "Obligatorio.").max(100, "Máximo 100 caracteres.");
export const esquemaNuevoPostulante = z.object({
  nombre,
  apellido: nombre,
  correo: z.string().trim().toLowerCase().pipe(z.email("Correo inválido.")),
  telefono: z.string().trim().max(30).nullish(),
  ciudad: z.string().trim().max(100).nullish(),
  referencia_externa: z.string().trim().max(200).nullish(),
});
export const esquemaCambioPostulante = esquemaNuevoPostulante.partial().refine((d) => Object.keys(d).length > 0, "Envía al menos un campo.");

export async function crearPostulante(entrada: unknown) {
  const r = esquemaNuevoPostulante.safeParse(entrada);
  if (!r.success) return fallo(400, "DATOS_INVALIDOS", "Datos inválidos.", { campos: camposInvalidos(r.error.issues) });
  const d = r.data;
  try {
    const p = await prisma.postulante.create({
      data: { nombre: d.nombre, apellido: d.apellido, correo: d.correo, telefono: d.telefono ?? null, ciudad: d.ciudad ?? null, referenciaExterna: d.referencia_externa ?? null },
    });
    return exito(201, p);
  } catch (e) {
    if (!esViolacionUnica(e)) throw e;
    const existente = await prisma.postulante.findUniqueOrThrow({ where: { correo: d.correo } });
    return fallo(409, "POSTULANTE_EXISTENTE", "Ya existe un postulante con ese correo.", { postulante_id: existente.id });
  }
}

export async function actualizarPostulante(id: string, entrada: unknown) {
  if (!z.uuid().safeParse(id).success) return fallo(404, "NO_ENCONTRADO", "El postulante no existe.");
  const r = esquemaCambioPostulante.safeParse(entrada);
  if (!r.success) return fallo(400, "DATOS_INVALIDOS", "Datos inválidos.", { campos: camposInvalidos(r.error.issues) });
  const actual = await prisma.postulante.findUnique({ where: { id } });
  if (!actual) return fallo(404, "NO_ENCONTRADO", "El postulante no existe.");
  const d = r.data;
  try {
    const p = await prisma.postulante.update({
      where: { id },
      data: {
        nombre: d.nombre,
        apellido: d.apellido,
        correo: d.correo,
        telefono: d.telefono === undefined ? undefined : d.telefono,
        ciudad: d.ciudad === undefined ? undefined : d.ciudad,
        referenciaExterna: d.referencia_externa === undefined ? undefined : d.referencia_externa,
      },
    });
    return exito(200, p);
  } catch (e) {
    if (!esViolacionUnica(e)) throw e;
    return fallo(409, "POSTULANTE_EXISTENTE", "Ya existe otro postulante con ese correo.");
  }
}

export async function listarPostulantes(filtro: { email?: string | null; q?: string | null; pagina?: number; porPagina?: number } = {}) {
  const porPagina = Math.min(Math.max(filtro.porPagina ?? 25, 1), 100);
  const pagina = Math.max(filtro.pagina ?? 1, 1);
  const q = filtro.q?.trim();
  const where: Prisma.PostulanteWhereInput = filtro.email
    ? { correo: filtro.email.trim().toLowerCase() }
    : q
      ? { OR: [{ nombre: { contains: q, mode: "insensitive" } }, { apellido: { contains: q, mode: "insensitive" } }, { correo: { contains: q, mode: "insensitive" } }] }
      : {};
  const [total, filas] = await Promise.all([
    prisma.postulante.count({ where }),
    prisma.postulante.findMany({ where, orderBy: { creadoEn: "desc" }, skip: (pagina - 1) * porPagina, take: porPagina, include: { _count: { select: { postulaciones: true } } } }),
  ]);
  return { total, pagina, porPagina, filas };
}

export async function obtenerPostulante(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  return prisma.postulante.findUnique({ where: { id } });
}

// ───────────── Documentos ─────────────

export async function subirDocumento(postulanteId: string, archivo: { nombre: string; bytes: Uint8Array } | null, sha256Declarado: string | null, tipo = "CV") {
  if (!z.uuid().safeParse(postulanteId).success) return fallo(404, "NO_ENCONTRADO", "El postulante no existe.");
  if (!archivo || archivo.bytes.length === 0) return fallo(400, "DATOS_INVALIDOS", "Adjunta el archivo en el campo «archivo».", { campos: [{ campo: "archivo", mensaje: "Obligatorio." }] });
  if (!sha256Declarado || !/^[0-9a-f]{64}$/.test(sha256Declarado)) {
    return fallo(400, "DATOS_INVALIDOS", "Indica el SHA-256 del archivo en minúsculas.", { campos: [{ campo: "sha256", mensaje: "64 caracteres hexadecimales." }] });
  }
  if (tipo !== "CV") return fallo(400, "DATOS_INVALIDOS", "El único tipo de documento admitido es CV.", { campos: [{ campo: "tipo", mensaje: "Debe ser CV." }] });
  const postulante = await prisma.postulante.findUnique({ where: { id: postulanteId } });
  if (!postulante) return fallo(404, "NO_ENCONTRADO", "El postulante no existe.");
  if (archivo.bytes.length > config().CV_MAX_BYTES) return fallo(413, "ARCHIVO_DEMASIADO_GRANDE", "El archivo supera el máximo permitido.");
  if (!pareceUnPdf(archivo.bytes)) return fallo(415, "ARCHIVO_NO_PDF", "El archivo no es un PDF.");
  const calculado = sha256Hex(archivo.bytes);
  if (calculado !== sha256Declarado) return fallo(422, "HASH_NO_COINCIDE", "El SHA-256 del archivo recibido no coincide con el declarado.", { sha256_calculado: calculado });
  const doc = await prisma.documento.create({
    data: { postulanteId, tipo, nombreArchivo: nombreArchivoSeguro(archivo.nombre), mime: "application/pdf", tamano: archivo.bytes.length, sha256: calculado, contenido: Buffer.from(archivo.bytes) },
    omit: { contenido: true },
  });
  return exito(201, doc);
}

export async function listarDocumentos(postulanteId: string) {
  if (!z.uuid().safeParse(postulanteId).success) return null;
  const p = await prisma.postulante.findUnique({ where: { id: postulanteId } });
  if (!p) return null;
  return prisma.documento.findMany({ where: { postulanteId }, orderBy: { creadoEn: "desc" }, omit: { contenido: true } });
}

// ───────────── Postulaciones ─────────────

export const esquemaNuevaPostulacion = z.object({
  proceso_id: z.number().int().positive(),
  postulante_id: z.uuid(),
  documento_id: z.uuid().nullish(),
  fuente: z.string().trim().min(1).max(100),
  referencia_externa: z.string().trim().min(1).max(200).nullish(),
});

const incluirPostulacion = { etapa: true, postulante: true } satisfies Prisma.PostulacionInclude;
export type PostulacionCompleta = Prisma.PostulacionGetPayload<{ include: typeof incluirPostulacion }>;

/**
 * Crea la postulación en la primera etapa del proceso («Postulantes»), sin calificar.
 * La misma referencia_externa devuelve la postulación existente (200); la misma persona en el mismo proceso con otra
 * referencia responde 409 POSTULACION_EXISTENTE.
 */
export async function crearPostulacion(entrada: unknown, autor: string): Promise<Resultado<PostulacionCompleta>> {
  const r = esquemaNuevaPostulacion.safeParse(entrada);
  if (!r.success) return fallo(400, "DATOS_INVALIDOS", "Datos inválidos.", { campos: camposInvalidos(r.error.issues) });
  const d = r.data;

  if (d.referencia_externa) {
    const porReferencia = await prisma.postulacion.findUnique({ where: { referenciaExterna: d.referencia_externa }, include: incluirPostulacion });
    if (porReferencia) return exito(200, porReferencia);
  }
  const proceso = await prisma.proceso.findUnique({ where: { id: d.proceso_id }, include: { etapas: { orderBy: { orden: "asc" }, take: 1 } } });
  if (!proceso) return fallo(404, "PROCESO_NO_EXISTE", "El proceso no existe.");
  if (proceso.estado !== ESTADO_INICIADO) return fallo(422, "PROCESO_CERRADO", "El proceso está cerrado y no recibe postulaciones.");
  const primera = proceso.etapas[0];
  if (!primera) return fallo(422, "PROCESO_SIN_ETAPAS", "El proceso no tiene etapas configuradas.");
  const postulante = await prisma.postulante.findUnique({ where: { id: d.postulante_id } });
  if (!postulante) return fallo(404, "POSTULANTE_NO_EXISTE", "El postulante no existe.");
  if (d.documento_id) {
    const doc = await prisma.documento.findUnique({ where: { id: d.documento_id }, select: { postulanteId: true } });
    if (!doc || doc.postulanteId !== postulante.id) return fallo(422, "DOCUMENTO_INVALIDO", "El documento no pertenece al postulante.");
  }
  const existente = await prisma.postulacion.findUnique({ where: { procesoId_postulanteId: { procesoId: proceso.id, postulanteId: postulante.id } } });
  if (existente) return fallo(409, "POSTULACION_EXISTENTE", "El postulante ya tiene una postulación en este proceso.", { postulacion_id: existente.id });
  try {
    const p = await prisma.postulacion.create({
      data: {
        procesoId: proceso.id,
        postulanteId: postulante.id,
        etapaId: primera.id,
        documentoId: d.documento_id ?? null,
        fuente: d.fuente,
        referenciaExterna: d.referencia_externa ?? null,
        historial: { create: { tipo: "CREADA", aEtapa: primera.nombre, autor } },
      },
      include: incluirPostulacion,
    });
    return exito(201, p);
  } catch (e) {
    if (!esViolacionUnica(e)) throw e;
    if (d.referencia_externa) {
      const otra = await prisma.postulacion.findUnique({ where: { referenciaExterna: d.referencia_externa }, include: incluirPostulacion });
      if (otra) return exito(200, otra);
    }
    const misma = await prisma.postulacion.findUniqueOrThrow({ where: { procesoId_postulanteId: { procesoId: proceso.id, postulanteId: postulante.id } } });
    return fallo(409, "POSTULACION_EXISTENTE", "El postulante ya tiene una postulación en este proceso.", { postulacion_id: misma.id });
  }
}

export async function listarPostulaciones(filtro: { procesoId?: number | null; referenciaExterna?: string | null }) {
  return prisma.postulacion.findMany({
    where: { procesoId: filtro.procesoId ?? undefined, referenciaExterna: filtro.referenciaExterna ?? undefined },
    orderBy: { creadaEn: "desc" },
    include: incluirPostulacion,
    take: 200,
  });
}

export async function obtenerPostulacion(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  return prisma.postulacion.findUnique({ where: { id }, include: incluirPostulacion });
}

export const esquemaCambioPostulacion = z
  .object({ etapa_id: z.uuid().optional(), etapa: z.string().trim().min(1).max(100).optional(), descartada: z.boolean().optional() })
  .refine((d) => d.etapa_id !== undefined || d.etapa !== undefined || d.descartada !== undefined, "Indica etapa_id, etapa o descartada.");

/** Mueve la postulación a otra etapa del mismo proceso y/o la descarta o restaura. Queda en el historial. */
export async function cambiarPostulacion(id: string, entrada: unknown, autor: string): Promise<Resultado<PostulacionCompleta>> {
  if (!z.uuid().safeParse(id).success) return fallo(404, "NO_ENCONTRADO", "La postulación no existe.");
  const r = esquemaCambioPostulacion.safeParse(entrada);
  if (!r.success) return fallo(400, "DATOS_INVALIDOS", "Datos inválidos.", { campos: camposInvalidos(r.error.issues) });
  const actual = await prisma.postulacion.findUnique({ where: { id }, include: { etapa: true } });
  if (!actual) return fallo(404, "NO_ENCONTRADO", "La postulación no existe.");
  const d = r.data;
  const movimientos: Prisma.MovimientoEtapaCreateWithoutPostulacionInput[] = [];
  const cambios: Prisma.PostulacionUpdateInput = {};

  if (d.etapa_id !== undefined || d.etapa !== undefined) {
    const destino = await prisma.etapa.findFirst({
      where: { procesoId: actual.procesoId, ...(d.etapa_id ? { id: d.etapa_id } : { nombre: d.etapa }) },
    });
    if (!destino) return fallo(422, "ETAPA_INVALIDA", "La etapa no pertenece al proceso de la postulación.");
    if (destino.id !== actual.etapaId) {
      cambios.etapa = { connect: { id: destino.id } };
      cambios.vista = true;
      movimientos.push({ tipo: "MOVIDA", deEtapa: actual.etapa.nombre, aEtapa: destino.nombre, autor });
    }
  }
  if (d.descartada !== undefined && d.descartada !== (actual.descartadaEn !== null)) {
    cambios.descartadaEn = d.descartada ? new Date() : null;
    movimientos.push({ tipo: d.descartada ? "DESCARTADA" : "RESTAURADA", deEtapa: actual.etapa.nombre, autor });
  }
  const p = await prisma.postulacion.update({
    where: { id },
    data: { ...cambios, historial: movimientos.length ? { create: movimientos } : undefined },
    include: incluirPostulacion,
  });
  return exito(200, p);
}

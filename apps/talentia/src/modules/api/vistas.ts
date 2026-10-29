import { z } from "zod";
import type { Documento, Etapa, Postulante } from "@/generated/prisma/client";
import type { PostulacionCompleta, ProcesoCompleto } from "@/modules/seleccion";
import { etiquetaTipo } from "@/modules/etapas";
import { vigenciaDias } from "@/modules/procesos";

// Formas JSON de la API v1 (snake_case). Los esquemas Zod de respuesta son la fuente del documento OpenAPI
// (src/modules/api/openapi.ts) y las pruebas de contrato validan la implementación contra ese documento.

const fecha = z.iso.datetime({ offset: true });

export const esquemaEtapa = z.object({
  id: z.uuid(),
  nombre: z.string(),
  orden: z.number().int(),
  tipo: z.string().describe("Entrada, Filtro, Validaciones, Entrevistas o Etapa final"),
  postulantes: z.number().int().describe("Postulantes activos (sin descartar)"),
});

export const esquemaProceso = z.object({
  id: z.number().int(),
  titulo: z.string(),
  area: z.string(),
  ciudad: z.string(),
  descripcion: z.string(),
  prioridad: z.enum(["Alta", "Media", "Baja"]),
  estado: z.enum(["INICIADO", "CERRADO"]),
  fecha_inicio: fecha,
  vigencia_dias: z.number().int(),
  total_postulaciones: z.number().int(),
  etapas: z.array(esquemaEtapa),
});

export const esquemaPostulante = z.object({
  id: z.uuid(),
  nombre: z.string(),
  apellido: z.string(),
  correo: z.email(),
  telefono: z.string().nullable(),
  ciudad: z.string().nullable(),
  referencia_externa: z.string().nullable(),
  creado_en: fecha,
  actualizado_en: fecha,
});

export const esquemaDocumento = z.object({
  id: z.uuid(),
  postulante_id: z.uuid(),
  tipo: z.literal("CV"),
  nombre_archivo: z.string(),
  mime: z.string(),
  tamano: z.number().int(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  creado_en: fecha,
});

export const esquemaPostulacion = z.object({
  id: z.uuid(),
  proceso_id: z.number().int(),
  postulante_id: z.uuid(),
  documento_id: z.uuid().nullable(),
  etapa: z.object({ id: z.uuid(), nombre: z.string(), orden: z.number().int() }),
  calificacion: z.string(),
  fuente: z.string(),
  referencia_externa: z.string().nullable(),
  descartada: z.boolean(),
  creada_en: fecha,
  actualizada_en: fecha,
});

export const esquemaLlaveActual = z.object({
  nombre: z.string(),
  prefijo: z.string(),
  permisos: z.object({ seleccion: z.object({ lectura: z.boolean(), modificacion: z.boolean() }) }),
  creada_en: fecha,
});

export const esquemaError = z.object({
  error: z.object({ codigo: z.string(), mensaje: z.string(), detalle: z.record(z.string(), z.unknown()).optional() }),
});

export const esquemaPaginacion = z.object({ pagina: z.number().int(), por_pagina: z.number().int(), total: z.number().int() });

export const vistaEtapa = (e: Etapa & { _count?: { postulaciones: number } }) => ({
  id: e.id,
  nombre: e.nombre,
  orden: e.orden,
  tipo: etiquetaTipo(e.tipo, e.orden),
  postulantes: e._count?.postulaciones ?? 0,
});

export const vistaProceso = (p: ProcesoCompleto) => ({
  id: p.id,
  titulo: p.titulo,
  area: p.area,
  ciudad: p.ciudad,
  descripcion: p.descripcion,
  prioridad: p.prioridad as "Alta" | "Media" | "Baja",
  estado: p.estado as "INICIADO" | "CERRADO",
  fecha_inicio: p.fechaInicio.toISOString(),
  vigencia_dias: vigenciaDias(p.fechaInicio),
  total_postulaciones: p._count.postulaciones,
  etapas: p.etapas.map(vistaEtapa),
});

export const vistaPostulante = (p: Postulante) => ({
  id: p.id,
  nombre: p.nombre,
  apellido: p.apellido,
  correo: p.correo,
  telefono: p.telefono,
  ciudad: p.ciudad,
  referencia_externa: p.referenciaExterna,
  creado_en: p.creadoEn.toISOString(),
  actualizado_en: p.actualizadoEn.toISOString(),
});

export const vistaDocumento = (d: Omit<Documento, "contenido">) => ({
  id: d.id,
  postulante_id: d.postulanteId,
  tipo: "CV" as const,
  nombre_archivo: d.nombreArchivo,
  mime: d.mime,
  tamano: d.tamano,
  sha256: d.sha256,
  creado_en: d.creadoEn.toISOString(),
});

export const vistaPostulacion = (p: PostulacionCompleta) => ({
  id: p.id,
  proceso_id: p.procesoId,
  postulante_id: p.postulanteId,
  documento_id: p.documentoId,
  etapa: { id: p.etapa.id, nombre: p.etapa.nombre, orden: p.etapa.orden },
  calificacion: p.calificacion,
  fuente: p.fuente,
  referencia_externa: p.referenciaExterna,
  descartada: p.descartadaEn !== null,
  creada_en: p.creadaEn.toISOString(),
  actualizada_en: p.actualizadaEn.toISOString(),
});

import { z } from "zod";
import { prisma, esViolacionUnica } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { apiHabilitada } from "@/lib/config";
import { aplicacionAutorizada, validarWebhook } from "./aplicaciones";

// Vacantes de Vínculo: buscador público, gestión del reclutador y publicación por API desde un ATS (jobPostings).

export const MODALIDADES = { PRESENCIAL: "Presencial", HIBRIDO: "Híbrido", REMOTO: "Remoto" } as const;
export const NIVELES = { PRACTICANTE: "Practicante", JUNIOR: "Junior", SEMI_SENIOR: "Semi-senior", SENIOR: "Senior" } as const;
export const TIPOS_EMPLEO = { TIEMPO_COMPLETO: "Tiempo completo", MEDIO_TIEMPO: "Medio tiempo", CONTRATO: "Contrato", PRACTICA: "Práctica" } as const;
export type Modalidad = keyof typeof MODALIDADES;

const claves = <T extends object>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

const incluirEmpresa = { empresa: true } satisfies Prisma.VacanteInclude;
export type VacanteConEmpresa = Prisma.VacanteGetPayload<{ include: typeof incluirEmpresa }>;

export interface FiltrosBusqueda {
  q?: string;
  ciudad?: string;
  modalidad?: string;
  nivel?: string;
  empresa?: string;
  pagina?: number;
}

export const POR_PAGINA = 10;

export async function buscarVacantes(f: FiltrosBusqueda) {
  const q = f.q?.trim();
  const where: Prisma.VacanteWhereInput = {
    estado: "PUBLICADA",
    ...(q ? { OR: [{ titulo: { contains: q, mode: "insensitive" } }, { descripcion: { contains: q, mode: "insensitive" } }, { empresa: { nombre: { contains: q, mode: "insensitive" } } }] } : {}),
    ...(f.ciudad ? { ciudad: { contains: f.ciudad.trim(), mode: "insensitive" } } : {}),
    ...(f.modalidad && f.modalidad in MODALIDADES ? { modalidad: f.modalidad } : {}),
    ...(f.nivel && f.nivel in NIVELES ? { nivel: f.nivel } : {}),
    ...(f.empresa ? { empresa: { slug: f.empresa } } : {}),
  };
  const pagina = Math.max(1, f.pagina ?? 1);
  const [total, vacantes] = await Promise.all([
    prisma.vacante.count({ where }),
    prisma.vacante.findMany({ where, include: incluirEmpresa, orderBy: [{ publicadaEn: "desc" }, { creadaEn: "desc" }], skip: (pagina - 1) * POR_PAGINA, take: POR_PAGINA }),
  ]);
  return { total, pagina, paginas: Math.max(1, Math.ceil(total / POR_PAGINA)), vacantes };
}

// ───────────── Vacantes creadas en Vínculo por el reclutador ─────────────

export const esquemaVacante = z.object({
  titulo: z.string().trim().min(5, "El título debe tener al menos 5 caracteres.").max(120, "Máximo 120 caracteres."),
  descripcion: z.string().trim().min(60, "La descripción debe tener al menos 60 caracteres.").max(6000, "Máximo 6000 caracteres."),
  ciudad: z.string().trim().min(2, "Indica la ciudad.").max(60),
  modalidad: z.enum(claves(MODALIDADES), { error: "Elige una modalidad." }),
  nivel: z.enum(claves(NIVELES), { error: "Elige un nivel." }),
  tipoEmpleo: z.enum(claves(TIPOS_EMPLEO), { error: "Elige el tipo de empleo." }),
  // VINCULO = «Solicitud sencilla»: la postulación ocurre en Vínculo. Si además se elige una aplicación de ATS autorizada,
  // cada postulación se entrega a su webhook; sin aplicación, quedan en Vínculo y el reclutador descarga los CV a mano.
  recepcion: z.enum(["VINCULO", "SITIO_EMPRESA"], { error: "Elige dónde se reciben las postulaciones." }).default("VINCULO"),
  aplicacionId: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  urlEmpresa: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined)
    .pipe(z.url("Escribe una URL válida, por ejemplo https://empresa.test/empleos.").optional()),
});
export type ErroresVacante = Partial<Record<keyof z.input<typeof esquemaVacante> | "general", string>>;

function errores(issues: z.core.$ZodIssue[]): ErroresVacante {
  const e: ErroresVacante = {};
  for (const i of issues) e[i.path[0] as keyof ErroresVacante] ??= i.message;
  return e;
}

/** Siguiente código propio libre con el formato VIN-AAAA-NNNN (externalJobId de las vacantes creadas en Vínculo). */
export async function siguienteCodigo(ahora = new Date()): Promise<string> {
  const prefijo = `VIN-${ahora.getFullYear()}-`;
  const existentes = await prisma.vacante.findMany({ where: { aplicacionId: null, externalJobId: { startsWith: prefijo } }, select: { externalJobId: true } });
  const max = existentes.reduce((m, v) => Math.max(m, Number(v.externalJobId.slice(prefijo.length)) || 0), 0);
  return `${prefijo}${String(max + 1).padStart(4, "0")}`;
}

async function destinoDeAplicacion(empresaId: string, recepcion: "VINCULO" | "SITIO_EMPRESA", aplicacionId?: string) {
  if (recepcion === "SITIO_EMPRESA") return { solicitudSencilla: false, aplicacionId: null, webhookUrl: null, motivo: null };
  // Con la API apagada (VINCULO_API_HABILITADA) no hay ATS conectados: las postulaciones quedan en Vínculo.
  if (!aplicacionId || !apiHabilitada()) return { solicitudSencilla: true, aplicacionId: null, webhookUrl: null, motivo: null };
  const app = await prisma.aplicacionDev.findUnique({ where: { id: aplicacionId } });
  if (!app || app.revocadaEn || !(await aplicacionAutorizada(app.id, empresaId))) {
    return { error: "La aplicación elegida no está autorizada para la empresa." } as const;
  }
  if (!app.webhookUrl) return { solicitudSencilla: false, aplicacionId: app.id, webhookUrl: null, motivo: "La aplicación no tiene webhook registrado." };
  const v = await validarWebhook(app.webhookUrl, app);
  return { solicitudSencilla: v.ok, aplicacionId: app.id, webhookUrl: app.webhookUrl, motivo: v.ok ? null : `Validación del webhook fallida: ${v.detalle}` };
}

export async function crearVacante(empresaId: string, entrada: unknown, publicar: boolean) {
  const r = esquemaVacante.safeParse(entrada);
  if (!r.success) return { ok: false as const, errores: errores(r.error.issues) };
  const destino = await destinoDeAplicacion(empresaId, r.data.recepcion, r.data.aplicacionId);
  if ("error" in destino) return { ok: false as const, errores: { aplicacionId: destino.error } };
  for (let intento = 0; intento < 3; intento++) {
    try {
      const v = await prisma.vacante.create({
        data: {
          empresaId,
          externalJobId: await siguienteCodigo(),
          titulo: r.data.titulo,
          descripcion: r.data.descripcion,
          ciudad: r.data.ciudad,
          modalidad: r.data.modalidad,
          nivel: r.data.nivel,
          tipoEmpleo: r.data.tipoEmpleo,
          urlEmpresa: r.data.urlEmpresa ?? null,
          solicitudSencilla: destino.solicitudSencilla,
          aplicacionId: destino.aplicacionId,
          webhookUrl: destino.webhookUrl,
          motivoSinSolicitud: destino.motivo,
          estado: publicar ? "PUBLICADA" : "BORRADOR",
          publicadaEn: publicar ? new Date() : null,
          demo: false,
        },
      });
      return { ok: true as const, vacante: v };
    } catch (e) {
      if (!esViolacionUnica(e)) throw e;
    }
  }
  return { ok: false as const, errores: { general: "No se pudo asignar un código a la vacante. Intenta de nuevo." } };
}

export async function editarVacante(empresaId: string, id: string, entrada: unknown) {
  const r = esquemaVacante.safeParse(entrada);
  if (!r.success) return { ok: false as const, errores: errores(r.error.issues) };
  const v = await prisma.vacante.findFirst({ where: { id, empresaId } });
  if (!v) return { ok: false as const, errores: { general: "La vacante no existe." } };
  // Las vacantes publicadas por un ATS se gestionan desde el ATS: aquí solo se editan los datos visibles.
  const nativa = v.externalJobId.startsWith("VIN-");
  const destino = nativa ? await destinoDeAplicacion(empresaId, r.data.recepcion, r.data.aplicacionId) : null;
  if (destino && "error" in destino) return { ok: false as const, errores: { aplicacionId: destino.error } };
  await prisma.vacante.update({
    where: { id },
    data: {
      titulo: r.data.titulo,
      descripcion: r.data.descripcion,
      ciudad: r.data.ciudad,
      modalidad: r.data.modalidad,
      nivel: r.data.nivel,
      tipoEmpleo: r.data.tipoEmpleo,
      urlEmpresa: r.data.urlEmpresa ?? null,
      ...(destino ? { solicitudSencilla: destino.solicitudSencilla, aplicacionId: destino.aplicacionId, webhookUrl: destino.webhookUrl, motivoSinSolicitud: destino.motivo } : {}),
    },
  });
  return { ok: true as const };
}

export async function cambiarEstadoVacante(empresaId: string, id: string, estado: "PUBLICADA" | "CERRADA") {
  const ahora = new Date();
  const r = await prisma.vacante.updateMany({
    where: { id, empresaId },
    data: estado === "CERRADA" ? { estado, cerradaEn: ahora } : { estado, cerradaEn: null, publicadaEn: ahora },
  });
  return r.count === 1;
}

// ───────────── Publicación por API (jobPostings, contrato del simulador modelado sobre Apply Connect) ─────────────

export const esquemaJobPosting = z.object({
  externalJobId: z.string().trim().min(1).max(100),
  companyId: z.uuid(),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(10_000),
  location: z.string().trim().min(2).max(100),
  workplaceType: z.enum(["ON_SITE", "HYBRID", "REMOTE"]),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP"]).default("FULL_TIME"),
  experienceLevel: z.enum(["INTERNSHIP", "ENTRY_LEVEL", "MID_SENIOR_LEVEL", "SENIOR"]).default("MID_SENIOR_LEVEL"),
  listingType: z.enum(["BASIC", "PREMIUM"]).default("BASIC"),
  companyApplyUrl: z.url().optional(),
  onsiteApply: z.object({ jobApplicationWebhookUrl: z.url() }).optional(),
});
export type JobPosting = z.infer<typeof esquemaJobPosting>;

const MODALIDAD_DE: Record<JobPosting["workplaceType"], Modalidad> = { ON_SITE: "PRESENCIAL", HYBRID: "HIBRIDO", REMOTE: "REMOTO" };
const TIPO_DE: Record<JobPosting["employmentType"], keyof typeof TIPOS_EMPLEO> = { FULL_TIME: "TIEMPO_COMPLETO", PART_TIME: "MEDIO_TIEMPO", CONTRACT: "CONTRATO", INTERNSHIP: "PRACTICA" };
const NIVEL_DE: Record<JobPosting["experienceLevel"], keyof typeof NIVELES> = { INTERNSHIP: "PRACTICANTE", ENTRY_LEVEL: "JUNIOR", MID_SENIOR_LEVEL: "SEMI_SENIOR", SENIOR: "SENIOR" };

export type ResultadoPublicacion =
  | { ok: true; creada: boolean; vacante: VacanteConEmpresa; validacion: string | null }
  | { ok: false; status: number; codigo: string; mensaje: string; detalle?: Record<string, unknown> };

/**
 * Crea o actualiza la vacante (idempotente por aplicación + externalJobId). Si pide «Solicitud sencilla» (onsiteApply),
 * Vínculo valida el webhook por desafío ANTES de publicar; si falla, la vacante queda como «postulación en el sitio de
 * la empresa», igual que hace LinkedIn (docs/contratos.md).
 */
export async function publicarDesdeApi(app: { id: string; clientId: string; secretoCifrado: string }, entrada: unknown, fetchImpl?: typeof fetch): Promise<ResultadoPublicacion> {
  const r = esquemaJobPosting.safeParse(entrada);
  if (!r.success) {
    return { ok: false, status: 400, codigo: "INVALID_REQUEST", mensaje: "Datos inválidos.", detalle: { campos: r.error.issues.map((i) => ({ campo: i.path.join("."), mensaje: i.message })) } };
  }
  const d = r.data;
  const empresa = await prisma.empresa.findUnique({ where: { id: d.companyId } });
  if (!empresa) return { ok: false, status: 404, codigo: "COMPANY_NOT_FOUND", mensaje: "La empresa no existe en el Simulador LinkedIn." };
  if (!(await aplicacionAutorizada(app.id, empresa.id))) {
    return { ok: false, status: 403, codigo: "COMPANY_NOT_AUTHORIZED", mensaje: "La empresa no ha autorizado a esta aplicación (Conectar ATS)." };
  }
  let solicitudSencilla = false;
  let motivo: string | null = null;
  let validacion: string | null = null;
  if (d.onsiteApply) {
    const v = await validarWebhook(d.onsiteApply.jobApplicationWebhookUrl, { clientId: app.clientId, secretoCifrado: app.secretoCifrado }, fetchImpl);
    solicitudSencilla = v.ok;
    validacion = v.detalle;
    motivo = v.ok ? null : `Validación del webhook fallida: ${v.detalle}`;
  }
  const datos = {
    titulo: d.title,
    descripcion: d.description,
    ciudad: d.location,
    modalidad: MODALIDAD_DE[d.workplaceType],
    nivel: NIVEL_DE[d.experienceLevel],
    tipoEmpleo: TIPO_DE[d.employmentType],
    urlEmpresa: d.companyApplyUrl ?? empresa.sitioWeb,
    solicitudSencilla,
    webhookUrl: solicitudSencilla ? d.onsiteApply!.jobApplicationWebhookUrl : null,
    motivoSinSolicitud: motivo,
  };
  const existente = await prisma.vacante.findUnique({ where: { aplicacionId_externalJobId: { aplicacionId: app.id, externalJobId: d.externalJobId } } });
  if (existente && existente.empresaId !== empresa.id) {
    return { ok: false, status: 409, codigo: "EXTERNAL_JOB_ID_IN_USE", mensaje: "Ese externalJobId ya se usa para otra empresa." };
  }
  const ahora = new Date();
  const vacante = existente
    ? await prisma.vacante.update({ where: { id: existente.id }, data: { ...datos, estado: "PUBLICADA", cerradaEn: null, publicadaEn: existente.estado === "PUBLICADA" ? existente.publicadaEn : ahora }, include: incluirEmpresa })
    : await prisma.vacante.create({ data: { ...datos, empresaId: empresa.id, aplicacionId: app.id, externalJobId: d.externalJobId, estado: "PUBLICADA", publicadaEn: ahora, demo: false }, include: incluirEmpresa });
  return { ok: true, creada: !existente, vacante, validacion };
}

/** Cierra la vacante publicada por la aplicación. Las postulaciones nuevas se rechazan; las enviadas antes se entregan igual. */
export async function cerrarDesdeApi(appId: string, externalJobId: string) {
  const v = await prisma.vacante.findUnique({ where: { aplicacionId_externalJobId: { aplicacionId: appId, externalJobId } }, include: incluirEmpresa });
  if (!v) return null;
  if (v.estado === "CERRADA") return v;
  return prisma.vacante.update({ where: { id: v.id }, data: { estado: "CERRADA", cerradaEn: new Date() }, include: incluirEmpresa });
}

export function etiquetaModalidad(m: string) {
  return MODALIDADES[m as Modalidad] ?? m;
}
export function etiquetaNivel(n: string) {
  return NIVELES[n as keyof typeof NIVELES] ?? n;
}
export function etiquetaTipoEmpleo(t: string) {
  return TIPOS_EMPLEO[t as keyof typeof TIPOS_EMPLEO] ?? t;
}

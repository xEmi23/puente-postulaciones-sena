import { z } from "zod";
import { prisma, esViolacionUnica } from "@/lib/db";

// Gestión de vacantes del portal de origen (lo que en el mundo real haría el ATS al publicar en LinkedIn).

export const esquemaVacante = z.object({
  titulo: z.string().trim().min(5, "El título debe tener al menos 5 caracteres.").max(120, "Máximo 120 caracteres."),
  area: z.string().trim().min(2, "Indica el área.").max(60),
  ciudad: z.string().trim().min(2, "Indica la ciudad.").max(60),
  modalidad: z.enum(["Presencial", "Híbrido", "Remoto"], { error: "Elige una modalidad." }),
  descripcion: z.string().trim().min(60, "La descripción debe tener al menos 60 caracteres.").max(4000, "Máximo 4000 caracteres."),
});

export type DatosVacante = z.infer<typeof esquemaVacante>;
export type ErroresVacante = Partial<Record<keyof DatosVacante | "general", string>>;

function errores(issues: z.core.$ZodIssue[]): ErroresVacante {
  const e: ErroresVacante = {};
  for (const i of issues) e[i.path[0] as keyof DatosVacante] ??= i.message;
  return e;
}

/** Siguiente código libre con el formato RT-AAAA-NNN. */
export async function siguienteCodigo(ahora = new Date()): Promise<string> {
  const prefijo = `RT-${ahora.getFullYear()}-`;
  const existentes = await prisma.vacante.findMany({ where: { codigo: { startsWith: prefijo } }, select: { codigo: true } });
  const max = existentes.reduce((m, v) => Math.max(m, Number(v.codigo.slice(prefijo.length)) || 0), 100);
  return `${prefijo}${String(max + 1).padStart(3, "0")}`;
}

export async function crearVacante(entrada: Record<string, unknown>): Promise<{ ok: true; codigo: string } | { ok: false; errores: ErroresVacante }> {
  const r = esquemaVacante.safeParse(entrada);
  if (!r.success) return { ok: false, errores: errores(r.error.issues) };
  for (let intento = 0; intento < 3; intento++) {
    const codigo = await siguienteCodigo();
    try {
      await prisma.vacante.create({ data: { ...r.data, codigo, estado: "PUBLICADA", publicadaEn: new Date() } });
      return { ok: true, codigo };
    } catch (e) {
      if (!esViolacionUnica(e)) throw e;
    }
  }
  return { ok: false, errores: { general: "No se pudo asignar un código a la vacante. Intenta de nuevo." } };
}

export async function editarVacante(codigo: string, entrada: Record<string, unknown>): Promise<{ ok: true } | { ok: false; errores: ErroresVacante }> {
  const r = esquemaVacante.safeParse(entrada);
  if (!r.success) return { ok: false, errores: errores(r.error.issues) };
  const v = await prisma.vacante.findUnique({ where: { codigo } });
  if (!v) return { ok: false, errores: { general: "La vacante no existe." } };
  await prisma.vacante.update({ where: { codigo }, data: r.data });
  return { ok: true };
}

/** Cerrar: el portal deja de mostrarla y de aceptar postulaciones. */
export async function cerrarVacante(codigo: string) {
  await prisma.vacante.update({ where: { codigo }, data: { estado: "CERRADA" } });
}

export async function reabrirVacante(codigo: string) {
  await prisma.vacante.update({ where: { codigo }, data: { estado: "PUBLICADA", publicadaEn: new Date() } });
}

import { z } from "zod";
import { prisma, esViolacionUnica } from "@/lib/db";
import { TIPO_ESTADO_VACANTE } from "@/modules/contrato-apply-connect";

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

/**
 * Cambia el estado de la vacante y, en la misma transacción, deja en la outbox un evento JOB_POSTING_STATUS
 * para que el puente lo sepa (contrato del simulador; ver docs/contratos.md §2.1). Si el puente no está
 * disponible, el despachador lo reintenta como cualquier otra entrega.
 */
async function cambiarEstado(codigo: string, estado: "CERRADA" | "PUBLICADA") {
  const cambiadoEn = new Date();
  await prisma.$transaction([
    prisma.vacante.update({
      where: { codigo },
      data: estado === "CERRADA" ? { estado } : { estado, publicadaEn: cambiadoEn },
    }),
    prisma.outbox.create({
      data: {
        tipo: TIPO_ESTADO_VACANTE,
        vacanteCodigo: codigo,
        payload: JSON.stringify({ type: TIPO_ESTADO_VACANTE, externalJobId: codigo, estado, cambiadoEn: cambiadoEn.getTime() }),
      },
    }),
  ]);
}

/** Cerrar: el portal deja de aceptar postulaciones y el puente responde JOB_POSTING_CLOSED a las posteriores al cierre. */
export const cerrarVacante = (codigo: string) => cambiarEstado(codigo, "CERRADA");
export const reabrirVacante = (codigo: string) => cambiarEstado(codigo, "PUBLICADA");

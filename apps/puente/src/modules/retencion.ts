import { prisma } from "@/lib/db";
import { ACTOR_RETENCION, auditar, log } from "@/nucleo/auditoria";

// Retención del CV (ESPECIFICACION_V4 §7 y §11): el binario que el Puente conserva se borra RETENCION_CV_DIAS (30 por
// defecto) después de completar; quedan los metadatos y el SHA-256. Cuando el ATS ya recibió el CV, el Puente lo borra
// al completar (comportamiento de la v2, más estricto; D-58): la retención aplica a lo que el Puente aún guarda (p. ej.,
// «CV no enviado: el ATS no lo admite por API»).

export const RETENCION_CV_DIAS = () => Number(process.env.RETENCION_CV_DIAS ?? 30);

/** Borra los CV vencidos. `ahora` permite simular el reloj en las pruebas. Devuelve cuántos borró. */
export async function aplicarRetencion(ahora: Date = new Date()): Promise<number> {
  const limite = new Date(ahora.getTime() - RETENCION_CV_DIAS() * 86_400_000);
  const vencidas = await prisma.recepcion.findMany({
    where: { estado: "COMPLETADO", completadaEn: { lt: limite }, cvContenido: { not: null } },
    select: { id: true },
    take: 200,
  });
  for (const { id } of vencidas) {
    await prisma.$transaction([
      prisma.recepcion.update({ where: { id }, data: { cvContenido: null, cvBorradoEn: ahora } }),
      prisma.eventoRecepcion.create({ data: { recepcionId: id, tipo: "RETENCION", detalle: `CV borrado por retención (${RETENCION_CV_DIAS()} días después de completar). Se conservan los metadatos y el SHA-256.` } }),
    ]);
    await auditar(ACTOR_RETENCION, "cv.borrado_por_retencion", id);
    log(id, "CV borrado por retención");
  }
  return vencidas.length;
}

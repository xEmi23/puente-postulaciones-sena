import { prisma } from "@/lib/db";
import type { EstadoPostulacion } from "@/generated/prisma/client";

// Estados que ve el candidato en «Mis postulaciones»: Enviada → Vista por la empresa → CV descargado, o No seleccionado.
// Los cambia el reclutador desde Vínculo o la aplicación del ATS con la API de ciclo de vida. Solo avanzan (idempotentes).

export const ETIQUETA_ESTADO: Record<EstadoPostulacion, string> = {
  ENVIADA: "Enviada",
  VISTA: "Vista por la empresa",
  CV_DESCARGADO: "CV descargado",
  NO_SELECCIONADO: "No seleccionado",
};

const ORDEN: Record<EstadoPostulacion, number> = { ENVIADA: 0, VISTA: 1, CV_DESCARGADO: 2, NO_SELECCIONADO: 3 };

export const ACCIONES = { VIEWED: "VISTA", RESUME_DOWNLOADED: "CV_DESCARGADO", REJECTED: "NO_SELECCIONADO" } as const;
export type Accion = keyof typeof ACCIONES;

/** Aplica un estado si representa un avance; devuelve el estado resultante. Repetirlo no cambia nada. */
export async function avanzarEstado(postulacionId: string, destino: EstadoPostulacion): Promise<EstadoPostulacion | null> {
  const p = await prisma.postulacion.findUnique({ where: { id: postulacionId } });
  if (!p) return null;
  if (ORDEN[destino] <= ORDEN[p.estado]) {
    // RESUME_DOWNLOADED después de VIEWED avanza; VIEWED después de CV_DESCARGADO no retrocede.
    return p.estado;
  }
  const ahora = new Date();
  const actualizada = await prisma.postulacion.update({
    where: { id: postulacionId },
    data: {
      estado: destino,
      vistaEn: p.vistaEn ?? (destino === "VISTA" || destino === "CV_DESCARGADO" ? ahora : null),
      cvDescargadoEn: destino === "CV_DESCARGADO" ? ahora : p.cvDescargadoEn,
      rechazadaEn: destino === "NO_SELECCIONADO" ? ahora : p.rechazadaEn,
    },
  });
  return actualizada.estado;
}

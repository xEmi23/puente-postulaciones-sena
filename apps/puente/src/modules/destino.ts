import { prisma } from "@/lib/db";

// ¿A qué proceso de Talentia va una postulación de Vínculo? El puente nunca adivina:
//  1. Vacante publicada por el puente (Publicacion, externalJobId = id del proceso).
//  2. Correspondencia manual (vacantes creadas directamente en Vínculo).
// Una vacante cerrada (en Vínculo por el puente, o desvinculada a mano) solo admite las postulaciones hechas ANTES
// del cierre: no se castiga al postulante por una demora de entrega que no es suya (D-17).

export type Destino = { ok: true; procesoId: number; origen: "PUBLICACION" | "CORRESPONDENCIA" } | { ok: false; motivo: string };

const anterior = (aplicadaEn: Date, cerradaEn: Date | null) => cerradaEn !== null && aplicadaEn.getTime() < cerradaEn.getTime();

export async function resolverDestino(externalJobId: string, aplicadaEn: Date): Promise<Destino> {
  const pub = await prisma.publicacion.findUnique({ where: { externalJobId } });
  if (pub) {
    if (pub.estado === "PUBLICADA" || (pub.estado === "CERRADA" && anterior(aplicadaEn, pub.cerradaEn))) return { ok: true, procesoId: pub.procesoId, origen: "PUBLICACION" };
    return { ok: false, motivo: "La vacante se cerró en Vínculo antes de esta postulación." };
  }
  const corr = await prisma.correspondencia.findUnique({ where: { externalJobId } });
  if (corr) {
    if (corr.activa || anterior(aplicadaEn, corr.cerradaEn)) return { ok: true, procesoId: corr.procesoAtsId, origen: "CORRESPONDENCIA" };
    return { ok: false, motivo: "La vacante está desvinculada en el puente." };
  }
  return { ok: false, motivo: "La vacante no tiene un proceso de Talentia asociado (ni publicación ni correspondencia)." };
}

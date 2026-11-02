import { prisma } from "@/lib/db";

// ¿A qué proceso del ATS va una postulación? El puente nunca adivina:
//  1. Apply Connect: vacante publicada por el puente (Publicacion, externalJobId = id del proceso).
//  2. Correspondencia (fuente, vacante externa) → proceso, creada a mano en el panel (V4: genérica para todas las fuentes).
// Una vacante cerrada (en Vínculo por el puente, o desvinculada a mano) solo admite las postulaciones hechas ANTES
// del cierre: no se castiga al postulante por una demora de entrega que no es suya (D-17).

export type Destino = { ok: true; procesoId: number; origen: "PUBLICACION" | "CORRESPONDENCIA" } | { ok: false; motivo: string };

const anterior = (aplicadaEn: Date, cerradaEn: Date | null) => cerradaEn !== null && aplicadaEn.getTime() < cerradaEn.getTime();

/** Referencia única de una correspondencia: la vacante tal cual en apply-connect (v2), "<fuente>:<vacante>" en las demás. */
export function referenciaCorrespondencia(fuente: string, vacanteExterna: string): string {
  return fuente === "apply-connect" ? vacanteExterna : `${fuente}:${vacanteExterna}`;
}

export async function resolverDestino(fuente: string, vacanteExterna: string, aplicadaEn: Date): Promise<Destino> {
  if (fuente === "apply-connect") {
    const pub = await prisma.publicacion.findUnique({ where: { externalJobId: vacanteExterna } });
    if (pub) {
      if (pub.estado === "PUBLICADA" || (pub.estado === "CERRADA" && anterior(aplicadaEn, pub.cerradaEn))) return { ok: true, procesoId: pub.procesoId, origen: "PUBLICACION" };
      return { ok: false, motivo: "La vacante se cerró en Vínculo antes de esta postulación." };
    }
  }
  const corr = await prisma.correspondencia.findUnique({ where: { externalJobId: referenciaCorrespondencia(fuente, vacanteExterna) } });
  if (corr) {
    if (corr.activa || anterior(aplicadaEn, corr.cerradaEn)) return { ok: true, procesoId: corr.procesoAtsId, origen: "CORRESPONDENCIA" };
    return { ok: false, motivo: "La vacante está desvinculada en el puente." };
  }
  return {
    ok: false,
    motivo:
      fuente === "apply-connect"
        ? "La vacante no tiene un proceso de Talentia asociado (ni publicación ni correspondencia)."
        : `La vacante «${vacanteExterna}» de la fuente «${fuente}» no tiene correspondencia con un proceso del ATS.`,
  };
}

import { prisma } from "@/lib/db";

// Auditoría (ESPECIFICACION_V4 §7): cada acción manual y cada cambio de estado deja un evento con su actor
// (usuario, fuente o sistema), la acción, la recepción y la hora. NUNCA datos personales: ni nombres, ni correos,
// ni teléfonos (el detalle es un texto fijo o un código).

export interface Actor {
  tipo: "usuario" | "fuente" | "sistema";
  id: string;
}

export const ACTOR_PROCESADOR: Actor = { tipo: "sistema", id: "procesador" };
export const ACTOR_RETENCION: Actor = { tipo: "sistema", id: "retencion" };

export async function auditar(actor: Actor, accion: string, recepcionId?: string | null, detalle?: string) {
  await prisma.eventoAuditoria.create({
    data: { actorTipo: actor.tipo, actorId: actor.id, accion, recepcionId: recepcionId ?? null, detalle: detalle ?? null },
  });
}

/** Línea de log sin datos personales, correlacionable por idRecepcion. */
export function log(idRecepcion: string, mensaje: string) {
  console.log(`[puente] idRecepcion=${idRecepcion} ${mensaje}`);
}

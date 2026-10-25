import { z } from "zod";
import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import { firmaValida } from "@/lib/firma";
import { TIPO_ESTADO_VACANTE, cuerpoError } from "@/modules/contrato-apply-connect";
import type { Correspondencia } from "@/generated/prisma/client";
import type { RespuestaHttp } from "./webhook";

/**
 * ¿La correspondencia admite una postulación hecha en `aplicadaEn`?
 * - Activa → sí.
 * - Cerrada desde el origen → solo si la persona se postuló ANTES del cierre (no se castiga al postulante por la demora de entrega).
 * - Desvinculada a mano o inexistente → no.
 */
export function admitePostulacion(corr: Pick<Correspondencia, "activa" | "cerradaEn"> | null, aplicadaEn: Date): boolean {
  if (!corr) return false;
  if (corr.activa) return true;
  return corr.cerradaEn !== null && aplicadaEn.getTime() < corr.cerradaEn.getTime();
}

const esquemaEstado = z.object({
  type: z.literal(TIPO_ESTADO_VACANTE),
  externalJobId: z.string().min(1).max(200),
  estado: z.enum(["CERRADA", "PUBLICADA"]),
  cambiadoEn: z.number().int().positive(),
});

/**
 * Aplica un cambio de estado de vacante enviado por el origen (contrato del simulador, firmado igual que el webhook).
 * Idempotente y tolerante al desorden: un evento más viejo que el último aplicado se ignora.
 */
export async function aplicarEstadoVacante(cuerpoCrudo: string, firma: string | null): Promise<RespuestaHttp> {
  if (!firmaValida(cuerpoCrudo, firma, config().SIM_CLIENT_SECRET)) return { status: 401, body: cuerpoError("SIGNATURE_MISMATCH") };
  let json: unknown;
  try {
    json = JSON.parse(cuerpoCrudo);
  } catch {
    return { status: 400, body: cuerpoError("INPUT_VALIDATION_FAILED") };
  }
  const r = esquemaEstado.safeParse(json);
  if (!r.success) return { status: 400, body: cuerpoError("INPUT_VALIDATION_FAILED") };
  const { externalJobId, estado } = r.data;
  const cambiadoEn = new Date(r.data.cambiadoEn);

  const corr = await prisma.correspondencia.findUnique({ where: { externalJobId } });
  if (!corr) return { status: 200, body: { estado: "SIN_CORRESPONDENCIA" } };
  if (corr.estadoOrigenEn && corr.estadoOrigenEn.getTime() >= cambiadoEn.getTime()) {
    return { status: 200, body: { estado: "IGNORADO_EVENTO_ANTERIOR" } };
  }
  if (estado === "CERRADA") {
    await prisma.correspondencia.update({
      where: { externalJobId },
      data: corr.activa
        ? { activa: false, motivoCierre: "ORIGEN", cerradaEn: cambiadoEn, estadoOrigenEn: cambiadoEn }
        : { estadoOrigenEn: cambiadoEn },
    });
    return { status: 200, body: { estado: "CERRADA" } };
  }
  // Reapertura: solo reactiva lo que cerró el origen; una desvinculación manual del panel se respeta.
  await prisma.correspondencia.update({
    where: { externalJobId },
    data:
      corr.motivoCierre === "ORIGEN"
        ? { activa: true, motivoCierre: null, cerradaEn: null, estadoOrigenEn: cambiadoEn }
        : { estadoOrigenEn: cambiadoEn },
  });
  return { status: 200, body: { estado: corr.motivoCierre === "MANUAL" ? "SIGUE_DESVINCULADA" : "PUBLICADA" } };
}

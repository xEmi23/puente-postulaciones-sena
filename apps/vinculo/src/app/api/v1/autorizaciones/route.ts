import { prisma } from "@/lib/db";
import { conAplicacion, respuesta } from "@/modules/api/http";

export const dynamic = "force-dynamic";

/** Empresas que autorizaron a esta aplicación (contrato del simulador): el integrador obtiene aquí el companyId. */
export function GET(req: Request) {
  return conAplicacion(req, async (app) => {
    const filas = await prisma.autorizacionEmpresa.findMany({ where: { aplicacionId: app.id, revocadaEn: null }, include: { empresa: true }, orderBy: { creadaEn: "asc" } });
    return respuesta(200, {
      application: { clientId: app.clientId, name: app.nombre, webhookStatus: app.webhookEstado },
      elements: filas.map((f) => ({ companyId: f.empresaId, name: f.empresa.nombre, authorizedAt: f.creadaEn.toISOString() })),
    });
  });
}

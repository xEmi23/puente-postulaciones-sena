import { z } from "zod";
import { prisma } from "@/lib/db";
import { conAplicacion, error, leerJson, respuesta } from "@/modules/api/http";
import { ACCIONES, avanzarEstado } from "@/modules/estados";

export const dynamic = "force-dynamic";

const esquema = z.object({ action: z.enum(["VIEWED", "RESUME_DOWNLOADED", "REJECTED"]) });

/** Informa al candidato lo que pasó con su postulación (aparece en «Mis postulaciones»). Idempotente. */
export function POST(req: Request, ctx: { params: Promise<{ jobApplicationId: string }> }) {
  return conAplicacion(req, async (app) => {
    const cuerpo = await leerJson(req);
    if (!cuerpo.ok) return cuerpo.respuesta;
    const r = esquema.safeParse(cuerpo.datos);
    if (!r.success) return error(400, "INVALID_REQUEST", "action debe ser VIEWED, RESUME_DOWNLOADED o REJECTED.");
    const jobApplicationId = decodeURIComponent((await ctx.params).jobApplicationId);
    const p = await prisma.postulacion.findUnique({ where: { jobApplicationId }, include: { vacante: { select: { aplicacionId: true } } } });
    if (!p) return error(404, "JOB_APPLICATION_NOT_FOUND", "La postulación no existe.");
    if (p.vacante.aplicacionId !== app.id) return error(403, "ACCESS_DENIED", "La postulación pertenece a una vacante de otra aplicación.");
    const estado = await avanzarEstado(p.id, ACCIONES[r.data.action]);
    return respuesta(200, { jobApplicationId, action: r.data.action, status: estado });
  });
}

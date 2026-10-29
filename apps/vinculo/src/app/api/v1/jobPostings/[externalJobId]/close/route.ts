import { urlPublica } from "@/lib/config";
import { conAplicacion, error, respuesta } from "@/modules/api/http";
import { vistaJobPosting } from "@/modules/api/vistas";
import { cerrarDesdeApi } from "@/modules/vacantes";

export const dynamic = "force-dynamic";

/** Cierra la vacante: deja de recibir postulaciones. Repetirlo no cambia nada. */
export function POST(req: Request, ctx: { params: Promise<{ externalJobId: string }> }) {
  return conAplicacion(req, async (app) => {
    const v = await cerrarDesdeApi(app.id, decodeURIComponent((await ctx.params).externalJobId));
    return v ? respuesta(200, vistaJobPosting(v, urlPublica())) : error(404, "JOB_POSTING_NOT_FOUND", "La aplicación no tiene una vacante con ese externalJobId.");
  });
}

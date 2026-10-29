import { urlPublica } from "@/lib/config";
import { conAplicacion, error, leerJson, respuesta } from "@/modules/api/http";
import { vistaJobPosting } from "@/modules/api/vistas";
import { publicarDesdeApi } from "@/modules/vacantes";

export const dynamic = "force-dynamic";

/** Publica o actualiza una vacante de una empresa que autorizó a la aplicación (idempotente por externalJobId). */
export function POST(req: Request) {
  return conAplicacion(req, async (app) => {
    const cuerpo = await leerJson(req);
    if (!cuerpo.ok) return cuerpo.respuesta;
    const r = await publicarDesdeApi(app, cuerpo.datos);
    if (!r.ok) return error(r.status, r.codigo, r.mensaje, r.detalle);
    return respuesta(r.creada ? 201 : 200, { ...vistaJobPosting(r.vacante, urlPublica()), webhookValidation: r.validacion });
  });
}

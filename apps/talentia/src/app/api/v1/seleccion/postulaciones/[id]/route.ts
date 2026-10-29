import { conApi, conIdempotencia, desdeFallo, error, leerJson, respuesta } from "@/modules/api/http";
import { vistaPostulacion } from "@/modules/api/vistas";
import { cambiarPostulacion, obtenerPostulacion } from "@/modules/seleccion";

export const dynamic = "force-dynamic";
const RUTA = "/api/v1/seleccion/postulaciones/{id}";

export function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return conApi(req, RUTA, "lectura", async () => {
    const p = await obtenerPostulacion((await ctx.params).id);
    return p ? respuesta(200, { data: vistaPostulacion(p) }) : error(404, "NO_ENCONTRADO", "La postulación no existe.");
  });
}

/** Cambia de etapa (etapa_id o etapa por nombre) y/o descarta o restaura. */
export function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return conApi(req, RUTA, "modificacion", async (api) => {
    const cuerpo = await leerJson(req);
    if (!cuerpo.ok) return cuerpo.respuesta;
    return conIdempotencia(req, api, cuerpo.crudo, async () => {
      const r = await cambiarPostulacion((await ctx.params).id, cuerpo.datos, api.autor);
      return r.ok ? respuesta(r.status, { data: vistaPostulacion(r.datos) }) : desdeFallo(r);
    });
  });
}

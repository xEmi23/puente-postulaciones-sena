import { conApi, conIdempotencia, desdeFallo, error, leerJson, respuesta } from "@/modules/api/http";
import { vistaPostulante } from "@/modules/api/vistas";
import { actualizarPostulante, obtenerPostulante } from "@/modules/seleccion";

export const dynamic = "force-dynamic";
const RUTA = "/api/v1/seleccion/postulantes/{id}";

export function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return conApi(req, RUTA, "lectura", async () => {
    const p = await obtenerPostulante((await ctx.params).id);
    return p ? respuesta(200, { data: vistaPostulante(p) }) : error(404, "NO_ENCONTRADO", "El postulante no existe.");
  });
}

export function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return conApi(req, RUTA, "modificacion", async (api) => {
    const cuerpo = await leerJson(req);
    if (!cuerpo.ok) return cuerpo.respuesta;
    return conIdempotencia(req, api, cuerpo.crudo, async () => {
      const r = await actualizarPostulante((await ctx.params).id, cuerpo.datos);
      return r.ok ? respuesta(r.status, { data: vistaPostulante(r.datos) }) : desdeFallo(r);
    });
  });
}

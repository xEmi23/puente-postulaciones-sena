import { conApi, error, respuesta } from "@/modules/api/http";
import { vistaProceso } from "@/modules/api/vistas";
import { obtenerProceso } from "@/modules/seleccion";

export const dynamic = "force-dynamic";

export function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return conApi(req, "/api/v1/seleccion/procesos/{id}", "lectura", async () => {
    const id = Number((await ctx.params).id);
    const p = Number.isInteger(id) ? await obtenerProceso(id) : null;
    return p ? respuesta(200, { data: vistaProceso(p) }) : error(404, "NO_ENCONTRADO", "El proceso no existe.");
  });
}

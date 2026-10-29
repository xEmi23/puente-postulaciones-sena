import { conApi, conIdempotencia, desdeFallo, error, leerJson, respuesta } from "@/modules/api/http";
import { vistaProceso } from "@/modules/api/vistas";
import { crearProceso, listarProcesos } from "@/modules/seleccion";

export const dynamic = "force-dynamic";
const RUTA = "/api/v1/seleccion/procesos";

export function GET(req: Request) {
  return conApi(req, RUTA, "lectura", async () => {
    const estado = new URL(req.url).searchParams.get("estado");
    if (estado && !["INICIADO", "CERRADO"].includes(estado)) return error(400, "DATOS_INVALIDOS", "estado debe ser INICIADO o CERRADO.");
    const procesos = await listarProcesos({ estado });
    return respuesta(200, { data: procesos.map(vistaProceso) });
  });
}

export function POST(req: Request) {
  return conApi(req, RUTA, "modificacion", async (ctx) => {
    const cuerpo = await leerJson(req);
    if (!cuerpo.ok) return cuerpo.respuesta;
    return conIdempotencia(req, ctx, cuerpo.crudo, async () => {
      const r = await crearProceso(cuerpo.datos);
      return r.ok ? respuesta(r.status, { data: vistaProceso(r.datos) }) : desdeFallo(r);
    });
  });
}

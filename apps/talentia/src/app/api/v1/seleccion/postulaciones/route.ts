import { conApi, conIdempotencia, desdeFallo, error, leerJson, respuesta } from "@/modules/api/http";
import { vistaPostulacion } from "@/modules/api/vistas";
import { crearPostulacion, listarPostulaciones } from "@/modules/seleccion";

export const dynamic = "force-dynamic";
const RUTA = "/api/v1/seleccion/postulaciones";

/** Filtros: proceso_id y referencia_externa (esta última sirve al puente para reconciliar). */
export function GET(req: Request) {
  return conApi(req, RUTA, "lectura", async () => {
    const q = new URL(req.url).searchParams;
    const procesoTexto = q.get("proceso_id");
    const procesoId = procesoTexto === null ? null : Number(procesoTexto);
    if (procesoId !== null && !Number.isInteger(procesoId)) return error(400, "DATOS_INVALIDOS", "proceso_id debe ser un entero.");
    const filas = await listarPostulaciones({ procesoId, referenciaExterna: q.get("referencia_externa") });
    return respuesta(200, { data: filas.map(vistaPostulacion) });
  });
}

export function POST(req: Request) {
  return conApi(req, RUTA, "modificacion", async (ctx) => {
    const cuerpo = await leerJson(req);
    if (!cuerpo.ok) return cuerpo.respuesta;
    return conIdempotencia(req, ctx, cuerpo.crudo, async () => {
      const r = await crearPostulacion(cuerpo.datos, ctx.autor);
      return r.ok ? respuesta(r.status, { data: vistaPostulacion(r.datos) }) : desdeFallo(r);
    });
  });
}

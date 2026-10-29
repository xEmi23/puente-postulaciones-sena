import { conApi, conIdempotencia, desdeFallo, leerJson, respuesta } from "@/modules/api/http";
import { vistaPostulante } from "@/modules/api/vistas";
import { crearPostulante, listarPostulantes } from "@/modules/seleccion";

export const dynamic = "force-dynamic";
const RUTA = "/api/v1/seleccion/postulantes";

export function GET(req: Request) {
  return conApi(req, RUTA, "lectura", async () => {
    const q = new URL(req.url).searchParams;
    const r = await listarPostulantes({ email: q.get("email"), pagina: Number(q.get("pagina") ?? 1) || 1, porPagina: Number(q.get("por_pagina") ?? 25) || 25 });
    return respuesta(200, { data: r.filas.map(vistaPostulante), paginacion: { pagina: r.pagina, por_pagina: r.porPagina, total: r.total } });
  });
}

export function POST(req: Request) {
  return conApi(req, RUTA, "modificacion", async (ctx) => {
    const cuerpo = await leerJson(req);
    if (!cuerpo.ok) return cuerpo.respuesta;
    return conIdempotencia(req, ctx, cuerpo.crudo, async () => {
      const r = await crearPostulante(cuerpo.datos);
      return r.ok ? respuesta(r.status, { data: vistaPostulante(r.datos) }) : desdeFallo(r);
    });
  });
}

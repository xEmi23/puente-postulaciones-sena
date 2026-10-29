import { json } from "@/lib/http";
import { autorizado, buscarPostulaciones, conIdempotencia, crearPostulacion } from "@/modules/servicio";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!autorizado(req.headers.get("authorization"))) return json(401, { codigo: "NO_AUTORIZADO", mensaje: "Credenciales inválidas." });
  const crudo = await req.text();
  const r = await conIdempotencia(req.headers.get("idempotency-key"), "POST /postulaciones", crudo, () => crearPostulacion(crudo));
  return json(r.status, r.body);
}

/** Consulta por referencia externa: capacidad del simulador para reconciliar (no atribuida a BUK). */
export async function GET(req: Request) {
  if (!autorizado(req.headers.get("authorization"))) return json(401, { codigo: "NO_AUTORIZADO", mensaje: "Credenciales inválidas." });
  const r = await buscarPostulaciones(new URL(req.url).searchParams.get("referenciaExterna"));
  return json(r.status, r.body);
}

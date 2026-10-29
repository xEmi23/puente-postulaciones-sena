import { json } from "@/lib/http";
import { autorizado, conIdempotencia, crearOBuscarCandidato } from "@/modules/servicio";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!autorizado(req.headers.get("authorization"))) return json(401, { codigo: "NO_AUTORIZADO", mensaje: "Credenciales inválidas." });
  const crudo = await req.text();
  const r = await conIdempotencia(req.headers.get("idempotency-key"), "POST /candidatos", crudo, () => crearOBuscarCandidato(crudo));
  return json(r.status, r.body);
}

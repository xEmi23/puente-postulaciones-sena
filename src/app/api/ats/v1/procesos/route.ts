import { json } from "@/lib/http";
import { autorizado, listarProcesos } from "@/modules/ats/servicio";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!autorizado(req.headers.get("authorization"))) return json(401, { codigo: "NO_AUTORIZADO", mensaje: "Credenciales inválidas." });
  const r = await listarProcesos();
  return json(r.status, r.body);
}

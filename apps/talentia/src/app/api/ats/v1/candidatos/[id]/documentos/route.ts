import { json } from "@/lib/http";
import { autorizado, conIdempotencia, subirDocumento } from "@/modules/servicio";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!autorizado(req.headers.get("authorization"))) return json(401, { codigo: "NO_AUTORIZADO", mensaje: "Credenciales inválidas." });
  const { id } = await ctx.params;
  const crudo = await req.text();
  const r = await conIdempotencia(req.headers.get("idempotency-key"), `POST /candidatos/${id}/documentos`, crudo, () => subirDocumento(id, crudo));
  return json(r.status, r.body);
}

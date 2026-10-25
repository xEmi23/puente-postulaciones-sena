import { json } from "@/lib/http";
import { autorizado, conIdempotencia, subirDocumento } from "@/modules/ats/servicio";
import { falloSimulado } from "@/modules/ats/fallos";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!autorizado(req.headers.get("authorization"))) return json(401, { codigo: "NO_AUTORIZADO", mensaje: "Credenciales inválidas." });
  const { id } = await ctx.params;
  const crudo = await req.text();
  const r = await falloSimulado("documentos", () =>
    conIdempotencia(req.headers.get("idempotency-key"), `POST /candidatos/${id}/documentos`, crudo, () => subirDocumento(id, crudo)),
  );
  return json(r.status, r.body);
}

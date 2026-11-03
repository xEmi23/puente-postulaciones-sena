import { urlPublica } from "@/lib/config";
import { documentoOpenApi } from "@/modules/api/openapi";
import { apiNoDisponible } from "@/modules/api/http";

export const dynamic = "force-dynamic";

export function GET() {
  const apagada = apiNoDisponible();
  if (apagada) return apagada;
  return Response.json(documentoOpenApi(urlPublica()), { headers: { "Cache-Control": "no-store" } });
}

import { urlPublica } from "@/lib/config";
import { documentoOpenApi } from "@/modules/api/openapi";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(documentoOpenApi(urlPublica()), { headers: { "Cache-Control": "no-store" } });
}

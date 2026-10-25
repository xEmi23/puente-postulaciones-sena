import { json } from "@/lib/http";
import { recibirPostulacion, responderDesafio } from "@/modules/puente/webhook";
import { HEADER_FIRMA } from "@/lib/firma";

export const dynamic = "force-dynamic";

/** Validación del endpoint (challengeCode). */
export async function GET(req: Request) {
  const r = responderDesafio(new URL(req.url).searchParams.get("challengeCode"));
  return json(r.status, r.body);
}

/** Recepción de postulaciones (EXPORT_JOB_APPLICATION). Se lee el cuerpo crudo para verificar la firma. */
export async function POST(req: Request) {
  const cuerpoCrudo = await req.text();
  const r = await recibirPostulacion(cuerpoCrudo, req.headers.get(HEADER_FIRMA));
  return json(r.status, r.body);
}

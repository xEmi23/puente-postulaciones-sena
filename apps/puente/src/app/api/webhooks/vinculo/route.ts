import { json } from "@/lib/http";
import { HEADER_FIRMA } from "@/lib/firma";
import { recibirPostulacion, responderDesafio } from "@/modules/webhook";

export const dynamic = "force-dynamic";

/** Validación del webhook por desafío (Vínculo la hace al registrar la URL y antes de publicar con Solicitud sencilla). */
export async function GET(req: Request) {
  const r = await responderDesafio(new URL(req.url).searchParams.get("challengeCode"));
  return json(r.status, r.body);
}

/** Entrega de una postulación (EXPORT_JOB_APPLICATION) firmada con X-LI-Signature. */
export async function POST(req: Request) {
  const cuerpoCrudo = await req.text();
  const r = await recibirPostulacion(cuerpoCrudo, req.headers.get(HEADER_FIRMA));
  return json(r.status, r.body);
}

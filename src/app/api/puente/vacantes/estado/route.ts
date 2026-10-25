import { json } from "@/lib/http";
import { HEADER_FIRMA } from "@/lib/firma";
import { aplicarEstadoVacante } from "@/modules/puente/vacantes";

export const dynamic = "force-dynamic";

/** Cierre o reapertura de una vacante notificada por el origen (contrato del simulador, firmado). */
export async function POST(req: Request) {
  const r = await aplicarEstadoVacante(await req.text(), req.headers.get(HEADER_FIRMA));
  return json(r.status, r.body);
}

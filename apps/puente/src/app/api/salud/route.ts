import { estadoDestino } from "@/salidas";

export const dynamic = "force-dynamic";

/**
 * Salud del servicio (sin datos sensibles). Informa el ATS de destino: si ATS_DESTINO apunta a un adaptador sin
 * implementar (hoy, buk), responde 503 y el procesador no arranca, para que nunca «parezca» conectado.
 */
export function GET() {
  const ats = estadoDestino();
  return Response.json(
    { estado: ats.implementado ? "ok" : "ats_no_implementado", sistema: "puente", ats: { destino: ats.destino, implementado: ats.implementado, mensaje: ats.mensaje } },
    { status: ats.implementado ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}

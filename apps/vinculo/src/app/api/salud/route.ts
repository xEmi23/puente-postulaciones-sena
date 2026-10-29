export const dynamic = "force-dynamic";

/** Salud del servicio (sin datos sensibles). */
export function GET() {
  return Response.json({ estado: "ok", sistema: "vinculo" }, { headers: { "Cache-Control": "no-store" } });
}

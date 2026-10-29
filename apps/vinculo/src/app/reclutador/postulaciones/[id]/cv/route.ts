import { prisma } from "@/lib/db";
import { usuarioActual } from "@/lib/sesion-servidor";
import { avanzarEstado } from "@/modules/estados";

export const dynamic = "force-dynamic";

/**
 * Descarga MANUAL del CV por el reclutador de la empresa (lo que hoy se hace a mano por cada candidato y el puente elimina).
 * La persona ve «CV descargado» en «Mis postulaciones».
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await usuarioActual();
  if (!u || u.rol !== "RECLUTADOR" || !u.empresaId) return Response.json({ mensaje: "Solo reclutadores de la empresa." }, { status: 401 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return Response.json({ mensaje: "No existe." }, { status: 404 });
  const p = await prisma.postulacion.findFirst({ where: { id, vacante: { empresaId: u.empresaId } }, include: { archivoCv: true } });
  if (!p) return Response.json({ mensaje: "No existe." }, { status: 404 });
  await avanzarEstado(p.id, "CV_DESCARGADO");
  return new Response(new Uint8Array(p.archivoCv.contenido), {
    headers: {
      "Content-Type": p.archivoCv.mime,
      "Content-Length": String(p.archivoCv.tamano),
      "Content-Disposition": `attachment; filename="${encodeURIComponent(p.archivoCv.nombreArchivo)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

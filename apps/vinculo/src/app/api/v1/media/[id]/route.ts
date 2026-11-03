import { prisma } from "@/lib/db";
import { apiNoDisponible, aplicacionDelToken, error } from "@/modules/api/http";

export const dynamic = "force-dynamic";

/**
 * mediaUrl del CV de una postulación (F1: «Retrieve applicant media files»): exige el access token de la aplicación,
 * solo la aplicación dueña de la vacante puede descargarlo y el enlace vale 30 días.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const apagada = apiNoDisponible();
  if (apagada) return apagada;
  const app = await aplicacionDelToken(req);
  if (!app) return error(401, "INVALID_ACCESS_TOKEN", "El access token falta, venció o no es válido.");
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return error(404, "NOT_FOUND", "No existe.");
  const archivo = await prisma.archivoCv.findUnique({ where: { id }, include: { postulacion: { include: { vacante: { select: { aplicacionId: true } } } } } });
  if (!archivo?.postulacion || !archivo.expiraEn) return error(404, "NOT_FOUND", "No existe.");
  if (archivo.postulacion.vacante.aplicacionId !== app.id) return error(403, "ACCESS_DENIED", "El archivo pertenece a una vacante de otra aplicación.");
  if (archivo.expiraEn.getTime() < Date.now()) return error(410, "MEDIA_EXPIRED", "El enlace del archivo venció (30 días).");
  return new Response(new Uint8Array(archivo.contenido), {
    status: 200,
    headers: {
      "Content-Type": archivo.mime,
      "Content-Length": String(archivo.tamano),
      "Content-Disposition": `attachment; filename="${encodeURIComponent(archivo.nombreArchivo)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

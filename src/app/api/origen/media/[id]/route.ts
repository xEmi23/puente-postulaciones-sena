import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import { igualesSeguro } from "@/lib/firma";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

// URL privada del CV en el origen (equivale al mediaUrl de LinkedIn): exige Bearer y expira.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token || !igualesSeguro(token, config().ORIGEN_MEDIA_ACCESS_TOKEN)) {
    return json(401, { mensaje: "Token de acceso inválido o ausente." }, { "WWW-Authenticate": "Bearer" });
  }
  if (!/^[0-9a-f-]{36}$/.test(id)) return json(404, { mensaje: "No existe." });
  const archivo = await prisma.archivoCv.findUnique({ where: { id } });
  if (!archivo) return json(404, { mensaje: "No existe." });
  if (archivo.expiraEn.getTime() < Date.now()) return json(410, { mensaje: "El enlace del archivo expiró." });
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

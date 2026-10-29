import { prisma } from "@/lib/db";
import { json } from "@/lib/http";
import { haySesion } from "@/lib/sesion-servidor";

export const dynamic = "force-dynamic";

// Descarga del CV desde la interfaz del ATS simulado (el reclutador).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await haySesion())) return json(401, { mensaje: "Sesión de demostración requerida." });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return json(404, { mensaje: "No existe." });
  const doc = await prisma.documento.findUnique({ where: { id } });
  if (!doc) return json(404, { mensaje: "No existe." });
  return new Response(new Uint8Array(doc.contenido), {
    headers: {
      "Content-Type": doc.mime,
      "Content-Length": String(doc.tamano),
      "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.nombreArchivo)}"`,
      "X-Content-SHA256": doc.sha256,
      "Cache-Control": "private, no-store",
    },
  });
}

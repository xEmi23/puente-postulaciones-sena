import { prisma } from "@/lib/db";
import { config, modoPrueba } from "@/lib/config";
import { consumir } from "@/modules/ats/fallos";
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
  // Control de prueba: corta la transferencia a la mitad (solo modo prueba local).
  if (modoPrueba() && (await consumir("media")) === "INTERRUMPIR") {
    const mitad = new Uint8Array(archivo.contenido).subarray(0, Math.floor(archivo.tamano / 2));
    const cortado = new ReadableStream<Uint8Array>({
      start(c) {
        // Primero salen los encabezados y la mitad del archivo; luego se corta la conexión.
        c.enqueue(mitad);
        setTimeout(() => c.error(new Error("Transferencia interrumpida (fallo simulado)")), 200);
      },
    });
    return new Response(cortado, {
      status: 200,
      headers: { "Content-Type": archivo.mime, "Content-Length": String(archivo.tamano), "Cache-Control": "private, no-store" },
    });
  }
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

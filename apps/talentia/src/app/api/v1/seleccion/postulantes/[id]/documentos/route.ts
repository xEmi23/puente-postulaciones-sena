import { conApi, conIdempotencia, desdeFallo, error, respuesta } from "@/modules/api/http";
import { vistaDocumento } from "@/modules/api/vistas";
import { listarDocumentos, subirDocumento } from "@/modules/seleccion";

export const dynamic = "force-dynamic";
const RUTA = "/api/v1/seleccion/postulantes/{id}/documentos";

export function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return conApi(req, RUTA, "lectura", async () => {
    const docs = await listarDocumentos((await ctx.params).id);
    return docs ? respuesta(200, { data: docs.map(vistaDocumento) }) : error(404, "NO_ENCONTRADO", "El postulante no existe.");
  });
}

/** multipart/form-data: archivo (PDF), sha256 (hex en minúsculas) y tipo (CV). Talentia recalcula el SHA-256. */
export function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return conApi(req, RUTA, "modificacion", async (api) => {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return error(400, "DATOS_INVALIDOS", "El cuerpo debe ser multipart/form-data con los campos archivo y sha256.");
    }
    const archivo = form.get("archivo");
    const sha256 = String(form.get("sha256") ?? "");
    const tipo = String(form.get("tipo") ?? "CV");
    const bytes = archivo instanceof File ? new Uint8Array(await archivo.arrayBuffer()) : null;
    // La huella de idempotencia usa el SHA-256 declarado y el tipo, no los bytes completos.
    return conIdempotencia(req, api, `${sha256}|${tipo}|${bytes?.length ?? 0}`, async () => {
      const r = await subirDocumento((await ctx.params).id, archivo instanceof File && bytes ? { nombre: archivo.name, bytes } : null, sha256, tipo);
      return r.ok ? respuesta(r.status, { data: vistaDocumento(r.datos) }) : desdeFallo(r);
    });
  });
}

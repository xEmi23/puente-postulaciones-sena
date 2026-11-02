import { crearLote, MAX_ARCHIVOS } from "./servicio";

// Subida del importador (POST /api/importador/lotes, multipart desde la página Importar). Se hace por una ruta y no por
// una acción de servidor porque 20 PDF de 5 MB superan el límite de cuerpo de las acciones. Solo con sesión (I-6):
// /api es público en el proxy, así que la sesión se comprueba aquí.

const volver = (req: Request, ruta: string, params: Record<string, string>) => {
  const url = new URL(ruta, req.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return Response.redirect(url, 303);
};

export async function recibirSubida(req: Request, usuario: { id: string } | null): Promise<Response> {
  if (!usuario) return Response.json({ estado: "NO_AUTORIZADO", mensaje: "Inicia sesión en el Puente para importar." }, { status: 401 });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return volver(req, "/importar", { error: "No se pudo leer el formulario. Adjunta los PDF e inténtalo de nuevo." });
  }
  const proceso = Number(form.get("procesoAtsId"));
  const archivos: { nombre: string; bytes: Uint8Array }[] = [];
  for (const v of form.getAll("archivos")) {
    if (v instanceof File && v.size > 0) archivos.push({ nombre: v.name || "cv.pdf", bytes: new Uint8Array(await v.arrayBuffer()) });
    if (archivos.length > MAX_ARCHIVOS) break;
  }
  const csv = form.get("csv");
  const csvTexto = csv instanceof File && csv.size > 0 ? await csv.text() : undefined;
  const r = await crearLote(usuario.id, proceso, archivos, csvTexto);
  return r.ok ? volver(req, `/importar/${r.loteId}`, {}) : volver(req, "/importar", { error: r.mensaje });
}

import { recibirFormulario } from "@/entradas/formulario/servicio";
import { MENSAJES_ERROR } from "@/entradas/formulario/campos";

// POST /api/postular/<código> — envío del formulario público (multipart). La página con JavaScript pide JSON
// (Accept: application/json) para mostrar los errores junto a cada campo sin perder lo escrito. Sin JavaScript responde
// con una redirección 303: a la confirmación (nueva, repetida o campo trampa: lo mismo) o de vuelta al formulario.
const ESTADO: Record<string, number> = { vacante: 404, limite: 429, grande: 413, no_pdf: 415 };

export async function POST(req: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const r = await recibirFormulario(req, codigo);
  const base = `/postular/${encodeURIComponent(codigo)}`;
  if ((req.headers.get("accept") ?? "").includes("application/json")) {
    const cuerpo = r.ok ? { ok: true, referencia: r.referencia } : { ok: false, error: r.error, mensaje: MENSAJES_ERROR[r.error], campos: r.campos ?? {} };
    return Response.json(cuerpo, { status: r.ok ? 200 : (ESTADO[r.error] ?? 422), headers: { "Cache-Control": "no-store" } });
  }
  const destino = r.ok ? `${base}/enviado?ref=${r.referencia}` : `${base}?error=${r.error}`;
  return new Response(null, { status: 303, headers: { Location: destino, "Cache-Control": "no-store" } });
}

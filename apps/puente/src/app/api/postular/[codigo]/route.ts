import { recibirFormulario } from "@/entradas/formulario/servicio";

// POST /api/postular/<código> — envío del formulario público (multipart, sin JavaScript). Responde siempre con una
// redirección 303: a la confirmación (nueva, repetida o campo trampa: lo mismo) o de vuelta al formulario con el error.
export async function POST(req: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const r = await recibirFormulario(req, codigo);
  const base = `/postular/${encodeURIComponent(codigo)}`;
  const destino = r.ok ? `${base}/enviado` : `${base}?error=${r.error}`;
  return new Response(null, { status: 303, headers: { Location: destino, "Cache-Control": "no-store" } });
}

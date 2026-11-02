import { usuarioActual } from "@/lib/sesion-servidor";
import { recibirSubida } from "@/entradas/importador/http";

export const dynamic = "force-dynamic";

/** Subida de CV del importador (solo con sesión). */
export async function POST(req: Request) {
  return recibirSubida(req, await usuarioActual());
}

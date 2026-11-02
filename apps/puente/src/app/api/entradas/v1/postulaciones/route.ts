import { recibirPorEntradaGenerica } from "@/entradas/generica/servicio";

export const dynamic = "force-dynamic";

/** Entrada genérica de postulaciones (V4 §8.1). Autenticación: Authorization: Bearer <token de la fuente>. */
export function POST(req: Request) {
  return recibirPorEntradaGenerica(req);
}

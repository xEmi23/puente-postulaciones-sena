import { vacantesDeLaFuente } from "@/entradas/generica/servicio";

export const dynamic = "force-dynamic";

/** Vacantes vinculadas a la fuente del token (V4 §8.1). */
export function GET(req: Request) {
  return vacantesDeLaFuente(req);
}

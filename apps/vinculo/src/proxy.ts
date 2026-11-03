import { NextResponse, type NextRequest } from "next/server";
import { apiHabilitada } from "@/lib/config";

// D-68: con VINCULO_API_HABILITADA apagada, el portal de desarrolladores y la pantalla de Integraciones no existen.
// Las páginas ya llaman a notFound(), pero con loading.tsx la respuesta sale en streaming con estado 200; aquí se
// reescribe a una ruta inexistente para que el estado HTTP también sea 404 (con la página «No encontramos esta página»).
export function proxy(req: NextRequest) {
  if (apiHabilitada()) return NextResponse.next();
  return NextResponse.rewrite(new URL("/_sin-api", req.url));
}

export const config = { matcher: ["/developers", "/developers/:path*", "/reclutador/integraciones", "/reclutador/integraciones/:path*"] };

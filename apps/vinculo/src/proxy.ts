import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, tokenValido } from "@/lib/sesion";

// Comprobación optimista: redirige a /ingresar si no hay sesión válida.
// La verificación definitiva se repite en los layouts, las descargas y cada server action.
export async function proxy(req: NextRequest) {
  if (await tokenValido(req.cookies.get(COOKIE_SESION)?.value)) return NextResponse.next();
  const destino = new URL("/ingresar", req.url);
  destino.searchParams.set("siguiente", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(destino);
}

export const config = {
  matcher: ["/admin/:path*"],
};

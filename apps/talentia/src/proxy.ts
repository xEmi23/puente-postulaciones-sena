import { NextResponse, type NextRequest } from "next/server";

// Comprobación optimista (solo la presencia de la cookie de sesión de Talentia).
// La verificación real se hace en el servidor: layouts, descargas y cada server action.
const PUBLICAS = /^\/(ingresar|apidocs|api|_next|favicon\.ico|vendor)(\/|$)|^\/apidocs\.js$/;

export function proxy(req: NextRequest) {
  if (PUBLICAS.test(req.nextUrl.pathname)) return NextResponse.next();
  if (req.cookies.has("tal_sesion") || req.cookies.has("__Secure-tal_sesion")) return NextResponse.next();
  const destino = new URL("/ingresar", req.url);
  destino.searchParams.set("siguiente", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(destino);
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };

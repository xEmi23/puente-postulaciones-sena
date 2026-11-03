import { NextResponse, type NextRequest } from "next/server";

// Comprobación optimista (solo la presencia de la cookie de sesión del puente).
// La verificación real se hace en el servidor: layouts, descargas y cada server action.
// V4 F6: el formulario público y el aviso de privacidad no piden sesión; el panel sí.
const PUBLICAS = /^\/(ingresar|postular|privacidad|api|_next|favicon\.ico)(\/|$)/;

export function proxy(req: NextRequest) {
  if (PUBLICAS.test(req.nextUrl.pathname)) return NextResponse.next();
  if (req.cookies.has("pue_sesion") || req.cookies.has("__Secure-pue_sesion")) return NextResponse.next();
  const destino = new URL("/ingresar", req.url);
  destino.searchParams.set("siguiente", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(destino);
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };

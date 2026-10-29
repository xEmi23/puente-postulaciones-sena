import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, type Rol } from "./auth";

export interface Usuario {
  id: string;
  nombre: string;
  correo: string;
  rol: Rol;
}

/** Comprobación real de la sesión en el servidor (no optimista). */
export async function usuarioActual(): Promise<Usuario | null> {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  const rol = (s.user as { rol?: string }).rol === "ADMIN" ? "ADMIN" : "OPERADOR";
  return { id: s.user.id, nombre: s.user.name, correo: s.user.email, rol };
}

/** Para layouts y páginas: redirige a /ingresar sin sesión, o a /operaciones si el rol no alcanza. */
export async function exigirUsuario(siguiente: string, rol?: Rol): Promise<Usuario> {
  const u = await usuarioActual();
  if (!u) redirect(`/ingresar?siguiente=${encodeURIComponent(siguiente)}`);
  if (rol && u.rol !== rol) redirect("/operaciones?error=permiso");
  return u;
}

/** Para server actions: lanza si no hay sesión o si el rol no alcanza. */
export async function exigirUsuarioAccion(rol?: Rol): Promise<Usuario> {
  const u = await usuarioActual();
  if (!u) throw new Error("Inicia sesión para continuar.");
  if (rol && u.rol !== rol) throw new Error("Tu rol no permite esta acción.");
  return u;
}

/** Solo rutas internas relativas (evita redirecciones abiertas). */
export function destinoSeguro(siguiente: string | null | undefined): string {
  if (!siguiente || !siguiente.startsWith("/") || siguiente.startsWith("//") || siguiente.startsWith("/\\")) return "/operaciones";
  return siguiente;
}

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

export type Rol = "CANDIDATO" | "RECLUTADOR";

export interface Usuario {
  id: string;
  nombre: string;
  correo: string;
  rol: Rol;
  empresaId: string | null;
}

/** Comprobación real de la sesión en el servidor (no optimista). */
export async function usuarioActual(): Promise<Usuario | null> {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  const extra = s.user as { rol?: string; empresaId?: string | null };
  return { id: s.user.id, nombre: s.user.name, correo: s.user.email, rol: extra.rol === "RECLUTADOR" ? "RECLUTADOR" : "CANDIDATO", empresaId: extra.empresaId ?? null };
}

/** Para páginas: redirige a /ingresar sin sesión, o a / si el rol no corresponde. */
export async function exigirUsuario(siguiente: string, rol?: Rol): Promise<Usuario> {
  const u = await usuarioActual();
  if (!u) redirect(`/ingresar?siguiente=${encodeURIComponent(siguiente)}`);
  if (rol && u.rol !== rol) redirect(`/?aviso=${rol === "RECLUTADOR" ? "solo-reclutadores" : "solo-candidatos"}`);
  return u;
}

/** Para server actions y rutas: lanza si no hay sesión o si el rol no corresponde. */
export async function exigirUsuarioAccion(rol?: Rol): Promise<Usuario> {
  const u = await usuarioActual();
  if (!u) throw new Error("Inicia sesión para continuar.");
  if (rol && u.rol !== rol) throw new Error("Tu tipo de cuenta no permite esta acción.");
  return u;
}

/** Solo rutas internas relativas (evita redirecciones abiertas). */
export function destinoSeguro(siguiente: string | null | undefined, porDefecto = "/"): string {
  if (!siguiente || !siguiente.startsWith("/") || siguiente.startsWith("//") || siguiente.startsWith("/\\")) return porDefecto;
  return siguiente;
}

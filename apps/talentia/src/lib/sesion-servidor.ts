import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_SESION, tokenValido } from "./sesion";

/** Comprobación real (no optimista) de la sesión de demo en el servidor. */
export async function haySesion(): Promise<boolean> {
  return tokenValido((await cookies()).get(COOKIE_SESION)?.value);
}

/** Para layouts y páginas: redirige a /ingresar si no hay sesión. */
export async function exigirSesion(siguiente: string) {
  if (!(await haySesion())) redirect(`/ingresar?siguiente=${encodeURIComponent(siguiente)}`);
}

/** Para server actions: lanza si no hay sesión. */
export async function exigirSesionAccion() {
  if (!(await haySesion())) throw new Error("Sesión de demostración requerida.");
}

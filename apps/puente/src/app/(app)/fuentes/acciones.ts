"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuarioAccion } from "@/lib/sesion-servidor";
import { crearFuente, generarToken, revocarFuente } from "@/entradas/generica/fuentes";

export interface EstadoFuente {
  ok?: boolean;
  mensaje?: string;
  token?: string;
  fuente?: string;
}

const actor = (u: { id: string }) => ({ tipo: "usuario" as const, id: u.id });

export async function crear(_p: EstadoFuente, formData: FormData): Promise<EstadoFuente> {
  const u = await exigirUsuarioAccion("ADMIN");
  const r = await crearFuente(String(formData.get("nombre") ?? ""), String(formData.get("descripcion") ?? ""), actor(u));
  revalidatePath("/fuentes");
  return r;
}

/** El token vuelve solo en la respuesta de esta acción: se muestra una vez y no se guarda en claro. */
export async function token(_p: EstadoFuente, formData: FormData): Promise<EstadoFuente> {
  const u = await exigirUsuarioAccion("ADMIN");
  const nombre = String(formData.get("nombre") ?? "");
  const r = await generarToken(nombre, actor(u));
  revalidatePath("/fuentes");
  return { ...r, fuente: nombre };
}

export async function revocar(formData: FormData) {
  const u = await exigirUsuarioAccion("ADMIN");
  await revocarFuente(String(formData.get("nombre") ?? ""), actor(u));
  revalidatePath("/fuentes");
}

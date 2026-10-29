"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuarioAccion } from "@/lib/sesion-servidor";
import { crearApiKey, revocarApiKey } from "@/modules/api/llaves";

export type EstadoCreacion = { llave?: string; nombre?: string; error?: string };

/** Crea la llave y la devuelve una sola vez en el resultado de la acción (nunca en la URL ni en la base). */
export async function crearLlave(_previo: EstadoCreacion, formData: FormData): Promise<EstadoCreacion> {
  const u = await exigirUsuarioAccion("ADMIN");
  const r = await crearApiKey(
    { nombre: String(formData.get("nombre") ?? ""), lectura: formData.get("lectura") === "on", modificacion: formData.get("modificacion") === "on" },
    u.id,
  );
  if (!r.ok) return { error: r.error };
  revalidatePath("/admin/api-keys");
  return { llave: r.llave, nombre: r.registro.nombre };
}

export async function revocarLlave(formData: FormData) {
  await exigirUsuarioAccion("ADMIN");
  await revocarApiKey(String(formData.get("id")));
  revalidatePath("/admin/api-keys");
}

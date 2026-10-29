"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuarioAccion } from "@/lib/sesion-servidor";
import { desconectar, guardarTalentia, guardarVinculo, type TipoConexion } from "@/modules/conexiones";
import { probarTalentia, probarVinculo } from "@/modules/prueba-conexion";
import { olvidarToken } from "@/modules/vinculo-cliente";

export interface EstadoAccion {
  ok?: boolean;
  mensaje?: string;
}

export async function guardar(_p: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  await exigirUsuarioAccion("ADMIN");
  const tipo = String(formData.get("tipo")) as TipoConexion;
  const campos = Object.fromEntries(formData) as Record<string, string>;
  const r = tipo === "VINCULO" ? await guardarVinculo(campos) : await guardarTalentia(campos);
  if (!r.ok) return { ok: false, mensaje: r.error };
  if (tipo === "VINCULO") olvidarToken();
  // Al guardar se prueba de una vez: así el asistente avanza solo cuando la conexión funciona.
  const prueba = tipo === "VINCULO" ? await probarVinculo() : await probarTalentia();
  revalidatePath("/conexiones");
  return { ok: prueba.ok, mensaje: `Guardado. ${prueba.detalle}` };
}

export async function probar(_p: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  await exigirUsuarioAccion();
  const tipo = String(formData.get("tipo")) as TipoConexion;
  const r = tipo === "VINCULO" ? await probarVinculo() : await probarTalentia();
  revalidatePath("/conexiones");
  return { ok: r.ok, mensaje: r.detalle };
}

export async function quitar(formData: FormData) {
  await exigirUsuarioAccion("ADMIN");
  const tipo = String(formData.get("tipo")) as TipoConexion;
  await desconectar(tipo);
  if (tipo === "VINCULO") olvidarToken();
  revalidatePath("/conexiones");
}

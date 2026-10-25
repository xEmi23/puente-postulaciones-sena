"use server";

import { redirect } from "next/navigation";
import { crearPostulacion, type ErroresCampo } from "@/modules/origen/postulacion";

export interface EstadoFormulario {
  errores: ErroresCampo;
  valores: Record<string, string>;
}

export async function postular(vacanteId: string, _previo: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const valores = {
    nombre: String(formData.get("nombre") ?? ""),
    apellido: String(formData.get("apellido") ?? ""),
    correo: String(formData.get("correo") ?? ""),
    telefono: String(formData.get("telefono") ?? ""),
    ciudad: String(formData.get("ciudad") ?? ""),
  };
  const cv = formData.get("cv");
  const archivo = cv instanceof File && cv.size > 0 ? { nombre: cv.name, bytes: new Uint8Array(await cv.arrayBuffer()) } : null;

  let resultado;
  try {
    resultado = await crearPostulacion(vacanteId, valores, archivo);
  } catch (e) {
    console.error("[origen] Error al guardar la postulación", e);
    return { errores: { general: "No pudimos guardar tu postulación. Intenta de nuevo en unos minutos." }, valores };
  }
  if (!resultado.ok) return { errores: resultado.errores, valores };
  redirect(`/origen/postulacion-enviada/${resultado.postulacionId}`);
}

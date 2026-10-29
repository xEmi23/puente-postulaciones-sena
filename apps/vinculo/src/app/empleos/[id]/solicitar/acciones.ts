"use server";

import { redirect } from "next/navigation";
import { exigirUsuarioAccion } from "@/lib/sesion-servidor";
import { enviarSolicitud, type ErroresSolicitud } from "@/modules/postulacion";

export interface EstadoSolicitud {
  errores?: ErroresSolicitud;
  valores?: Record<string, string>;
}

export async function enviar(_previo: EstadoSolicitud, formData: FormData): Promise<EstadoSolicitud> {
  const u = await exigirUsuarioAccion("CANDIDATO");
  const vacanteId = String(formData.get("vacanteId") ?? "");
  const valores = Object.fromEntries(["nombre", "apellido", "correo", "telefono", "ciudad"].map((k) => [k, String(formData.get(k) ?? "")]));
  const archivo = formData.get("cv");
  const usarPerfil = formData.get("origenCv") === "perfil";
  const cv = usarPerfil
    ? ({ delPerfil: true } as const)
    : {
        archivo: archivo instanceof File && archivo.size > 0 ? { nombre: archivo.name, bytes: new Uint8Array(await archivo.arrayBuffer()) } : null,
        guardarEnPerfil: formData.get("guardarEnPerfil") === "on",
      };
  const r = await enviarSolicitud(u.id, vacanteId, valores, cv);
  if (!r.ok) return { errores: r.errores, valores };
  redirect(`/empleos/${vacanteId}/solicitar/enviada?p=${r.postulacionId}`);
}

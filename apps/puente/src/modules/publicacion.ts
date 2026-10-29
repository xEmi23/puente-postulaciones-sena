import { prisma } from "@/lib/db";
import { urlWebhook } from "@/lib/config";
import * as ats from "./ats-cliente";
import { cerrarVacante, publicarVacante } from "./vinculo-cliente";
import { conexionVinculo } from "./conexiones";

// «Publicar en Vínculo»: crea (o actualiza) la vacante de un proceso de Talentia por la API de Vínculo, con
// externalJobId = id del proceso y el webhook del puente para la Solicitud sencilla. Así las postulaciones se
// asocian al proceso sin correspondencias manuales.

export type Resultado = { ok: true; mensaje: string } | { ok: false; mensaje: string };

const MODALIDAD = (ciudad: string) => (/remoto/i.test(ciudad) ? "REMOTE" : "HYBRID") as "REMOTE" | "HYBRID";

export async function publicarProceso(procesoId: number, opciones: { automatica?: boolean; fetchImpl?: typeof fetch } = {}): Promise<Resultado> {
  const v = await conexionVinculo();
  if (!v) return { ok: false, mensaje: "Configura primero la conexión con Vínculo." };
  if (!v.empresaId) return { ok: false, mensaje: "Prueba la conexión con Vínculo para identificar la empresa que autorizó al puente." };
  let p: ats.ProcesoTalentia;
  try {
    p = await ats.obtenerProceso(procesoId, { fetchImpl: opciones.fetchImpl });
  } catch (e) {
    return { ok: false, mensaje: `No se pudo leer el proceso en Talentia: ${e instanceof Error ? e.message : e}` };
  }
  if (p.estado !== "INICIADO") return { ok: false, mensaje: `El proceso ${procesoId} no está «Iniciado» en Talentia.` };
  const descripcion =
    p.descripcion && p.descripcion.length >= 10 ? p.descripcion : `${p.titulo} en ${v.empresaNombre ?? "la empresa"} (${p.area}, ${p.ciudad}). Vacante ficticia publicada desde el ATS por el puente.`;
  try {
    const r = await publicarVacante(
      { externalJobId: String(p.id), companyId: v.empresaId, title: p.titulo, description: descripcion, location: p.ciudad, workplaceType: MODALIDAD(p.ciudad), webhookUrl: urlWebhook() },
      opciones.fetchImpl,
    );
    const datos = {
      titulo: p.titulo,
      vacanteId: r.id,
      url: r.url,
      estado: "PUBLICADA",
      solicitudSencilla: r.applyMethod === "ONSITE_APPLY",
      motivo: r.notOnsiteReason,
      publicadaEn: new Date(),
      cerradaEn: null,
    };
    await prisma.publicacion.upsert({
      where: { procesoId },
      create: { procesoId, externalJobId: String(procesoId), automatica: !!opciones.automatica, ...datos },
      update: datos,
    });
    return r.applyMethod === "ONSITE_APPLY"
      ? { ok: true, mensaje: `Proceso ${procesoId} publicado en Vínculo con «Solicitud sencilla».` }
      : { ok: false, mensaje: `Vínculo publicó el proceso ${procesoId} sin Solicitud sencilla: ${r.notOnsiteReason ?? "el webhook no pasó la validación"}.` };
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    await prisma.publicacion.upsert({
      where: { procesoId },
      create: { procesoId, externalJobId: String(procesoId), titulo: p.titulo, estado: "ERROR", motivo: mensaje, automatica: !!opciones.automatica },
      update: { estado: "ERROR", motivo: mensaje },
    });
    return { ok: false, mensaje: `No se pudo publicar en Vínculo: ${mensaje}` };
  }
}

/** «Cerrar en Vínculo»: la vacante deja de recibir; las postulaciones hechas antes del cierre se siguen aceptando (D-17). */
export async function cerrarPublicacion(procesoId: number, fetchImpl?: typeof fetch): Promise<Resultado> {
  const pub = await prisma.publicacion.findUnique({ where: { procesoId } });
  if (!pub || pub.estado !== "PUBLICADA") return { ok: false, mensaje: "El proceso no está publicado en Vínculo." };
  try {
    const r = await cerrarVacante(pub.externalJobId, fetchImpl);
    await prisma.publicacion.update({ where: { procesoId }, data: { estado: "CERRADA", cerradaEn: r.closedAt ? new Date(r.closedAt) : new Date() } });
    return { ok: true, mensaje: `Vacante del proceso ${procesoId} cerrada en Vínculo.` };
  } catch (e) {
    return { ok: false, mensaje: `No se pudo cerrar en Vínculo: ${e instanceof Error ? e.message : e}` };
  }
}

const SONDEO_MS = () => Number(process.env.PUENTE_SONDEO_MS ?? 2 * 60_000);

/**
 * Publicación automática (opcional): cada 2 minutos consulta los procesos de Talentia y publica los «Iniciados» que
 * aún no tienen publicación. Devuelve cuántos publicó (0 si está apagada o no toca todavía).
 */
export async function sondearProcesosNuevos(opciones: { fetchImpl?: typeof fetch; forzar?: boolean } = {}): Promise<number> {
  const cfg = await prisma.configuracion.findUnique({ where: { id: 1 } });
  if (!cfg?.publicacionAutomatica) return 0;
  if (!opciones.forzar && cfg.ultimoSondeoEn && Date.now() - cfg.ultimoSondeoEn.getTime() < SONDEO_MS()) return 0;
  let publicados = 0;
  let resultado = "";
  try {
    const procesos = await ats.listarProcesos({ fetchImpl: opciones.fetchImpl });
    const ya = new Set((await prisma.publicacion.findMany({ select: { procesoId: true } })).map((p) => p.procesoId));
    for (const p of procesos.filter((x) => x.estado === "INICIADO" && !ya.has(x.id))) {
      const r = await publicarProceso(p.id, { automatica: true, fetchImpl: opciones.fetchImpl });
      if (r.ok) publicados++;
    }
    resultado = publicados ? `Se publicaron ${publicados} procesos nuevos.` : "Sin procesos nuevos.";
  } catch (e) {
    resultado = `No se pudo consultar Talentia: ${e instanceof Error ? e.message : e}`;
  }
  await prisma.configuracion.update({ where: { id: 1 }, data: { ultimoSondeoEn: new Date(), resultadoSondeo: resultado } });
  return publicados;
}

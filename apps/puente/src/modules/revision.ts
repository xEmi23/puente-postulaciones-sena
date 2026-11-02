import { prisma } from "@/lib/db";
import { nombreArchivoSeguro } from "@/lib/archivos";
import { normalizarCorreo } from "@/nucleo/contrato/canonica";
import { hayPosibleDuplicado, validarCvBinario, type MotivoRevision } from "@/nucleo/recepcion/registrar";
import { auditar, log, type Actor } from "@/nucleo/auditoria";
import { z } from "zod";

// Acciones de una persona sobre las recepciones (ESPECIFICACION_V4 §7 y §11): completar correo o CV, aprobar,
// descartar y borrar los datos del candidato. Todas dejan un EventoAuditoria con su actor y nunca envían nada al ATS
// por sí mismas: aprobar solo devuelve la recepción a la cola.

export type ResultadoAccion = { ok: true; mensaje: string } | { ok: false; mensaje: string };

const motivosDe = (r: { motivoRevision: string | null }) => (r.motivoRevision ? (r.motivoRevision.split(",") as MotivoRevision[]) : []);

/** Completa el correo y/o el CV de una recepción en revisión. No la aprueba: la persona decide después. */
export async function completarRevision(recepcionId: string, datos: { correo?: string; cv?: { bytes: Uint8Array; nombre: string } }, actor: Actor): Promise<ResultadoAccion> {
  const rec = await prisma.recepcion.findUnique({ where: { id: recepcionId } });
  if (!rec) return { ok: false, mensaje: "La operación no existe." };
  if (rec.estado !== "REQUIERE_REVISION") return { ok: false, mensaje: "Solo se completan operaciones que requieren revisión." };
  const cambios: Record<string, unknown> = {};
  let motivos = motivosDe(rec);
  if (datos.correo !== undefined && datos.correo.trim()) {
    const correo = normalizarCorreo(datos.correo);
    if (!z.email().safeParse(correo).success) return { ok: false, mensaje: "El correo no tiene un formato válido." };
    cambios.correo = correo;
    motivos = motivos.filter((m) => m !== "sin_correo");
  }
  if (datos.cv) {
    const v = validarCvBinario(datos.cv.bytes);
    if (!v.ok) return { ok: false, mensaje: v.mensaje };
    Object.assign(cambios, {
      paso: "cv_descargado",
      cvContenido: Buffer.from(datos.cv.bytes),
      cvSha256: v.sha,
      cvTamano: datos.cv.bytes.length,
      cvNombreArchivo: nombreArchivoSeguro(datos.cv.nombre),
    });
    motivos = motivos.filter((m) => m !== "sin_cv");
  }
  if (Object.keys(cambios).length === 0) return { ok: false, mensaje: "Indica el correo o adjunta el CV." };
  // Lo que una persona completó cuenta como confirmado.
  motivos = motivos.filter((m) => m !== "datos_sin_confirmar");
  await prisma.$transaction([
    prisma.recepcion.update({ where: { id: recepcionId }, data: { ...cambios, motivoRevision: motivos.join(",") || null } }),
    prisma.eventoRecepcion.create({
      data: { recepcionId, tipo: "REVISION", detalle: `Datos completados en el panel (${[cambios.correo ? "correo" : null, datos.cv ? "CV" : null].filter(Boolean).join(" y ")}).` },
    }),
  ]);
  await auditar(actor, "revision.completada", recepcionId, [cambios.correo ? "correo" : null, datos.cv ? "cv" : null].filter(Boolean).join(","));
  return { ok: true, mensaje: motivos.length ? "Datos guardados. Aún falta resolver: revisa los motivos." : "Datos guardados. Ya puedes aprobarla." };
}

/** Aprueba una recepción en revisión: exige correo y CV y la devuelve a la cola del procesador. */
export async function aprobarRevision(recepcionId: string, actor: Actor): Promise<ResultadoAccion> {
  const rec = await prisma.recepcion.findUnique({ where: { id: recepcionId }, include: { trabajo: true } });
  if (!rec || !rec.trabajo) return { ok: false, mensaje: "La operación no existe." };
  if (rec.estado !== "REQUIERE_REVISION") return { ok: false, mensaje: "Solo se aprueban operaciones que requieren revisión." };
  if (!rec.correo) return { ok: false, mensaje: "Falta el correo: complétalo antes de aprobar." };
  if (!rec.cvContenido && !rec.mediaUrl) return { ok: false, mensaje: "Falta el CV: adjúntalo antes de aprobar." };
  const eraDuplicado = motivosDe(rec).includes("posible_duplicado");
  await prisma.$transaction([
    prisma.recepcion.update({ where: { id: recepcionId }, data: { estado: "RECIBIDO", motivoRevision: null } }),
    prisma.trabajo.update({ where: { id: rec.trabajo.id }, data: { estado: "PENDIENTE", intentos: 0, proximoIntentoEn: new Date(), leaseHasta: null } }),
    prisma.eventoRecepcion.create({
      data: {
        recepcionId,
        tipo: "REVISION",
        detalle: eraDuplicado ? "Aprobada en el panel: una persona confirmó que no es un duplicado. Se envía al ATS." : "Aprobada en el panel. Se envía al ATS.",
      },
    }),
  ]);
  await auditar(actor, "revision.aprobada", recepcionId);
  log(recepcionId, "APROBADA");
  return { ok: true, mensaje: "Aprobada: el worker la enviará al ATS en segundos." };
}

/** Descarta una recepción en revisión (p. ej., un duplicado confirmado). No se envía nada al ATS y se borra el CV. */
export async function descartarRevision(recepcionId: string, actor: Actor): Promise<ResultadoAccion> {
  const rec = await prisma.recepcion.findUnique({ where: { id: recepcionId }, include: { trabajo: true } });
  if (!rec || !rec.trabajo) return { ok: false, mensaje: "La operación no existe." };
  if (rec.estado !== "REQUIERE_REVISION") return { ok: false, mensaje: "Solo se descartan operaciones que requieren revisión." };
  await prisma.$transaction([
    prisma.recepcion.update({
      where: { id: recepcionId },
      data: { estado: "RECHAZADO", errorCodigo: "DESCARTADA", errorDetalle: "Descartada por una persona en el panel.", cvContenido: null, cvBorradoEn: new Date() },
    }),
    prisma.trabajo.update({ where: { id: rec.trabajo.id }, data: { estado: "HECHO", leaseHasta: null } }),
    prisma.eventoRecepcion.create({ data: { recepcionId, tipo: "REVISION", detalle: "Descartada en el panel. No se envió nada al ATS." } }),
  ]);
  await auditar(actor, "revision.descartada", recepcionId);
  return { ok: true, mensaje: "Descartada. No se envió nada al ATS." };
}

/**
 * «Borrar datos del candidato» (supresión a pedido): elimina nombre, correo, teléfono, ciudad y el CV; conserva los
 * metadatos, el hash y los eventos (sin datos personales). Si aún no se había completado, se detiene.
 */
export async function borrarDatosCandidato(recepcionId: string, actor: Actor): Promise<ResultadoAccion> {
  const rec = await prisma.recepcion.findUnique({ where: { id: recepcionId }, include: { trabajo: true } });
  if (!rec) return { ok: false, mensaje: "La operación no existe." };
  if (rec.datosBorradosEn) return { ok: false, mensaje: "Los datos de esta operación ya se borraron." };
  const ahora = new Date();
  const terminada = rec.estado === "COMPLETADO" || rec.estado === "RECHAZADO";
  await prisma.$transaction([
    prisma.recepcion.update({
      where: { id: recepcionId },
      data: {
        nombre: "[datos borrados]",
        apellido: "",
        correo: null,
        telefono: null,
        ciudad: null,
        jobApplicant: "[datos borrados]",
        cvContenido: null,
        cvBorradoEn: rec.cvBorradoEn ?? ahora,
        datosBorradosEn: ahora,
        ...(terminada ? {} : { estado: "RECHAZADO" as const, errorCodigo: "DATOS_BORRADOS", errorDetalle: "Datos del candidato borrados a pedido antes de enviarse al ATS." }),
      },
    }),
    ...(rec.trabajo && !terminada ? [prisma.trabajo.update({ where: { id: rec.trabajo.id }, data: { estado: "HECHO", leaseHasta: null } })] : []),
    prisma.eventoRecepcion.create({ data: { recepcionId, tipo: "SUPRESION", detalle: "Datos personales y CV borrados a pedido. Quedan los metadatos y el hash." } }),
  ]);
  await auditar(actor, "candidato.datos_borrados", recepcionId);
  return { ok: true, mensaje: terminada ? "Datos borrados en el Puente. Si ya llegó al ATS, la supresión allí la hace el ATS." : "Datos borrados; la operación se detuvo sin enviarse al ATS." };
}

/** Vuelve a calcular el posible duplicado (para mostrarlo en el panel). */
export async function sigueSiendoPosibleDuplicado(recepcionId: string) {
  const rec = await prisma.recepcion.findUnique({ where: { id: recepcionId } });
  return rec?.procesoAtsId ? hayPosibleDuplicado(rec.correo, rec.procesoAtsId, rec.fuente, rec.id) : false;
}

import { createHash, randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { config, urlPublica } from "@/lib/config";
import { nombreArchivoSeguro, pareceUnPdf, sha256Hex, formatoTamano } from "@/lib/archivos";
import { TIPO_EVENTO, type PayloadApplyConnect } from "@/modules/contrato-apply-connect";

// «Solicitud sencilla»: el candidato confirma sus datos de contacto, elige un CV (el de su perfil o uno nuevo) y envía.
// La postulación, la copia del CV y la entrega pendiente (outbox) se guardan en UNA transacción.

const nombrePropio = z
  .string()
  .trim()
  .min(2, "Debe tener al menos 2 caracteres.")
  .max(60, "Máximo 60 caracteres.")
  .regex(/^[\p{L}][\p{L} '.-]*$/u, "Usa solo letras, espacios, apóstrofos o guiones.");

export const esquemaContacto = z.object({
  nombre: nombrePropio,
  apellido: nombrePropio,
  correo: z.string().trim().toLowerCase().pipe(z.email("Escribe un correo válido, por ejemplo nombre@dominio.com.")),
  telefono: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s()-]/g, ""))
    .pipe(z.union([z.literal(""), z.string().regex(/^\+?\d{7,15}$/, "El teléfono debe tener entre 7 y 15 dígitos.")]))
    .optional()
    .transform((v) => (v ? v : undefined)),
  ciudad: z.string().trim().min(2, "Indica tu ciudad.").max(60, "Máximo 60 caracteres."),
});
export type DatosContacto = z.infer<typeof esquemaContacto>;

export interface ArchivoSubido {
  nombre: string;
  bytes: Uint8Array;
}

export type CampoSolicitud = keyof DatosContacto | "cv" | "general";
export type ErroresSolicitud = Partial<Record<CampoSolicitud, string>>;
export type ResultadoSolicitud = { ok: true; postulacionId: string; jobApplicationId: string } | { ok: false; errores: ErroresSolicitud };

export function validarCv(archivo: ArchivoSubido | null): string | null {
  const max = config().CV_MAX_BYTES;
  if (!archivo || archivo.bytes.length === 0) return "Adjunta tu hoja de vida en PDF.";
  if (archivo.bytes.length > max) return `El archivo pesa ${formatoTamano(archivo.bytes.length)}; el máximo permitido es ${formatoTamano(max)}.`;
  if (!pareceUnPdf(archivo.bytes)) return "El archivo no es un PDF válido. Exporta tu hoja de vida como PDF e intenta de nuevo.";
  return null;
}

/** Identificador de persona estable por cuenta, como el urn:li:person de LinkedIn. */
export function urnPersona(userId: string): string {
  return `urn:li:person:${createHash("sha256").update(`persona:${userId}`).digest("hex").slice(0, 16)}`;
}

export function nuevoJobApplicationId(): string {
  return `urn:li:jobApplication:${randomInt(1_000_000_000, 9_999_999_999)}`;
}

/** Cuerpo EXPORT_JOB_APPLICATION según la documentación de Apply Connect (docs/contratos.md §1, F1). */
export function construirPayload(p: {
  externalJobId: string;
  jobApplicationId: string;
  jobApplicant: string;
  aplicadaEn: Date;
  datos: DatosContacto;
  mediaUrl: string;
  mediaUrn: string;
}): PayloadApplyConnect {
  const contacto: PayloadApplyConnect["questionResponses"]["contactInformationQuestionResponses"] = {
    firstNameAnswer: { value: p.datos.nombre },
    lastNameAnswer: { value: p.datos.apellido },
    emailAnswer: { value: p.datos.correo },
    locationAnswer: { locationCityAnswer: { value: p.datos.ciudad }, locationCountryAnswer: { value: "CO" } },
  };
  if (p.datos.telefono) {
    const numero = p.datos.telefono.replace(/^\+57/, "").replace(/^\+/, "");
    contacto.cellphoneNumberQuestionAnswer = { countryCode: "57", nationalNumber: numero };
  }
  return {
    type: TIPO_EVENTO,
    externalJobId: p.externalJobId,
    jobApplicationId: p.jobApplicationId,
    jobApplicant: p.jobApplicant,
    appliedAt: p.aplicadaEn.getTime(),
    questionResponses: {
      contactInformationQuestionResponses: contacto,
      resumeQuestionResponses: { resumeQuestionAnswer: { mediaUrl: p.mediaUrl, mediaUrn: p.mediaUrn } },
    },
  };
}

/**
 * Envía la solicitud. `cv` es el del perfil (`{ delPerfil: true }`) o un archivo nuevo. Si `guardarEnPerfil`, el archivo
 * nuevo también reemplaza el CV del perfil.
 */
export async function enviarSolicitud(
  candidatoId: string,
  vacanteId: string,
  entrada: Record<string, unknown>,
  cv: { delPerfil: true } | { archivo: ArchivoSubido | null; guardarEnPerfil?: boolean },
): Promise<ResultadoSolicitud> {
  const errores: ErroresSolicitud = {};
  const datos = esquemaContacto.safeParse(entrada);
  if (!datos.success) for (const issue of datos.error.issues) errores[issue.path[0] as keyof DatosContacto] ??= issue.message;

  let archivo: ArchivoSubido | null = null;
  if ("delPerfil" in cv) {
    const perfil = await prisma.perfil.findUnique({ where: { userId: candidatoId }, include: { cv: true } });
    if (!perfil?.cv) errores.cv = "Tu perfil no tiene un CV. Sube uno en PDF.";
    else archivo = { nombre: perfil.cv.nombreArchivo, bytes: new Uint8Array(perfil.cv.contenido) };
  } else {
    const error = validarCv(cv.archivo);
    if (error) errores.cv = error;
    else archivo = cv.archivo;
  }
  if (!datos.success || !archivo || Object.keys(errores).length) return { ok: false, errores };

  const vacante = await prisma.vacante.findUnique({ where: { id: vacanteId } });
  if (!vacante || vacante.estado !== "PUBLICADA") return { ok: false, errores: { general: "Esta vacante ya no recibe postulaciones." } };
  if (!vacante.solicitudSencilla) {
    return { ok: false, errores: { general: "Esta vacante recibe postulaciones en el sitio de la empresa." } };
  }
  if (await prisma.postulacion.findUnique({ where: { vacanteId_candidatoId: { vacanteId, candidatoId } } })) {
    return { ok: false, errores: { general: "Ya enviaste una solicitud para esta vacante. Mírala en «Mis postulaciones»." } };
  }

  const cfg = config();
  const archivoId = randomUUID();
  const postulacionId = randomUUID();
  const jobApplicationId = nuevoJobApplicationId();
  const mediaUrn = `urn:li:media:${archivoId}`;
  const mediaUrl = `${urlPublica()}/api/v1/media/${archivoId}`;
  const aplicadaEn = new Date();
  const payload = JSON.stringify(
    construirPayload({ externalJobId: vacante.externalJobId, jobApplicationId, jobApplicant: urnPersona(candidatoId), aplicadaEn, datos: datos.data, mediaUrl, mediaUrn }),
  );
  const nombreArchivo = nombreArchivoSeguro(archivo.nombre);
  const sha256 = sha256Hex(archivo.bytes);

  await prisma.$transaction(async (tx) => {
    await tx.archivoCv.create({
      data: {
        id: archivoId,
        nombreArchivo,
        mime: "application/pdf",
        tamano: archivo.bytes.length,
        sha256,
        contenido: Buffer.from(archivo.bytes),
        mediaUrn,
        expiraEn: new Date(aplicadaEn.getTime() + cfg.MEDIA_TTL_DAYS * 86_400_000),
      },
    });
    await tx.postulacion.create({
      data: {
        id: postulacionId,
        jobApplicationId,
        vacanteId,
        candidatoId,
        nombre: datos.data.nombre,
        apellido: datos.data.apellido,
        correo: datos.data.correo,
        telefono: datos.data.telefono ?? null,
        ciudad: datos.data.ciudad,
        archivoCvId: archivoId,
        aplicadaEn,
      },
    });
    // Solo se entrega si la vacante está conectada a un ATS; si no, la postulación queda en Vínculo para el reclutador.
    if (vacante.aplicacionId && vacante.webhookUrl) await tx.outbox.create({ data: { aplicacionId: vacante.aplicacionId, postulacionId, url: vacante.webhookUrl, payload } });
    if (!("delPerfil" in cv) && cv.guardarEnPerfil) {
      const perfilCv = await tx.archivoCv.create({ data: { nombreArchivo, mime: "application/pdf", tamano: archivo.bytes.length, sha256, contenido: Buffer.from(archivo.bytes) } });
      const anterior = await tx.perfil.findUnique({ where: { userId: candidatoId }, select: { cvId: true } });
      await tx.perfil.update({ where: { userId: candidatoId }, data: { cvId: perfilCv.id } });
      if (anterior?.cvId) await tx.archivoCv.delete({ where: { id: anterior.cvId } });
    }
  });
  return { ok: true, postulacionId, jobApplicationId };
}

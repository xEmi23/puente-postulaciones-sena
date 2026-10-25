import { createHash, randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import { nombreArchivoSeguro, pareceUnPdf, sha256Hex, formatoTamano } from "@/lib/archivos";
import { TIPO_EVENTO, type PayloadApplyConnect } from "@/modules/contrato-apply-connect";

const nombrePropio = z
  .string()
  .trim()
  .min(2, "Debe tener al menos 2 caracteres.")
  .max(60, "Máximo 60 caracteres.")
  .regex(/^[\p{L}][\p{L} '.-]*$/u, "Usa solo letras, espacios, apóstrofos o guiones.");

export const esquemaFormulario = z.object({
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

export type DatosFormulario = z.infer<typeof esquemaFormulario>;

export interface ArchivoSubido {
  nombre: string;
  bytes: Uint8Array;
}

export type CampoFormulario = keyof DatosFormulario | "cv" | "general";
export type ErroresCampo = Partial<Record<CampoFormulario, string>>;

export type ResultadoPostulacion =
  | { ok: true; postulacionId: string; jobApplicationId: string }
  | { ok: false; errores: ErroresCampo };

export function validarCv(archivo: ArchivoSubido | null): string | null {
  const max = config().CV_MAX_BYTES;
  if (!archivo || archivo.bytes.length === 0) return "Adjunta tu hoja de vida en PDF.";
  if (archivo.bytes.length > max) {
    return `El archivo pesa ${formatoTamano(archivo.bytes.length)}; el máximo permitido es ${formatoTamano(max)}.`;
  }
  if (!pareceUnPdf(archivo.bytes)) return "El archivo no es un PDF válido. Exporta tu hoja de vida como PDF e intenta de nuevo.";
  return null;
}

/** Identificador de persona estable por correo, como lo haría LinkedIn con el miembro. */
export function urnPersona(correo: string): string {
  const huella = createHash("sha256").update(`persona:${correo.toLowerCase()}`).digest("hex").slice(0, 16);
  return `urn:li:person:${huella}`;
}

export function nuevoJobApplicationId(): string {
  return `urn:li:jobApplication:${randomInt(1_000_000_000, 9_999_999_999)}`;
}

export function construirPayload(p: {
  codigoVacante: string;
  jobApplicationId: string;
  jobApplicant: string;
  aplicadaEn: Date;
  datos: DatosFormulario;
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
    externalJobId: p.codigoVacante,
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
 * Crea la postulación, el archivo del CV y la fila de outbox en una única transacción:
 * o queda todo guardado (y el despachador lo enviará), o no queda nada.
 */
export async function crearPostulacion(
  vacanteId: string,
  entrada: Record<string, unknown>,
  archivo: ArchivoSubido | null,
): Promise<ResultadoPostulacion> {
  const errores: ErroresCampo = {};
  const datos = esquemaFormulario.safeParse(entrada);
  if (!datos.success) {
    for (const issue of datos.error.issues) {
      const campo = issue.path[0] as keyof DatosFormulario;
      errores[campo] ??= issue.message;
    }
  }
  const errorCv = validarCv(archivo);
  if (errorCv) errores.cv = errorCv;
  if (!datos.success || errorCv || !archivo) return { ok: false, errores };

  const vacante = await prisma.vacante.findUnique({ where: { id: vacanteId } });
  if (!vacante || vacante.estado !== "PUBLICADA") {
    return { ok: false, errores: { general: "Esta vacante ya no recibe postulaciones." } };
  }
  const yaExiste = await prisma.postulacionOrigen.findFirst({ where: { vacanteId, correo: datos.data.correo } });
  if (yaExiste) {
    return { ok: false, errores: { correo: "Ya existe una postulación con este correo para esta vacante." } };
  }

  const cfg = config();
  const archivoId = randomUUID();
  const postulacionId = randomUUID();
  const jobApplicationId = nuevoJobApplicationId();
  const jobApplicant = urnPersona(datos.data.correo);
  const mediaUrn = `urn:li:media:${archivoId}`;
  const mediaUrl = new URL(`/api/origen/media/${archivoId}`, cfg.ORIGEN_BASE_URL).toString();
  const aplicadaEn = new Date();
  const payload = JSON.stringify(
    construirPayload({
      codigoVacante: vacante.codigo,
      jobApplicationId,
      jobApplicant,
      aplicadaEn,
      datos: datos.data,
      mediaUrl,
      mediaUrn,
    }),
  );

  await prisma.$transaction([
    prisma.archivoCv.create({
      data: {
        id: archivoId,
        nombreArchivo: nombreArchivoSeguro(archivo.nombre),
        mime: "application/pdf",
        tamano: archivo.bytes.length,
        sha256: sha256Hex(archivo.bytes),
        contenido: Buffer.from(archivo.bytes),
        mediaUrn,
        expiraEn: new Date(aplicadaEn.getTime() + cfg.MEDIA_TTL_DAYS * 24 * 3600 * 1000),
      },
    }),
    prisma.postulacionOrigen.create({
      data: {
        id: postulacionId,
        jobApplicationId,
        jobApplicant,
        vacanteId,
        nombre: datos.data.nombre,
        apellido: datos.data.apellido,
        correo: datos.data.correo,
        telefono: datos.data.telefono ?? null,
        ciudad: datos.data.ciudad,
        archivoCvId: archivoId,
        aplicadaEn,
        demo: vacante.demo,
      },
    }),
    prisma.outboxOrigen.create({ data: { postulacionId, payload } }),
  ]);

  return { ok: true, postulacionId, jobApplicationId };
}

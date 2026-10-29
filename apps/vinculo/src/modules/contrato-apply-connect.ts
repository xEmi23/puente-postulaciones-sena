import { z } from "zod";

// Contrato del webhook de Apply Connect tal como lo documenta LinkedIn (ver docs/contratos.md).
// Solo se modela el subconjunto que usa el prototipo; los demás campos se aceptan y se ignoran.

export const TIPO_EVENTO = "EXPORT_JOB_APPLICATION";

/** Evento del simulador (no de LinkedIn): cierre o reapertura de una vacante en el origen. */
export const TIPO_ESTADO_VACANTE = "JOB_POSTING_STATUS";

export const CODIGOS_ERROR = [
  "MISSING_REQUIRED_RESPONSE",
  "INPUT_VALIDATION_FAILED",
  "DUPLICATE_APPLICATION_RECEIVED",
  "JOB_POSTING_CLOSED",
  "TOO_MANY_REQUESTS",
  "SIGNATURE_MISMATCH",
  "TRANSIENT_ERROR",
  "OTHER",
] as const;
export type CodigoError = (typeof CODIGOS_ERROR)[number];

/** Códigos tras los cuales LinkedIn no reintenta (según la tabla de errores de receive-applications). */
export const CODIGOS_SIN_REINTENTO: ReadonlySet<string> = new Set([
  "MISSING_REQUIRED_RESPONSE",
  "INPUT_VALIDATION_FAILED",
  "DUPLICATE_APPLICATION_RECEIVED",
  "JOB_POSTING_CLOSED",
  "SIGNATURE_MISMATCH",
]);

const texto = z.object({ value: z.string() });

export const esquemaPayload = z.object({
  type: z.literal(TIPO_EVENTO),
  externalJobId: z.string().min(1).max(200),
  jobApplicationId: z.string().regex(/^urn:li:jobApplication:[A-Za-z0-9_-]+$/),
  jobApplicant: z.string().regex(/^urn:li:person:[A-Za-z0-9_-]+$/),
  appliedAt: z.number().int().positive(),
  questionResponses: z.object({
    contactInformationQuestionResponses: z.object({
      firstNameAnswer: texto,
      lastNameAnswer: texto,
      emailAnswer: texto,
      middleNameAnswer: texto.nullish(),
      cellphoneNumberQuestionAnswer: z
        .object({ countryCode: z.string().optional(), nationalNumber: z.string(), extension: z.string().nullish() })
        .nullish(),
      locationAnswer: z
        .looseObject({
          locationCityAnswer: texto.nullish(),
          locationCountryAnswer: texto.nullish(),
        })
        .nullish(),
    }),
    resumeQuestionResponses: z
      .object({
        resumeQuestionAnswer: z.object({ mediaUrl: z.url(), mediaUrn: z.string().min(1) }).nullish(),
      })
      .nullish(),
  }),
});

export type PayloadApplyConnect = z.infer<typeof esquemaPayload>;

export interface ErrorEntrega {
  errorCode: CodigoError;
  additionalErrorDetails?: Record<string, unknown>;
}

export function cuerpoError(errorCode: CodigoError, additionalErrorDetails?: Record<string, unknown>) {
  const error: ErrorEntrega = { errorCode };
  if (additionalErrorDetails) error.additionalErrorDetails = additionalErrorDetails;
  return { errors: [error] };
}

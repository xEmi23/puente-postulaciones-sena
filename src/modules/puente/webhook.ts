import { prisma, esViolacionUnica } from "@/lib/db";
import { config } from "@/lib/config";
import { firmaValida, respuestaDesafio } from "@/lib/firma";
import { sha256Hex } from "@/lib/archivos";
import { cuerpoError, esquemaPayload, type CodigoError } from "@/modules/contrato-apply-connect";
import { admitePostulacion } from "./vacantes";

export interface RespuestaHttp {
  status: number;
  body: unknown;
}

/** GET de validación del endpoint: {challengeCode, challengeResponse} con 200. */
export function responderDesafio(challengeCode: string | null): RespuestaHttp {
  if (!challengeCode || challengeCode.length > 200) {
    return { status: 400, body: { error: "Falta el parámetro challengeCode." } };
  }
  return {
    status: 200,
    body: { challengeCode, challengeResponse: respuestaDesafio(challengeCode, config().SIM_CLIENT_SECRET) },
  };
}

async function registrarRechazo(codigo: CodigoError, motivo: string, extra: { jobApplicationId?: string; externalJobId?: string } = {}) {
  await prisma.entregaRechazada.create({
    data: { codigo, motivo, jobApplicationId: extra.jobApplicationId ?? null, externalJobId: extra.externalJobId ?? null },
  });
}

/** Busca respuestas obligatorias ausentes antes de validar formato, para distinguir MISSING de INPUT_VALIDATION. */
function respuestasFaltantes(json: unknown): string[] {
  const qr = (json as { questionResponses?: Record<string, unknown> } | null)?.questionResponses;
  const contacto = qr?.contactInformationQuestionResponses as Record<string, { value?: unknown } | undefined> | undefined;
  const faltan: string[] = [];
  const vacio = (v: { value?: unknown } | undefined) => typeof v?.value !== "string" || v.value.trim() === "";
  if (vacio(contacto?.firstNameAnswer)) faltan.push("firstName");
  if (vacio(contacto?.lastNameAnswer)) faltan.push("lastName");
  if (vacio(contacto?.emailAnswer)) faltan.push("email");
  const cv = (qr?.resumeQuestionResponses as { resumeQuestionAnswer?: unknown } | null | undefined)?.resumeQuestionAnswer;
  if (!cv) faltan.push("resume");
  return faltan;
}

/**
 * POST del webhook. Verifica la firma sobre el cuerpo crudo, valida el contrato, guarda la recepción
 * y crea el trabajo persistente en una misma transacción, y responde de inmediato.
 * El procesamiento (descarga del CV, llamadas al ATS) lo hace el worker.
 */
export async function recibirPostulacion(cuerpoCrudo: string, firma: string | null): Promise<RespuestaHttp> {
  const cfg = config();

  if (!firmaValida(cuerpoCrudo, firma, cfg.SIM_CLIENT_SECRET)) {
    await registrarRechazo("SIGNATURE_MISMATCH", "La firma X-LI-Signature no coincide con el cuerpo recibido.");
    return { status: 401, body: cuerpoError("SIGNATURE_MISMATCH") };
  }

  let json: unknown;
  try {
    json = JSON.parse(cuerpoCrudo);
  } catch {
    await registrarRechazo("INPUT_VALIDATION_FAILED", "El cuerpo no es JSON válido.");
    return {
      status: 400,
      body: cuerpoError("INPUT_VALIDATION_FAILED", { otherErrorDetails: "El cuerpo no es JSON válido." }),
    };
  }

  const ids = json as { jobApplicationId?: string; externalJobId?: string };
  const extra = {
    jobApplicationId: typeof ids?.jobApplicationId === "string" ? ids.jobApplicationId.slice(0, 200) : undefined,
    externalJobId: typeof ids?.externalJobId === "string" ? ids.externalJobId.slice(0, 200) : undefined,
  };

  const faltan = respuestasFaltantes(json);
  if (faltan.length > 0) {
    await registrarRechazo("MISSING_REQUIRED_RESPONSE", `Faltan respuestas obligatorias: ${faltan.join(", ")}.`, extra);
    return {
      status: 400,
      body: cuerpoError("MISSING_REQUIRED_RESPONSE", {
        missingQuestionResponseErrorDetails: { partnerQuestionIdentifiers: faltan },
      }),
    };
  }

  const r = esquemaPayload.safeParse(json);
  if (!r.success) {
    const detalles = r.error.issues.slice(0, 10).map((i) => ({
      partnerQuestionIdentifier: i.path.join("."),
      validationHint: i.message,
    }));
    await registrarRechazo("INPUT_VALIDATION_FAILED", `Formato inválido en: ${detalles.map((d) => d.partnerQuestionIdentifier).join(", ")}.`, extra);
    return {
      status: 400,
      body: cuerpoError("INPUT_VALIDATION_FAILED", {
        inputValidationErrorDetails: { invalidInputQuestionIdentifierDetails: detalles },
      }),
    };
  }
  const p = r.data;
  const contacto = p.questionResponses.contactInformationQuestionResponses;
  const cv = p.questionResponses.resumeQuestionResponses!.resumeQuestionAnswer!;
  const correo = contacto.emailAnswer.value.trim().toLowerCase();

  const invalidos: { partnerQuestionIdentifier: string; validationHint: string }[] = [];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    invalidos.push({ partnerQuestionIdentifier: "email", validationHint: "Correo con formato inválido." });
  }
  if (!urlDeMediaPermitida(cv.mediaUrl, cfg.ORIGEN_BASE_URL)) {
    invalidos.push({ partnerQuestionIdentifier: "resume", validationHint: "mediaUrl fuera del origen autorizado." });
  }
  if (invalidos.length > 0) {
    await registrarRechazo("INPUT_VALIDATION_FAILED", invalidos.map((i) => i.validationHint).join(" "), extra);
    return {
      status: 400,
      body: cuerpoError("INPUT_VALIDATION_FAILED", {
        inputValidationErrorDetails: { invalidInputQuestionIdentifierDetails: invalidos },
      }),
    };
  }

  // Duplicado: si ya existe, se responde 200 sin crear nada (decisión D-06) y se cuenta como duplicado evitado.
  const existente = await prisma.recepcion.findUnique({ where: { jobApplicationId: p.jobApplicationId } });
  if (existente) return await responderDuplicado(existente.id, p.jobApplicationId);

  const correspondencia = await prisma.correspondencia.findUnique({ where: { externalJobId: p.externalJobId } });
  if (!admitePostulacion(correspondencia, new Date(p.appliedAt))) {
    const motivo = !correspondencia
      ? "La vacante no tiene correspondencia con un proceso del ATS."
      : correspondencia.motivoCierre === "ORIGEN"
        ? "La vacante se cerró en el origen antes de esta postulación."
        : "La vacante está desvinculada en el puente.";
    await registrarRechazo("JOB_POSTING_CLOSED", motivo, extra);
    return { status: 422, body: cuerpoError("JOB_POSTING_CLOSED", { otherErrorDetails: motivo }) };
  }

  const telefono = contacto.cellphoneNumberQuestionAnswer
    ? `+${contacto.cellphoneNumberQuestionAnswer.countryCode ?? ""}${contacto.cellphoneNumberQuestionAnswer.nationalNumber}`.replace(/^\+$/, "")
    : null;

  try {
    const recepcion = await prisma.recepcion.create({
      data: {
        jobApplicationId: p.jobApplicationId,
        jobApplicant: p.jobApplicant,
        externalJobId: p.externalJobId,
        appliedAt: new Date(p.appliedAt),
        payloadSha256: sha256Hex(Buffer.from(cuerpoCrudo, "utf8")),
        nombre: contacto.firstNameAnswer.value.trim(),
        apellido: contacto.lastNameAnswer.value.trim(),
        correo,
        telefono,
        ciudad: contacto.locationAnswer?.locationCityAnswer?.value ?? null,
        mediaUrl: cv.mediaUrl,
        mediaUrn: cv.mediaUrn,
        trabajo: { create: {} },
        eventos: { create: { tipo: "RECIBIDO", detalle: "Postulación recibida y firma verificada." } },
      },
    });
    return { status: 200, body: { estado: "RECIBIDO", referencia: recepcion.id } };
  } catch (e) {
    // Dos entregas simultáneas del mismo evento: la restricción única deja pasar solo una.
    if (esViolacionUnica(e)) {
      const otra = await prisma.recepcion.findUnique({ where: { jobApplicationId: p.jobApplicationId } });
      if (otra) return await responderDuplicado(otra.id, p.jobApplicationId);
    }
    console.error("[puente] Error guardando la recepción", e);
    return { status: 500, body: cuerpoError("TRANSIENT_ERROR") };
  }
}

async function responderDuplicado(recepcionId: string, jobApplicationId: string): Promise<RespuestaHttp> {
  await prisma.recepcion.update({
    where: { id: recepcionId },
    data: {
      duplicadosEvitados: { increment: 1 },
      eventos: { create: { tipo: "DUPLICADO", detalle: "Se recibió de nuevo el mismo jobApplicationId; no se creó nada." } },
    },
  });
  return { status: 200, body: { estado: "DUPLICADO", referencia: recepcionId, jobApplicationId } };
}

/** Solo se descargan CV desde la URL base configurada del origen y su ruta de medios, nunca de un host arbitrario. */
export function urlDeMediaPermitida(mediaUrl: string, origenBase: string): boolean {
  try {
    const u = new URL(mediaUrl);
    const base = new URL(origenBase);
    return u.origin === base.origin && u.pathname.startsWith("/api/origen/media/") && !u.username && !u.password;
  } catch {
    return false;
  }
}

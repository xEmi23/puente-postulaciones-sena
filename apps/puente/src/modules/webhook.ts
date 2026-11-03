import { prisma } from "@/lib/db";
import { firmaValida, respuestaDesafio } from "@/lib/firma";
import { sha256Hex } from "@/lib/archivos";
import { cuerpoError, esquemaPayload, type CodigoError } from "@/modules/contrato-apply-connect";
import { registrarRecepcion } from "@/nucleo/recepcion/registrar";
import { FUENTE_APPLY_CONNECT, mapearEntrega } from "@/entradas/apply-connect/mapeo";
import { conexionVinculo } from "./conexiones";

export interface RespuestaHttp {
  status: number;
  body: unknown;
}

/**
 * GET de validación del endpoint (desafío de Vínculo): {challengeCode, challengeResponse} con 200, firmado con el
 * Client Secret de la conexión configurada. Sin conexión no se puede responder (503).
 */
export async function responderDesafio(challengeCode: string | null): Promise<RespuestaHttp> {
  if (!challengeCode || challengeCode.length > 200) {
    return { status: 400, body: { error: "Falta el parámetro challengeCode." } };
  }
  const c = await conexionVinculo();
  if (!c) return { status: 503, body: { error: "El puente aún no tiene configurada la conexión con el Simulador LinkedIn." } };
  await prisma.conexion.update({ where: { tipo: "VINCULO" }, data: { webhookValidadoEn: new Date() } });
  return { status: 200, body: { challengeCode, challengeResponse: respuestaDesafio(challengeCode, c.clientSecret) } };
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
 * POST del webhook (adaptador Apply Connect). Verifica la firma sobre el cuerpo crudo y el formato de Apply Connect,
 * lo convierte a la PostulacionCanonica v1 y la entrega al núcleo con registrarRecepcion(), que deduplica, resuelve el
 * proceso, guarda y encola. El procesamiento (descarga del CV, llamadas al ATS) lo hace el worker.
 */
export async function recibirPostulacion(cuerpoCrudo: string, firma: string | null): Promise<RespuestaHttp> {
  const c = await conexionVinculo();
  if (!c) {
    // Sin secreto no se puede verificar la firma: se pide reintentar (TRANSIENT_ERROR) en vez de perder la entrega.
    await registrarRechazo("TRANSIENT_ERROR", "El puente aún no tiene configurada la conexión con el Simulador LinkedIn.");
    return { status: 503, body: cuerpoError("TRANSIENT_ERROR", { otherErrorDetails: "Conexión con el Simulador LinkedIn sin configurar." }) };
  }

  if (!firmaValida(cuerpoCrudo, firma, c.clientSecret)) {
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
  if (!urlDeMediaPermitida(cv.mediaUrl, c.urlBase)) {
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

  const { canonica, cvRemoto } = mapearEntrega(p);
  let r2;
  try {
    r2 = await registrarRecepcion(canonica, { tipo: "remoto", ...cvRemoto }, { tipo: "fuente", id: FUENTE_APPLY_CONNECT }, {
      detalleRecibido: "Postulación recibida y firma verificada.",
      detalleDuplicado: "Se recibió de nuevo el mismo jobApplicationId; no se creó nada.",
      payloadSha256: sha256Hex(Buffer.from(cuerpoCrudo, "utf8")),
    });
  } catch (e) {
    // Solo la primera línea del mensaje: sin la consulta completa ni datos personales.
    console.error("[puente] Error guardando la recepción:", e instanceof Error ? e.message.split("\n")[0] : "desconocido");
    return { status: 500, body: cuerpoError("TRANSIENT_ERROR") };
  }
  switch (r2.resultado) {
    case "RECIBIDA":
      return { status: 200, body: { estado: "RECIBIDO", referencia: r2.recepcionId } };
    case "REQUIERE_REVISION":
      // La entrega es válida (Vínculo no debe reintentarla): queda guardada esperando a una persona (posible duplicado).
      return { status: 200, body: { estado: "RECIBIDO", referencia: r2.recepcionId, requiereRevision: r2.motivos } };
    case "DUPLICADA":
      // Duplicado: se responde 200 sin crear nada (D-06) y se cuenta como duplicado evitado.
      return { status: 200, body: { estado: "DUPLICADO", referencia: r2.recepcionId, jobApplicationId: p.jobApplicationId } };
    case "SIN_CORRESPONDENCIA":
      await registrarRechazo("JOB_POSTING_CLOSED", r2.motivo, extra);
      return { status: 422, body: cuerpoError("JOB_POSTING_CLOSED", { otherErrorDetails: r2.motivo }) };
    case "INVALIDA": {
      const detalles = r2.errores.map((e) => ({ partnerQuestionIdentifier: e.campo, validationHint: e.mensaje }));
      await registrarRechazo("INPUT_VALIDATION_FAILED", `Formato inválido en: ${detalles.map((d) => d.partnerQuestionIdentifier).join(", ")}.`, extra);
      return { status: 400, body: cuerpoError("INPUT_VALIDATION_FAILED", { inputValidationErrorDetails: { invalidInputQuestionIdentifierDetails: detalles } }) };
    }
    default:
      return { status: 500, body: cuerpoError("TRANSIENT_ERROR") };
  }
}

/** Solo se descargan CV desde la URL base configurada de Vínculo y su ruta de medios, nunca de un host arbitrario. */
export function urlDeMediaPermitida(mediaUrl: string, origenBase: string): boolean {
  try {
    const u = new URL(mediaUrl);
    const base = new URL(origenBase);
    return u.origin === base.origin && u.pathname.startsWith("/api/v1/media/") && !u.username && !u.password;
  } catch {
    return false;
  }
}

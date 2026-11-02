import type { z } from "zod";
import type { esquemaPayload } from "@/modules/contrato-apply-connect";
import { VERSION_CONTRATO, type PostulacionCanonica } from "@/nucleo/contrato/canonica";

// Adaptador de entrada Apply Connect (Vínculo, **simulado**): entrega EXPORT_JOB_APPLICATION → PostulacionCanonica v1.
// La firma HMAC y la validación del formato de Apply Connect se hacen antes, en src/modules/webhook.ts; la descarga
// del CV por mediaUrl la hace ./cv.ts durante el procesamiento.

export const FUENTE_APPLY_CONNECT = "apply-connect";

type Payload = z.infer<typeof esquemaPayload>;

/** Devuelve la canónica SIN normalizar (la normaliza el núcleo) y los datos del CV remoto. */
export function mapearEntrega(p: Payload) {
  const contacto = p.questionResponses.contactInformationQuestionResponses;
  const cv = p.questionResponses.resumeQuestionResponses!.resumeQuestionAnswer!;
  const tel = contacto.cellphoneNumberQuestionAnswer;
  const canonica = {
    version: VERSION_CONTRATO,
    fuente: FUENTE_APPLY_CONNECT,
    idExterno: p.jobApplicationId,
    vacanteExterna: p.externalJobId,
    recibidaEn: new Date(p.appliedAt).toISOString(),
    candidato: {
      nombres: contacto.firstNameAnswer.value,
      apellidos: contacto.lastNameAnswer.value,
      correo: contacto.emailAnswer.value,
      telefono: tel ? `+${tel.countryCode ?? "57"}${tel.nationalNumber}` : undefined,
      ciudad: contacto.locationAnswer?.locationCityAnswer?.value ?? undefined,
      // El URN del postulante en la fuente (referencia externa del postulante en el ATS, como en la v2).
      perfilUrl: p.jobApplicant,
    },
    origenDatos: "fuente" as PostulacionCanonica["origenDatos"],
  };
  return { canonica, cvRemoto: { mediaUrl: cv.mediaUrl, mediaUrn: cv.mediaUrn } };
}

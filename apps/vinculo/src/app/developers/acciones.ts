"use server";

import { randomInt, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { urlPublica } from "@/lib/config";
import { exigirUsuarioAccion } from "@/lib/sesion-servidor";
import { crearAplicacion, regenerarSecreto, registrarWebhook, revocarAplicacion, secretoDe } from "@/modules/aplicaciones";
import { enviarAlWebhook, reenviarEvento } from "@/modules/despachador";
import { CASOS_CONSOLA } from "./casos";

export interface EstadoSecreto {
  clientId?: string;
  clientSecret?: string;
  appId?: string;
  validacion?: string;
  error?: string;
}

/** Crea la aplicación y devuelve el Client Secret UNA vez (en el resultado de la acción; nunca en la URL). */
export async function crearApp(_p: EstadoSecreto, formData: FormData): Promise<EstadoSecreto> {
  const u = await exigirUsuarioAccion();
  const r = await crearAplicacion(u.id, { nombre: formData.get("nombre"), webhookUrl: formData.get("webhookUrl") });
  if (!r.ok) return { error: r.error };
  revalidatePath("/developers");
  return { clientId: r.app.clientId, clientSecret: r.clientSecret, appId: r.app.id, validacion: r.validacion?.detalle };
}

async function propia(appId: string) {
  const u = await exigirUsuarioAccion();
  const app = await prisma.aplicacionDev.findFirst({ where: { id: appId, propietarioId: u.id } });
  if (!app) throw new Error("La aplicación no existe o no es tuya.");
  return app;
}

export async function regenerar(_p: EstadoSecreto, formData: FormData): Promise<EstadoSecreto> {
  const app = await propia(String(formData.get("appId")));
  if (app.revocadaEn) return { error: "La aplicación está revocada." };
  const clientSecret = await regenerarSecreto(app.id);
  revalidatePath(`/developers/aplicaciones/${app.id}`);
  return { clientId: app.clientId, clientSecret, appId: app.id };
}

export async function revocar(formData: FormData) {
  const app = await propia(String(formData.get("appId")));
  await revocarAplicacion(app.id);
  revalidatePath(`/developers/aplicaciones/${app.id}`);
}

export interface EstadoWebhook {
  ok?: boolean;
  detalle?: string;
}

export async function guardarWebhook(_p: EstadoWebhook, formData: FormData): Promise<EstadoWebhook> {
  const app = await propia(String(formData.get("appId")));
  const url = String(formData.get("webhookUrl") ?? "").trim();
  if (!url) return { ok: false, detalle: "Escribe la URL del webhook." };
  const v = await registrarWebhook(app.id, url);
  revalidatePath(`/developers/aplicaciones/${app.id}`);
  return v;
}

export interface EstadoEnvio {
  status?: string;
  cuerpo?: string;
}

/** «Reenviar»: el mismo cuerpo con la misma firma (redeliver). */
export async function reenviar(_p: EstadoEnvio, formData: FormData): Promise<EstadoEnvio> {
  const app = await propia(String(formData.get("appId")));
  const fila = await prisma.outbox.findFirst({ where: { id: String(formData.get("outboxId")), aplicacionId: app.id } });
  if (!fila) return { status: "No existe" };
  const r = await reenviarEvento(fila.id);
  revalidatePath(`/developers/aplicaciones/${app.id}`);
  return { status: r.httpStatus ? `HTTP ${r.httpStatus}` : (r.error ?? "Sin respuesta"), cuerpo: r.respuesta };
}

type Caso = keyof typeof CASOS_CONSOLA;

function payloadBase(externalJobId: string) {
  const id = randomUUID();
  return {
    type: "EXPORT_JOB_APPLICATION",
    externalJobId,
    jobApplicationId: `urn:li:jobApplication:${randomInt(1_000_000_000, 9_999_999_999)}`,
    jobApplicant: "urn:li:person:consolaprueba",
    appliedAt: Date.now(),
    questionResponses: {
      contactInformationQuestionResponses: {
        firstNameAnswer: { value: "Persona" },
        lastNameAnswer: { value: "De Prueba" },
        emailAnswer: { value: "consola@demo.test" } as { value: string } | undefined,
      },
      resumeQuestionResponses: { resumeQuestionAnswer: { mediaUrl: `${urlPublica()}/api/v1/media/${id}`, mediaUrn: `urn:li:media:${id}` } },
    },
  };
}

export async function consola(_p: EstadoEnvio, formData: FormData): Promise<EstadoEnvio> {
  const app = await propia(String(formData.get("appId")));
  if (!app.webhookUrl) return { status: "La aplicación no tiene webhook." };
  const caso = String(formData.get("caso")) as Caso;
  if (!(caso in CASOS_CONSOLA)) return { status: "Caso desconocido." };
  const ultima = await prisma.vacante.findFirst({ where: { aplicacionId: app.id }, orderBy: { creadaEn: "desc" } });
  const p = payloadBase(caso === "sin_vincular" ? `NO-EXISTE-${randomInt(1000, 9999)}` : (ultima?.externalJobId ?? "NO-EXISTE"));
  let cuerpo = JSON.stringify(p);
  let firma: string | undefined;
  if (caso === "firma_invalida") firma = "0".repeat(64);
  if (caso === "falta_correo") {
    delete p.questionResponses.contactInformationQuestionResponses.emailAnswer;
    cuerpo = JSON.stringify(p);
  }
  if (caso === "correo_invalido") {
    p.questionResponses.contactInformationQuestionResponses.emailAnswer = { value: "esto-no-es-un-correo" };
    cuerpo = JSON.stringify(p);
  }
  if (caso === "host_no_autorizado") {
    p.questionResponses.resumeQuestionResponses.resumeQuestionAnswer.mediaUrl = "http://169.254.169.254/latest/meta-data";
    cuerpo = JSON.stringify(p);
  }
  if (caso === "json_ilegible") cuerpo = "{esto no es json";
  const r = await enviarAlWebhook(app.webhookUrl, cuerpo, secretoDe(app), { firma });
  return { status: r.httpStatus ? `HTTP ${r.httpStatus}` : (r.error ?? "Sin respuesta"), cuerpo: r.respuesta };
}

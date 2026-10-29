import { createHash, randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { firmarCuerpo } from "@/lib/firma";
import { sembrarDemo } from "../prisma/datos-demo";
import { procesarPendientes } from "@/modules/procesador";
import * as webhook from "@/app/api/puente/webhook/route";
import * as estadoVacante from "@/app/api/puente/vacantes/estado/route";
import { TalentiaDoble, VinculoDoble } from "./dobles";

export { prisma };

export const vinculo = new VinculoDoble("http://vinculo.test", () => process.env.ORIGEN_MEDIA_ACCESS_TOKEN!);
export const talentia = new TalentiaDoble(() => process.env.ATS_API_KEY!);

/** Vacía el esquema del puente, siembra las correspondencias de demo y reinicia los dobles. */
export async function reiniciarBd() {
  await prisma.$executeRawUnsafe(`TRUNCATE "EventoRecepcion", "Trabajo", "Recepcion", "EntregaRechazada", "Correspondencia", "FalloSimulado" CASCADE`);
  await sembrarDemo(prisma);
  vinculo.reiniciar();
  talentia.reiniciar();
}

export function leerCv(nombre = "cv-camila-ejemplo.pdf"): Uint8Array {
  return new Uint8Array(readFileSync(path.resolve(__dirname, "../../../fixtures/cv", nombre)));
}

/** fetch sin red: puente.test → rutas reales del puente; vinculo.test y talentia.test → dobles de contrato. */
export const fetchEnProceso: typeof fetch = async (entrada, init) => {
  const req = new Request(entrada, init);
  const senal = init?.signal;
  // Igual que un fetch real: si la señal se aborta (timeout), la llamada se rechaza aunque el servidor siga trabajando.
  if (!senal) return despachar(req);
  if (senal.aborted) throw senal.reason;
  return Promise.race([
    despachar(req),
    new Promise<never>((_, rechazar) => senal.addEventListener("abort", () => rechazar(senal.reason), { once: true })),
  ]);
};

async function despachar(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (url.host === "vinculo.test") return vinculo.atender(req);
  if (url.host === "talentia.test") return talentia.atender(req);
  if (url.host !== "puente.test") throw new TypeError(`fetch a host no permitido en pruebas: ${url.host}`);
  if (url.pathname === "/api/puente/webhook") return req.method === "GET" ? webhook.GET(req) : webhook.POST(req);
  if (url.pathname === "/api/puente/vacantes/estado") return estadoVacante.POST(req);
  return new Response("No encontrado", { status: 404 });
}

export const opcionesRapidas = { fetchImpl: fetchEnProceso, baseBackoffMs: 1 };

export const datosPersona = { nombre: "Camila", apellido: "Ejemplo Ficticia", correo: "camila.ejemplo@demo.test", telefono: "3000000001", ciudad: "Medellín" };

/** Cuerpo de una entrega EXPORT_JOB_APPLICATION tal como la arma Vínculo (formato de docs/contratos.md §1), con su CV en el doble. */
export function construirEntrega(opciones: { codigo?: string; datos?: typeof datosPersona; cv?: string; appliedAt?: number } = {}) {
  const d = opciones.datos ?? datosPersona;
  const media = vinculo.agregarCv(leerCv(opciones.cv), opciones.cv ?? "cv-camila-ejemplo.pdf");
  const jobApplicationId = `urn:li:jobApplication:${randomInt(1_000_000_000, 9_999_999_999)}`;
  const cuerpo = JSON.stringify({
    type: "EXPORT_JOB_APPLICATION",
    externalJobId: opciones.codigo ?? "RT-2026-101",
    jobApplicationId,
    jobApplicant: `urn:li:person:${createHash("sha256").update(d.correo).digest("hex").slice(0, 16)}`,
    appliedAt: opciones.appliedAt ?? Date.now(),
    questionResponses: {
      contactInformationQuestionResponses: {
        firstNameAnswer: { value: d.nombre },
        lastNameAnswer: { value: d.apellido },
        emailAnswer: { value: d.correo },
        cellphoneNumberQuestionAnswer: { countryCode: "57", nationalNumber: d.telefono },
        locationAnswer: { locationCityAnswer: { value: d.ciudad }, locationCountryAnswer: { value: "CO" } },
      },
      resumeQuestionResponses: { resumeQuestionAnswer: media },
    },
  });
  return { cuerpo, jobApplicationId };
}

/** Envía un payload firmado (o con la firma indicada) al webhook del puente. */
export async function enviarWebhook(cuerpo: string, firma?: string | null) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const f = firma === undefined ? firmarCuerpo(cuerpo, process.env.SIM_CLIENT_SECRET!) : firma;
  if (f !== null) headers["X-LI-Signature"] = f;
  const r = await fetchEnProceso("http://puente.test/api/puente/webhook", { method: "POST", headers, body: cuerpo });
  return { status: r.status, body: (await r.json()) as Record<string, unknown> };
}

/** Una postulación entregada al puente (aún sin procesar). */
export async function postular(opciones: Parameters<typeof construirEntrega>[0] = {}) {
  const e = construirEntrega(opciones);
  const r = await enviarWebhook(e.cuerpo);
  if (r.status !== 200) throw new Error(`El puente rechazó la entrega: ${r.status} ${JSON.stringify(r.body)}`);
  return e;
}

/** Evento JOB_POSTING_STATUS firmado (contrato del simulador, docs/contratos.md §2.1). */
export async function enviarEstadoVacante(externalJobId: string, estado: "CERRADA" | "PUBLICADA", cambiadoEn = Date.now(), firma?: string) {
  const cuerpo = JSON.stringify({ type: "JOB_POSTING_STATUS", externalJobId, estado, cambiadoEn });
  const r = await fetchEnProceso("http://puente.test/api/puente/vacantes/estado", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-LI-Signature": firma ?? firmarCuerpo(cuerpo, process.env.SIM_CLIENT_SECRET!) },
    body: cuerpo,
  });
  return { status: r.status, body: (await r.json()) as Record<string, unknown> };
}

/** Ejecuta el procesador hasta que no quede trabajo listo (o se agoten las vueltas). */
export async function drenar(vueltas = 20) {
  for (let i = 0; i < vueltas; i++) {
    // Los reintentos con backoff de 1 ms quedan listos casi de inmediato.
    await new Promise((ok) => setTimeout(ok, 5));
    const hechos = await procesarPendientes(opcionesRapidas);
    if (hechos === 0 && (await prisma.trabajo.count({ where: { estado: { in: ["PENDIENTE", "EN_CURSO"] } } })) === 0) return;
  }
}

export function payloadValido(sobrescribir: Record<string, unknown> = {}) {
  return {
    type: "EXPORT_JOB_APPLICATION",
    externalJobId: "RT-2026-101",
    jobApplicationId: "urn:li:jobApplication:1234567890",
    jobApplicant: "urn:li:person:abc123",
    appliedAt: 1761400000000,
    questionResponses: {
      contactInformationQuestionResponses: {
        firstNameAnswer: { value: "Camila" },
        lastNameAnswer: { value: "Ejemplo" },
        emailAnswer: { value: "camila.ejemplo@demo.test" },
      },
      resumeQuestionResponses: {
        resumeQuestionAnswer: {
          mediaUrl: "http://vinculo.test/api/origen/media/00000000-0000-4000-8000-000000000000",
          mediaUrn: "urn:li:media:00000000-0000-4000-8000-000000000000",
        },
      },
    },
    ...sobrescribir,
  };
}

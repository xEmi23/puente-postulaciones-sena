import { createHash, randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { firmarCuerpo } from "@/lib/firma";
import { sembrarDemo } from "../prisma/datos-demo";
import { procesarPendientes } from "@/modules/procesador";
import { olvidarToken } from "@/modules/vinculo-cliente";
import * as webhook from "@/app/api/webhooks/vinculo/route";
import { guardarTalentia, guardarVinculo } from "@/modules/conexiones";
import { TalentiaDoble, VinculoDoble } from "./dobles";

export { prisma };

/** Credenciales de los dobles: el puente las recibe como en /conexiones (se guardan cifradas). */
export const CREDENCIALES = { clientId: "vin_pruebas00000001", clientSecret: "secreto-cliente-de-pruebas-0123456789", apiKey: "tal_pruebas0.llave-de-pruebas-0123456789" };

export const vinculo = new VinculoDoble("http://vinculo.test", () => ({ clientId: CREDENCIALES.clientId, clientSecret: CREDENCIALES.clientSecret }));
export const talentia = new TalentiaDoble(() => CREDENCIALES.apiKey);

/** Configura las dos conexiones (como un administrador en /conexiones, ya probadas). */
export async function conectar() {
  const v = await guardarVinculo({ urlBase: "http://vinculo.test", clientId: CREDENCIALES.clientId, clientSecret: CREDENCIALES.clientSecret });
  const t = await guardarTalentia({ urlBase: "http://talentia.test", apiKey: CREDENCIALES.apiKey });
  if (!v.ok || !t.ok) throw new Error("No se pudieron guardar las conexiones de prueba");
  await prisma.conexion.update({ where: { tipo: "VINCULO" }, data: { estadoPrueba: "OK", empresaId: vinculo.empresa.companyId, empresaNombre: vinculo.empresa.name } });
  await prisma.conexion.update({ where: { tipo: "TALENTIA" }, data: { estadoPrueba: "OK" } });
}

/**
 * Vacía el esquema del puente, siembra las cuentas, configura las conexiones con los dobles y crea dos correspondencias
 * (RT-2026-101 → 9001 y RT-2026-102 → 9002, vacantes creadas directamente en Vínculo). RT-2026-103 queda sin proceso.
 */
export async function reiniciarBd() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE "EventoRecepcion", "Trabajo", "Recepcion", "EntregaRechazada", "Correspondencia", "Publicacion", "Conexion", "Configuracion", "FalloSimulado", "Session", "Account", "Verification", "User" CASCADE`,
  );
  await sembrarDemo(prisma);
  await conectar();
  for (const [externalJobId, procesoAtsId] of [["RT-2026-101", 9001], ["RT-2026-102", 9002]] as const) {
    await prisma.correspondencia.create({ data: { externalJobId, procesoAtsId, descripcion: `${externalJobId} → proceso ${procesoAtsId}` } });
  }
  vinculo.reiniciar();
  olvidarToken();
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
  if (url.pathname === "/api/webhooks/vinculo") return req.method === "GET" ? webhook.GET(req) : webhook.POST(req);
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
  const f = firma === undefined ? firmarCuerpo(cuerpo, CREDENCIALES.clientSecret) : firma;
  if (f !== null) headers["X-LI-Signature"] = f;
  const r = await fetchEnProceso("http://puente.test/api/webhooks/vinculo", { method: "POST", headers, body: cuerpo });
  return { status: r.status, body: (await r.json()) as Record<string, unknown> };
}

/** Una postulación entregada al puente (aún sin procesar). */
export async function postular(opciones: Parameters<typeof construirEntrega>[0] = {}) {
  const e = construirEntrega(opciones);
  const r = await enviarWebhook(e.cuerpo);
  if (r.status !== 200) throw new Error(`El puente rechazó la entrega: ${r.status} ${JSON.stringify(r.body)}`);
  return e;
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
          mediaUrl: "http://vinculo.test/api/v1/media/00000000-0000-4000-8000-000000000000",
          mediaUrn: "urn:li:media:00000000-0000-4000-8000-000000000000",
        },
      },
    },
    ...sobrescribir,
  };
}

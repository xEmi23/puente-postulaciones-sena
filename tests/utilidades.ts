import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { firmarCuerpo } from "@/lib/firma";
import { sembrarDemo } from "../prisma/datos-demo";
import { crearPostulacion } from "@/modules/origen/postulacion";
import { despacharPendientes } from "@/modules/origen/despachador";
import { procesarPendientes } from "@/modules/puente/procesador";
import { fetchEnProceso } from "./http-en-proceso";

export { prisma, fetchEnProceso };

/** Vacía los tres esquemas y siembra los datos de demostración. */
export async function reiniciarBd() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE origen."IntentoEntrega", origen."Outbox", origen."Postulacion", origen."ArchivoCv", origen."Vacante",
             puente."EventoRecepcion", puente."Trabajo", puente."Recepcion", puente."EntregaRechazada", puente."Correspondencia",
             ats."Postulacion", ats."Documento", ats."Candidato", ats."Etapa", ats."Proceso", ats."ClaveIdempotencia", ats."FalloSimulado"
    CASCADE`);
  await sembrarDemo(prisma);
}

export function leerCv(nombre = "cv-camila-ejemplo.pdf"): Uint8Array {
  return new Uint8Array(readFileSync(path.resolve("fixtures/cv", nombre)));
}

export const datosPersona = {
  nombre: "Camila",
  apellido: "Ejemplo Ficticia",
  correo: "camila.ejemplo@demo.test",
  telefono: "300 000 0001",
  ciudad: "Medellín",
};

export async function vacante(codigo: string) {
  return prisma.vacante.findUniqueOrThrow({ where: { codigo } });
}

/** Crea una postulación en el origen y devuelve su id. */
export async function postularEnOrigen(codigo = "RT-2026-101", datos = datosPersona, cv = "cv-camila-ejemplo.pdf") {
  const v = await vacante(codigo);
  const r = await crearPostulacion(v.id, datos, { nombre: cv, bytes: leerCv(cv) });
  if (!r.ok) throw new Error(`Postulación inválida: ${JSON.stringify(r.errores)}`);
  return r;
}

export const opcionesRapidas = { fetchImpl: fetchEnProceso, baseBackoffMs: 1 };

/** Ejecuta despachador y procesador hasta que no quede trabajo listo (o se agoten las vueltas). */
export async function drenar(vueltas = 20) {
  for (let i = 0; i < vueltas; i++) {
    // Los reintentos con backoff de 1 ms quedan listos casi de inmediato.
    await new Promise((ok) => setTimeout(ok, 5));
    const a = await despacharPendientes(opcionesRapidas);
    const b = await procesarPendientes(opcionesRapidas);
    if (a === 0 && b === 0) {
      const pendientes = await prisma.trabajo.count({ where: { estado: { in: ["PENDIENTE", "EN_CURSO"] } } });
      const outbox = await prisma.outboxOrigen.count({ where: { estado: "PENDIENTE" } });
      if (pendientes === 0 && outbox === 0) return;
    }
  }
}

/** Envía un payload firmado (o con la firma indicada) directamente al webhook del puente. */
export async function enviarWebhook(cuerpo: string, firma?: string | null) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const f = firma === undefined ? firmarCuerpo(cuerpo, process.env.SIM_CLIENT_SECRET!) : firma;
  if (f !== null) headers["X-LI-Signature"] = f;
  const r = await fetchEnProceso("http://app.test/api/puente/webhook", { method: "POST", headers, body: cuerpo });
  return { status: r.status, body: (await r.json()) as Record<string, unknown> };
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
          mediaUrl: "http://app.test/api/origen/media/00000000-0000-4000-8000-000000000000",
          mediaUrn: "urn:li:media:00000000-0000-4000-8000-000000000000",
        },
      },
    },
    ...sobrescribir,
  };
}

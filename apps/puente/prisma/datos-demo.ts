import type { PrismaClient } from "../src/generated/prisma/client";

// Datos ficticios del puente: correspondencias vacante de Vínculo → proceso de Talentia.
// RT-2026-103 queda a propósito SIN correspondencia (el puente no adivina el proceso).

export const CORRESPONDENCIAS = [
  { externalJobId: "RT-2026-101", procesoAtsId: 9001, descripcion: "Desarrollador/a Backend Java → proceso 9001" },
  { externalJobId: "RT-2026-102", procesoAtsId: 9002, descripcion: "Analista de Calidad de Software (QA) → proceso 9002" },
] as const;

/** Borra solo las filas marcadas demo = true y vuelve a sembrar. */
export async function sembrarDemo(prisma: PrismaClient) {
  await prisma.$transaction([
    prisma.recepcion.deleteMany({ where: { demo: true } }),
    prisma.entregaRechazada.deleteMany({ where: { demo: true } }),
    prisma.correspondencia.deleteMany({ where: { demo: true } }),
    prisma.falloSimulado.deleteMany({}),
  ]);
  for (const c of CORRESPONDENCIAS) await prisma.correspondencia.create({ data: c });
}

import type { PrismaClient } from "../src/generated/prisma/client";
import { etapasParaCrear } from "../src/modules/etapas";

// Datos ficticios de Talentia. Las etapas vienen de src/modules/etapas.ts (ATS de la empresa, 15/10/2026).

export const PROCESOS = [
  {
    id: 9001,
    nombre: "Desarrollador/a Backend Java",
    prioridad: "Alta",
    diasDesdeInicio: 10,
    area: "Ingeniería",
    ciudad: "Medellín",
  },
  {
    id: 9002,
    nombre: "Analista de Calidad de Software (QA)",
    prioridad: "Media",
    diasDesdeInicio: 3,
    area: "Calidad",
    ciudad: "Medellín (híbrido)",
  },
] as const;

/** Borra solo las filas marcadas demo = true (las tablas hijas caen en cascada) y vuelve a sembrar. */
export async function sembrarDemo(prisma: PrismaClient) {
  await prisma.$transaction([
    prisma.candidato.deleteMany({ where: { demo: true } }),
    prisma.proceso.deleteMany({ where: { demo: true } }),
    prisma.claveIdempotencia.deleteMany({}),
  ]);
  for (const p of PROCESOS) {
    await prisma.proceso.create({
      data: {
        id: p.id,
        nombre: p.nombre,
        area: p.area,
        ciudad: p.ciudad,
        prioridad: p.prioridad,
        fechaInicio: new Date(Date.now() - p.diasDesdeInicio * 86_400_000),
        etapas: { create: etapasParaCrear() },
      },
    });
  }
}

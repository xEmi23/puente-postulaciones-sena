import type { PrismaClient } from "../src/generated/prisma/client";

// Datos ficticios de Vínculo para la demostración.

export const VACANTES = [
  {
    codigo: "RT-2026-101",
    titulo: "Desarrollador/a Backend Java",
    area: "Ingeniería",
    ciudad: "Medellín",
    modalidad: "Híbrido",
    descripcion:
      "Buscamos una persona para construir y mantener servicios backend en Java y Spring Boot. Trabajarás con PostgreSQL, pruebas automatizadas e integración continua en un equipo ágil. Vacante ficticia para la demostración.",
  },
  {
    codigo: "RT-2026-102",
    titulo: "Analista de Calidad de Software (QA)",
    area: "Calidad",
    ciudad: "Medellín",
    modalidad: "Híbrido",
    descripcion:
      "Diseñarás y ejecutarás pruebas funcionales y automatizadas, reportarás defectos y acompañarás al equipo de desarrollo para asegurar la calidad de cada entrega. Vacante ficticia para la demostración.",
  },
  {
    codigo: "RT-2026-103",
    titulo: "Diseñador/a UX (sin vincular)",
    area: "Producto",
    ciudad: "Remoto (Colombia)",
    modalidad: "Remoto",
    descripcion:
      "Vacante publicada en el portal pero SIN correspondencia con un proceso del ATS. Sirve para mostrar que el puente no adivina el proceso y responde JOB_POSTING_CLOSED. Vacante ficticia.",
  },
] as const;

/** Borra solo las filas marcadas demo = true (las tablas hijas caen en cascada) y vuelve a sembrar. */
export async function sembrarDemo(prisma: PrismaClient) {
  const codigosDemo = (await prisma.vacante.findMany({ where: { demo: true }, select: { codigo: true } })).map((v) => v.codigo);
  await prisma.$transaction([
    // Eventos de estado (sin postulación) de las vacantes demo que se van a borrar.
    prisma.outbox.deleteMany({ where: { postulacionId: null, vacanteCodigo: { in: codigosDemo } } }),
    prisma.vacante.deleteMany({ where: { demo: true } }),
    prisma.archivoCv.deleteMany({ where: { postulacion: null } }),
  ]);
  for (const v of VACANTES) {
    await prisma.vacante.create({ data: { ...v, estado: "PUBLICADA", publicadaEn: new Date() } });
  }
}

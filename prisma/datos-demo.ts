import type { PrismaClient } from "../src/generated/prisma/client";
import { etapasParaCrear } from "../src/modules/ats/etapas";

// Datos ficticios de la demostración. Las etapas vienen de src/modules/ats/etapas.ts (ATS de la empresa, 15/10/2026).

export const PROCESOS = [
  {
    id: 9001,
    nombre: "Desarrollador/a Backend Java",
    area: "Ingeniería",
    ciudad: "Medellín",
  },
  {
    id: 9002,
    nombre: "Analista de Calidad de Software (QA)",
    area: "Calidad",
    ciudad: "Medellín (híbrido)",
  },
] as const;

export const VACANTES = [
  {
    codigo: "RT-2026-101",
    titulo: "Desarrollador/a Backend Java",
    area: "Ingeniería",
    ciudad: "Medellín",
    modalidad: "Híbrido",
    descripcion:
      "Buscamos una persona para construir y mantener servicios backend en Java y Spring Boot. Trabajarás con PostgreSQL, pruebas automatizadas e integración continua en un equipo ágil. Vacante ficticia para la demostración.",
    procesoAtsId: 9001,
  },
  {
    codigo: "RT-2026-102",
    titulo: "Analista de Calidad de Software (QA)",
    area: "Calidad",
    ciudad: "Medellín",
    modalidad: "Híbrido",
    descripcion:
      "Diseñarás y ejecutarás pruebas funcionales y automatizadas, reportarás defectos y acompañarás al equipo de desarrollo para asegurar la calidad de cada entrega. Vacante ficticia para la demostración.",
    procesoAtsId: 9002,
  },
  {
    codigo: "RT-2026-103",
    titulo: "Diseñador/a UX (sin vincular)",
    area: "Producto",
    ciudad: "Remoto (Colombia)",
    modalidad: "Remoto",
    descripcion:
      "Vacante publicada en el portal pero SIN correspondencia con un proceso del ATS. Sirve para mostrar que el puente no adivina el proceso y responde JOB_POSTING_CLOSED. Vacante ficticia.",
    procesoAtsId: null,
  },
] as const;

/** Borra solo las filas marcadas demo = true (las tablas hijas caen en cascada) y vuelve a sembrar. */
export async function sembrarDemo(prisma: PrismaClient) {
  const codigosDemo = (await prisma.vacante.findMany({ where: { demo: true }, select: { codigo: true } })).map((v) => v.codigo);
  await prisma.$transaction([
    // Eventos de estado (sin postulación) de las vacantes demo que se van a borrar.
    prisma.outboxOrigen.deleteMany({ where: { postulacionId: null, vacanteCodigo: { in: codigosDemo } } }),
    prisma.vacante.deleteMany({ where: { demo: true } }),
    prisma.archivoCv.deleteMany({ where: { postulacion: null } }),
    prisma.recepcion.deleteMany({ where: { demo: true } }),
    prisma.entregaRechazada.deleteMany({ where: { demo: true } }),
    prisma.correspondencia.deleteMany({ where: { demo: true } }),
    prisma.candidato.deleteMany({ where: { demo: true } }),
    prisma.proceso.deleteMany({ where: { demo: true } }),
    prisma.claveIdempotencia.deleteMany({}),
    prisma.falloSimulado.deleteMany({}),
  ]);

  for (const p of PROCESOS) {
    await prisma.proceso.create({
      data: {
        id: p.id,
        nombre: p.nombre,
        area: p.area,
        ciudad: p.ciudad,
        etapas: { create: etapasParaCrear() },
      },
    });
  }
  for (const v of VACANTES) {
    await prisma.vacante.create({
      data: {
        codigo: v.codigo,
        titulo: v.titulo,
        area: v.area,
        ciudad: v.ciudad,
        modalidad: v.modalidad,
        descripcion: v.descripcion,
        estado: "PUBLICADA",
        publicadaEn: new Date(),
      },
    });
    if (v.procesoAtsId) {
      await prisma.correspondencia.create({
        data: { externalJobId: v.codigo, procesoAtsId: v.procesoAtsId, descripcion: `${v.titulo} → proceso ${v.procesoAtsId}` },
      });
    }
  }
}

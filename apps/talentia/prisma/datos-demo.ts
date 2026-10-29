import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import type { PrismaClient } from "../src/generated/prisma/client";
import { etapasParaCrear } from "../src/modules/etapas";
import { hashLlave } from "../src/modules/api/llaves";
import { CLAVE_DEMO, EMPRESA_DEMO, USUARIOS_DEMO } from "../src/modules/demo";

// Datos ficticios de Talentia para la empresa demo «Andina Software S.A.S.» (ficticia).
// Las etapas vienen de src/modules/etapas.ts (ATS de la empresa, 15/10/2026). Ningún nombre corresponde a personas reales.

export { CLAVE_DEMO, EMPRESA_DEMO, USUARIOS_DEMO };

export const PROCESOS = [
  { id: 9001, titulo: "Desarrollador/a Backend Java", prioridad: "Alta", dias: 10, area: "Ingeniería", ciudad: "Medellín" },
  { id: 9002, titulo: "Analista de Calidad de Software (QA)", prioridad: "Media", dias: 3, area: "Calidad", ciudad: "Medellín" },
  { id: 9003, titulo: "Desarrollador/a Frontend React", prioridad: "Alta", dias: 7, area: "Ingeniería", ciudad: "Bogotá" },
  { id: 9004, titulo: "Practicante de Desarrollo de Software", prioridad: "Media", dias: 14, area: "Ingeniería", ciudad: "Medellín" },
  { id: 9005, titulo: "Ingeniero/a DevOps", prioridad: "Baja", dias: 21, area: "Infraestructura", ciudad: "Remoto" },
  { id: 9006, titulo: "Diseñador/a UX/UI", prioridad: "Media", dias: 5, area: "Producto", ciudad: "Cali" },
] as const;

const DESCRIPCION = "Proceso ficticio de la demostración. Las postulaciones llegan solas desde Vínculo a través del puente.";

// 15 postulantes ficticios repartidos en etapas para que el tablero se vea vivo (proceso, orden de etapa).
const POSTULANTES: [string, string, number, number][] = [
  ["Daniela", "Cardona Mejía", 9001, 2],
  ["Santiago", "Vélez Arango", 9001, 3],
  ["Natalia", "Zuluaga Toro", 9001, 5],
  ["Andrés Felipe", "Quintero Ruiz", 9001, 6],
  ["Paula Andrea", "Londoño Gil", 9001, 1],
  ["Camilo", "Restrepo Duque", 9002, 2],
  ["Isabella", "Montoya Ríos", 9002, 4],
  ["Sebastián", "Giraldo Patiño", 9002, 1],
  ["Laura Sofía", "Agudelo Henao", 9003, 2],
  ["Mateo", "Salazar Osorio", 9003, 6],
  ["Valeria", "Correa Betancur", 9003, 7],
  ["Juan Pablo", "Echeverri Vargas", 9004, 1],
  ["Manuela", "Ospina Castaño", 9004, 3],
  ["Tomás", "Arbeláez Rendón", 9005, 2],
  ["Sara", "Jaramillo Uribe", 9006, 9],
];

const correoDe = (nombre: string, apellido: string) =>
  `${nombre.split(" ")[0]}.${apellido.split(" ")[0]}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase() + "@demo.test";

/** Borra solo las filas marcadas demo = true (las tablas hijas caen en cascada) y vuelve a sembrar. */
export async function sembrarDemo(prisma: PrismaClient) {
  await prisma.$transaction([
    prisma.postulante.deleteMany({ where: { demo: true } }),
    prisma.proceso.deleteMany({ where: { demo: true } }),
    prisma.apiKey.deleteMany({ where: { demo: true } }),
    prisma.user.deleteMany({ where: { demo: true } }),
  ]);

  const hash = await hashPassword(CLAVE_DEMO);
  for (const u of USUARIOS_DEMO) {
    const id = randomUUID();
    await prisma.user.create({
      data: { id, name: u.nombre, email: u.correo, emailVerified: true, rol: u.rol, accounts: { create: { id: randomUUID(), accountId: id, providerId: "credential", password: hash } } },
    });
  }

  for (const p of PROCESOS) {
    await prisma.proceso.create({
      data: {
        id: p.id,
        titulo: p.titulo,
        area: p.area,
        ciudad: p.ciudad,
        descripcion: DESCRIPCION,
        prioridad: p.prioridad,
        fechaInicio: new Date(Date.now() - p.dias * 86_400_000),
        etapas: { create: etapasParaCrear() },
      },
    });
  }

  for (const [i, [nombre, apellido, procesoId, orden]] of POSTULANTES.entries()) {
    const etapa = await prisma.etapa.findFirstOrThrow({ where: { procesoId, orden } });
    const primera = await prisma.etapa.findFirstOrThrow({ where: { procesoId, orden: 1 } });
    await prisma.postulante.create({
      data: {
        nombre,
        apellido,
        correo: correoDe(nombre, apellido),
        telefono: `+57300${String(1000000 + i * 7919).slice(0, 7)}`,
        ciudad: "Medellín",
        postulaciones: {
          create: {
            procesoId,
            etapaId: etapa.id,
            fuente: i % 3 === 0 ? "Referido interno" : "Portal simulado (tipo LinkedIn)",
            vista: true,
            creadaEn: new Date(Date.now() - (i + 2) * 86_400_000),
            historial: {
              create: [
                { tipo: "CREADA", aEtapa: primera.nombre, autor: "Carga inicial de la demostración" },
                ...(orden > 1 ? [{ tipo: "MOVIDA", deEtapa: primera.nombre, aEtapa: etapa.nombre, autor: USUARIOS_DEMO[1].nombre }] : []),
              ],
            },
          },
        },
      },
    });
  }

  // Transitorio (D-25): mientras el puente no reciba la llave por /conexiones, la siembra registra la que tiene en su .env.
  const semilla = process.env.TALENTIA_LLAVE_PUENTE;
  if (semilla) {
    await prisma.apiKey.create({ data: { nombre: "Puente (desarrollo local)", prefijo: "tal_semilla", hash: hashLlave(semilla), permisoLectura: true, permisoModificacion: true } });
  }
}

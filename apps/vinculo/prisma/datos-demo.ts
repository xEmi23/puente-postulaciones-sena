import { createHash, randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import type { PrismaClient } from "../src/generated/prisma/client";
import { aSlug } from "../src/modules/slugs";
import { CLAVE_DEMO, CUENTAS_DEMO } from "../src/modules/demo";
import { cvPdf, generarPersonas, type PersonaFicticia } from "./generador";

// Datos ficticios de Vínculo (ESPECIFICACION §5): 6 empresas (incluida «Andina Software S.A.S.»), 18 vacantes
// (6 de Andina) y 40 candidatos con perfil completo y CV en PDF. Todo marcado demo = true.

export const EMPRESAS = [
  { slug: "andina-software", nombre: "Andina Software S.A.S.", sector: "Desarrollo de software", ciudad: "Medellín", tamano: "201-500 empleados", color: "#0f766e", descripcion: "Empresa ficticia de desarrollo de software a la medida para clientes de banca, salud y logística. Equipos ágiles distribuidos en Colombia." },
  { slug: "nubeteca-analitica", nombre: "Nubeteca Analítica", sector: "Datos e inteligencia de negocio", ciudad: "Bogotá", tamano: "51-200 empleados", color: "#7c3aed", descripcion: "Empresa ficticia de analítica de datos y tableros para el sector comercio." },
  { slug: "ruta-kafe-logistica", nombre: "Ruta Kafé Logística", sector: "Logística y transporte", ciudad: "Pereira", tamano: "501-1000 empleados", color: "#b45309", descripcion: "Operador logístico ficticio del eje cafetero con flota propia y bodegas inteligentes." },
  { slug: "selva-digital-studio", nombre: "Selva Digital Studio", sector: "Diseño y producto digital", ciudad: "Cali", tamano: "11-50 empleados", color: "#15803d", descripcion: "Estudio ficticio de diseño de producto, experiencia de usuario y marcas digitales." },
  { slug: "altamira-salud", nombre: "Altamira Salud Integral", sector: "Salud", ciudad: "Medellín", tamano: "1001-5000 empleados", color: "#be123c", descripcion: "Red ficticia de clínicas y servicios de salud con equipos de tecnología propios." },
  { slug: "cumbre-energia", nombre: "Cumbre Energía Renovable", sector: "Energía", ciudad: "Barranquilla", tamano: "201-500 empleados", color: "#1d4ed8", descripcion: "Empresa ficticia de proyectos solares y eólicos en la región Caribe." },
] as const;

type Recepcion = "VINCULO" | "SITIO_EMPRESA";
const V = (empresa: string, titulo: string, ciudad: string, modalidad: string, nivel: string, recepcion: Recepcion, dias: number) => ({ empresa, titulo, ciudad, modalidad, nivel, recepcion, dias });

// Las 6 de Andina reciben con «Solicitud sencilla» sin integración: las postulaciones quedan en Vínculo y la
// reclutadora descarga cada CV a mano (lo que el puente elimina).
export const VACANTES = [
  V("andina-software", "Arquitecto/a de Soluciones", "Medellín", "HIBRIDO", "SENIOR", "VINCULO", 2),
  V("andina-software", "Scrum Master", "Medellín", "HIBRIDO", "SEMI_SENIOR", "VINCULO", 4),
  V("andina-software", "Ingeniero/a de Datos", "Bogotá", "REMOTO", "SEMI_SENIOR", "VINCULO", 6),
  V("andina-software", "Desarrollador/a Mobile Flutter", "Medellín", "PRESENCIAL", "JUNIOR", "VINCULO", 8),
  V("andina-software", "Analista de Soporte de Aplicaciones", "Envigado", "PRESENCIAL", "JUNIOR", "VINCULO", 9),
  V("andina-software", "Líder Técnico .NET", "Remoto", "REMOTO", "SENIOR", "VINCULO", 12),
  V("nubeteca-analitica", "Analista de Datos Junior", "Bogotá", "HIBRIDO", "JUNIOR", "VINCULO", 1),
  V("nubeteca-analitica", "Científico/a de Datos", "Bogotá", "REMOTO", "SENIOR", "SITIO_EMPRESA", 5),
  V("ruta-kafe-logistica", "Coordinador/a de Operaciones Logísticas", "Pereira", "PRESENCIAL", "SEMI_SENIOR", "SITIO_EMPRESA", 3),
  V("ruta-kafe-logistica", "Desarrollador/a Backend Node.js", "Pereira", "HIBRIDO", "SEMI_SENIOR", "VINCULO", 7),
  V("selva-digital-studio", "Diseñador/a UX/UI", "Cali", "REMOTO", "SEMI_SENIOR", "VINCULO", 2),
  V("selva-digital-studio", "Practicante de Diseño Gráfico", "Cali", "PRESENCIAL", "PRACTICANTE", "SITIO_EMPRESA", 10),
  V("altamira-salud", "Analista de Calidad de Software (QA)", "Medellín", "HIBRIDO", "JUNIOR", "VINCULO", 3),
  V("altamira-salud", "Ingeniero/a de Seguridad de la Información", "Medellín", "PRESENCIAL", "SENIOR", "SITIO_EMPRESA", 11),
  V("altamira-salud", "Desarrollador/a Full Stack", "Rionegro", "HIBRIDO", "SEMI_SENIOR", "VINCULO", 13),
  V("cumbre-energia", "Ingeniero/a DevOps", "Barranquilla", "REMOTO", "SEMI_SENIOR", "VINCULO", 4),
  V("cumbre-energia", "Analista de Proyectos Solares", "Barranquilla", "PRESENCIAL", "JUNIOR", "SITIO_EMPRESA", 6),
  V("cumbre-energia", "Practicante de Ingeniería de Sistemas", "Barranquilla", "HIBRIDO", "PRACTICANTE", "VINCULO", 14),
] as const;

const descripcion = (titulo: string, empresa: string) =>
  `En ${empresa} buscamos una persona para el cargo de ${titulo}. Trabajarás con un equipo colaborativo, con objetivos claros y espacio para aprender. ` +
  "Ofrecemos contrato a término indefinido, horario flexible y plan de formación. Vacante ficticia de la demostración: no corresponde a una oferta real.";

/** Borra solo lo marcado como demo (las tablas hijas caen en cascada) y vuelve a sembrar. */
export async function sembrarDemo(prisma: PrismaClient) {
  await prisma.$transaction([
    prisma.user.deleteMany({ where: { demo: true } }),
    prisma.empresa.deleteMany({ where: { demo: true } }),
  ]);
  await prisma.archivoCv.deleteMany({ where: { postulacion: null, perfil: null } });

  const empresas = new Map<string, string>();
  for (const e of EMPRESAS) {
    const fila = await prisma.empresa.create({ data: { ...e, sitioWeb: `https://${e.slug}.test/empleos` } });
    empresas.set(e.slug, fila.id);
  }
  const andina = empresas.get("andina-software")!;
  const hash = await hashPassword(CLAVE_DEMO);
  const crearUsuario = async (nombre: string, correo: string, rol: "CANDIDATO" | "RECLUTADOR", empresaId: string | null = null) => {
    const id = randomUUID();
    await prisma.user.create({
      data: { id, name: nombre, email: correo, emailVerified: true, rol, empresaId, demo: true, accounts: { create: { id: randomUUID(), accountId: id, providerId: "credential", password: hash } } },
    });
    return id;
  };

  const reclutadora = await crearUsuario("Lucía Fernanda Cárdenas", CUENTAS_DEMO[2].correo, "RECLUTADOR", andina);
  await prisma.perfil.create({ data: { userId: reclutadora, slug: "lucia-cardenas-andina", titular: "Líder de atracción de talento en Andina Software S.A.S.", ciudad: "Medellín", acercaDe: "Perfil ficticio de demostración.", habilidades: ["Reclutamiento", "Entrevistas", "Marca empleadora"] } });

  // 40 candidatos: las 2 cuentas de demostración (nombres fijos) y 38 generados.
  const personas = generarPersonas(38);
  const fijas: PersonaFicticia[] = [
    { ...generarPersonas(1, 7)[0], nombre: "Valentina", apellido: "Ríos Gaviria", correo: CUENTAS_DEMO[0].correo, ciudad: "Medellín", titular: "Desarrolladora frontend React y TypeScript", habilidades: ["React", "TypeScript", "Next.js", "Accesibilidad web", "Pruebas"] },
    { ...generarPersonas(1, 11)[0], nombre: "Santiago", apellido: "Mejía Toro", correo: CUENTAS_DEMO[1].correo, ciudad: "Envigado", titular: "Desarrollador backend Java y Spring Boot", habilidades: ["Java", "Spring Boot", "PostgreSQL", "Docker", "Git"] },
  ];
  const candidatos: string[] = [];
  for (const p of [...fijas, ...personas]) {
    const id = await crearUsuario(`${p.nombre} ${p.apellido}`, p.correo, "CANDIDATO");
    const pdf = await cvPdf(p);
    const cv = await prisma.archivoCv.create({
      data: { nombreArchivo: `cv-${aSlug(`${p.nombre} ${p.apellido}`)}.pdf`, mime: "application/pdf", tamano: pdf.length, sha256: createHash("sha256").update(pdf).digest("hex"), contenido: Buffer.from(pdf) },
    });
    let slug = aSlug(`${p.nombre} ${p.apellido}`);
    if (await prisma.perfil.findUnique({ where: { slug } })) slug = `${slug}-${candidatos.length + 1}`;
    await prisma.perfil.create({
      data: {
        userId: id,
        slug,
        titular: p.titular,
        ciudad: p.ciudad,
        telefono: p.telefono,
        acercaDe: p.acercaDe,
        habilidades: p.habilidades,
        cvId: cv.id,
        experiencia: { create: p.experiencia.map((e, i) => ({ ...e, orden: i })) },
        educacion: { create: p.educacion.map((e, i) => ({ ...e, orden: i })) },
      },
    });
    candidatos.push(id);
  }

  const año = new Date().getFullYear();
  const vacantesAndina: string[] = [];
  for (const [i, v] of VACANTES.entries()) {
    const empresa = EMPRESAS.find((e) => e.slug === v.empresa)!;
    const fila = await prisma.vacante.create({
      data: {
        empresaId: empresas.get(v.empresa)!,
        externalJobId: `VIN-${año}-${String(i + 1).padStart(4, "0")}`,
        titulo: v.titulo,
        descripcion: descripcion(v.titulo, empresa.nombre),
        ciudad: v.ciudad,
        modalidad: v.modalidad,
        nivel: v.nivel,
        tipoEmpleo: v.nivel === "PRACTICANTE" ? "PRACTICA" : "TIEMPO_COMPLETO",
        solicitudSencilla: v.recepcion === "VINCULO",
        urlEmpresa: `https://${v.empresa}.test/empleos`,
        estado: "PUBLICADA",
        publicadaEn: new Date(Date.now() - v.dias * 86_400_000),
      },
    });
    if (v.empresa === "andina-software") vacantesAndina.push(fila.id);
  }

  // Postulaciones ya recibidas en las vacantes de Andina (quedan en Vínculo: la reclutadora las descarga a mano).
  for (let i = 0; i < 12; i++) {
    const candidatoId = candidatos[2 + i];
    const vacanteId = vacantesAndina[i % vacantesAndina.length];
    const perfil = await prisma.perfil.findUniqueOrThrow({ where: { userId: candidatoId }, include: { cv: true, user: true } });
    const [nombre, ...resto] = perfil.user.name.split(" ");
    const copia = await prisma.archivoCv.create({
      data: { nombreArchivo: perfil.cv!.nombreArchivo, mime: "application/pdf", tamano: perfil.cv!.tamano, sha256: perfil.cv!.sha256, contenido: perfil.cv!.contenido, mediaUrn: `urn:li:media:${randomUUID()}`, expiraEn: new Date(Date.now() + 30 * 86_400_000) },
    });
    await prisma.postulacion.create({
      data: {
        jobApplicationId: `urn:li:jobApplication:${7_000_000_000 + i}`,
        vacanteId,
        candidatoId,
        nombre,
        apellido: resto.join(" "),
        correo: perfil.user.email,
        telefono: perfil.telefono,
        ciudad: perfil.ciudad,
        archivoCvId: copia.id,
        estado: i % 4 === 0 ? "VISTA" : "ENVIADA",
        vistaEn: i % 4 === 0 ? new Date() : null,
        aplicadaEn: new Date(Date.now() - (i + 1) * 3_600_000 * 7),
        demo: true,
      },
    });
  }

}

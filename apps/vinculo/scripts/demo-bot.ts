import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "../src/lib/db";
import { aSlug } from "../src/modules/slugs";
import { CLAVE_DEMO } from "../src/modules/demo";
import { cvPdf, generarPersonas, type PersonaFicticia } from "../prisma/generador";

// Parte de Vínculo de `npm run demo:bot`: una vacante de Andina Software S.A.S. (ficticia) que recibe con «Solicitud
// sencilla» SIN ATS conectado (las solicitudes quedan en Vínculo, como hoy en LinkedIn) y 3 postulaciones nuevas de
// personas ficticias con su CV en PDF. Es lo que el bot del Puente recorre desde el panel del reclutador.
//   (sin argumentos) → crea lo que falte · --reiniciar → borra las 3 postulaciones y las vuelve a crear
// Imprime JSON: { vacanteId, externalJobId, titulo }.

export const CODIGO_VACANTE = "VIN-DEMO-BOT";
const TITULO = "Analista de Integraciones (demo del bot)";

const PERSONAS: Pick<PersonaFicticia, "nombre" | "apellido" | "correo" | "telefono" | "ciudad" | "titular">[] = [
  { nombre: "Mariana", apellido: "Quintero Ficticia", correo: "mariana.quintero.bot@demo.test", telefono: "+573005550111", ciudad: "Medellín", titular: "Analista de integraciones y APIs" },
  { nombre: "Julián", apellido: "Restrepo Ficticio", correo: "julian.restrepo.bot@demo.test", telefono: "+573015550222", ciudad: "Bello", titular: "Desarrollador backend Node.js" },
  { nombre: "Sofía", apellido: "Cardona Ficticia", correo: "sofia.cardona.bot@demo.test", telefono: "+573025550333", ciudad: "Envigado", titular: "Ingeniera de datos junior" },
];

async function main() {
  const reiniciar = process.argv.includes("--reiniciar");
  const andina = await prisma.empresa.findUnique({ where: { slug: "andina-software" } });
  if (!andina) throw new Error("No existe la empresa demo «andina-software»: ejecuta npm run db:seed (o demo:reset) en el Simulador LinkedIn.");

  let vacante = await prisma.vacante.findFirst({ where: { empresaId: andina.id, externalJobId: CODIGO_VACANTE } });
  if (!vacante) {
    vacante = await prisma.vacante.create({
      data: {
        empresaId: andina.id,
        externalJobId: CODIGO_VACANTE,
        titulo: TITULO,
        descripcion:
          "Buscamos una persona para conectar sistemas por API y automatizar procesos de selección. Vacante ficticia de la demostración del bot del Puente: no corresponde a una oferta real.",
        ciudad: "Medellín",
        modalidad: "HIBRIDO",
        nivel: "SEMI_SENIOR",
        tipoEmpleo: "TIEMPO_COMPLETO",
        solicitudSencilla: true,
        urlEmpresa: "https://andina-software.test/empleos",
        estado: "PUBLICADA",
        publicadaEn: new Date(),
        demo: true,
      },
    });
  } else if (vacante.estado !== "PUBLICADA") {
    vacante = await prisma.vacante.update({ where: { id: vacante.id }, data: { estado: "PUBLICADA", cerradaEn: null } });
  }

  if (reiniciar) {
    const viejas = await prisma.postulacion.findMany({ where: { vacanteId: vacante.id }, select: { archivoCvId: true } });
    await prisma.postulacion.deleteMany({ where: { vacanteId: vacante.id } });
    await prisma.archivoCv.deleteMany({ where: { id: { in: viejas.map((v) => v.archivoCvId) } } });
  }

  const hash = await hashPassword(CLAVE_DEMO);
  const base = generarPersonas(PERSONAS.length, 4242);
  for (const [i, datos] of PERSONAS.entries()) {
    const persona: PersonaFicticia = { ...base[i], ...datos };
    let usuario = await prisma.user.findUnique({ where: { email: persona.correo } });
    if (!usuario) {
      const id = randomUUID();
      usuario = await prisma.user.create({
        data: {
          id,
          name: `${persona.nombre} ${persona.apellido}`,
          email: persona.correo,
          emailVerified: true,
          rol: "CANDIDATO",
          demo: true,
          accounts: { create: { id: randomUUID(), accountId: id, providerId: "credential", password: hash } },
        },
      });
      await prisma.perfil.create({
        data: { userId: id, slug: `${aSlug(`${persona.nombre} ${persona.apellido}`)}-bot`, titular: persona.titular, ciudad: persona.ciudad, telefono: persona.telefono, acercaDe: persona.acercaDe, habilidades: persona.habilidades },
      });
    }
    if (await prisma.postulacion.findFirst({ where: { vacanteId: vacante.id, candidatoId: usuario.id } })) continue;
    const pdf = await cvPdf(persona);
    const copia = await prisma.archivoCv.create({
      data: {
        nombreArchivo: `cv-${aSlug(`${persona.nombre} ${persona.apellido}`)}.pdf`,
        mime: "application/pdf",
        tamano: pdf.length,
        sha256: createHash("sha256").update(pdf).digest("hex"),
        contenido: Buffer.from(pdf),
        mediaUrn: `urn:li:media:${randomUUID()}`,
        expiraEn: new Date(Date.now() + 30 * 86_400_000),
      },
    });
    await prisma.postulacion.create({
      data: {
        jobApplicationId: `urn:li:jobApplication:${Date.now()}${i}`,
        vacanteId: vacante.id,
        candidatoId: usuario.id,
        nombre: persona.nombre,
        apellido: persona.apellido,
        correo: persona.correo,
        telefono: persona.telefono,
        ciudad: persona.ciudad,
        archivoCvId: copia.id,
        aplicadaEn: new Date(Date.now() - (PERSONAS.length - i) * 60_000),
        demo: true,
      },
    });
  }
  process.stdout.write(JSON.stringify({ vacanteId: vacante.id, externalJobId: vacante.externalJobId, titulo: vacante.titulo }));
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

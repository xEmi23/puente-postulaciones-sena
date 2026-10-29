import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { sembrarDemo } from "../prisma/datos-demo";
import { crearPostulacion } from "@/modules/postulacion";
import * as media from "@/app/api/origen/media/[id]/route";

export { prisma };

/** Vacía el esquema de Vínculo y siembra los datos de demostración. */
export async function reiniciarBd() {
  await prisma.$executeRawUnsafe(`TRUNCATE "IntentoEntrega", "Outbox", "Postulacion", "ArchivoCv", "Vacante" CASCADE`);
  await sembrarDemo(prisma);
}

export function leerCv(nombre = "cv-camila-ejemplo.pdf"): Uint8Array {
  return new Uint8Array(readFileSync(path.resolve(__dirname, "../../../fixtures/cv", nombre)));
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

/** Crea una postulación en Vínculo y devuelve su id. */
export async function postularEnOrigen(codigo = "RT-2026-101", datos = datosPersona, cv = "cv-camila-ejemplo.pdf") {
  const v = await vacante(codigo);
  const r = await crearPostulacion(v.id, datos, { nombre: cv, bytes: leerCv(cv) });
  if (!r.ok) throw new Error(`Postulación inválida: ${JSON.stringify(r.errores)}`);
  return r;
}

/** fetch que resuelve http://vinculo.test/* con las rutas reales de Vínculo, sin red. */
export const fetchEnProceso: typeof fetch = async (entrada, init) => {
  const req = new Request(entrada, init);
  const url = new URL(req.url);
  if (url.host !== "vinculo.test") throw new TypeError(`fetch a host no permitido en pruebas: ${url.host}`);
  const m = url.pathname.match(/^\/api\/origen\/media\/([^/]+)$/);
  if (m) return media.GET(req, { params: Promise.resolve({ id: m[1] }) });
  return new Response("No encontrado", { status: 404 });
};

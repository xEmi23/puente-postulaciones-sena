import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { sembrarDemo } from "../prisma/datos-demo";
import * as candidatos from "@/app/api/ats/v1/candidatos/route";
import * as documentos from "@/app/api/ats/v1/candidatos/[id]/documentos/route";
import * as postulaciones from "@/app/api/ats/v1/postulaciones/route";
import * as procesos from "@/app/api/ats/v1/procesos/route";

export { prisma };

/** Vacía el esquema de Talentia y siembra los datos de demostración. */
export async function reiniciarBd() {
  await prisma.$executeRawUnsafe(`TRUNCATE "Postulacion", "Documento", "Candidato", "Etapa", "Proceso", "ClaveIdempotencia" CASCADE`);
  await sembrarDemo(prisma);
}

export function leerCv(nombre = "cv-camila-ejemplo.pdf"): Uint8Array {
  return new Uint8Array(readFileSync(path.resolve(__dirname, "../../../fixtures/cv", nombre)));
}

const params = <T>(p: T) => ({ params: Promise.resolve(p) });

/** fetch que resuelve http://talentia.test/* con las rutas reales de la API de Talentia, sin red. */
export const fetchEnProceso: typeof fetch = async (entrada, init) => {
  const req = new Request(entrada, init);
  const url = new URL(req.url);
  if (url.host !== "talentia.test") throw new TypeError(`fetch a host no permitido en pruebas: ${url.host}`);
  const ruta = url.pathname;
  let m: RegExpMatchArray | null;
  if (ruta === "/api/ats/v1/candidatos") return candidatos.POST(req);
  if ((m = ruta.match(/^\/api\/ats\/v1\/candidatos\/([^/]+)\/documentos$/))) return documentos.POST(req, params({ id: m[1] }));
  if (ruta === "/api/ats/v1/postulaciones") return req.method === "GET" ? postulaciones.GET(req) : postulaciones.POST(req);
  if (ruta === "/api/ats/v1/procesos") return procesos.GET(req);
  return new Response("No encontrado", { status: 404 });
};

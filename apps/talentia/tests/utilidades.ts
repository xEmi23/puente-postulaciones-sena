import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { sembrarDemo } from "../prisma/datos-demo";
import { crearApiKey } from "@/modules/api/llaves";
import * as procesos from "@/app/api/v1/seleccion/procesos/route";
import * as proceso from "@/app/api/v1/seleccion/procesos/[id]/route";
import * as postulantes from "@/app/api/v1/seleccion/postulantes/route";
import * as postulante from "@/app/api/v1/seleccion/postulantes/[id]/route";
import * as documentos from "@/app/api/v1/seleccion/postulantes/[id]/documentos/route";
import * as postulaciones from "@/app/api/v1/seleccion/postulaciones/route";
import * as postulacion from "@/app/api/v1/seleccion/postulaciones/[id]/route";
import * as llaveActual from "@/app/api/v1/api-key/route";
import * as openapi from "@/app/api/openapi.json/route";

export { prisma };

/** Vacía el esquema de Talentia y siembra los datos de demostración. */
export async function reiniciarBd() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE "MovimientoEtapa", "Postulacion", "Documento", "Postulante", "Etapa", "Proceso", "ClaveIdempotencia", "LimiteTasa", "ActividadApi", "ApiKey", "Session", "Account", "Verification", "User" CASCADE`,
  );
  await sembrarDemo(prisma);
}

export function leerCv(nombre = "cv-camila-ejemplo.pdf"): Uint8Array {
  return new Uint8Array(readFileSync(path.resolve(__dirname, "../../../fixtures/cv", nombre)));
}

/** Crea una API Key con los permisos indicados y devuelve la llave completa (solo existe en este momento). */
export async function nuevaLlave(permisos: { lectura?: boolean; modificacion?: boolean } = { lectura: true, modificacion: true }) {
  const r = await crearApiKey({ nombre: "Llave de prueba", lectura: permisos.lectura ?? false, modificacion: permisos.modificacion ?? false }, null);
  if (!r.ok) throw new Error(r.error);
  return r.llave;
}

type Modulo = Record<string, (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response> | Response>;
const RUTAS: [RegExp, Modulo][] = [
  [/^\/api\/v1\/seleccion\/procesos$/, procesos as unknown as Modulo],
  [/^\/api\/v1\/seleccion\/procesos\/(?<id>[^/]+)$/, proceso as unknown as Modulo],
  [/^\/api\/v1\/seleccion\/postulantes$/, postulantes as unknown as Modulo],
  [/^\/api\/v1\/seleccion\/postulantes\/(?<id>[^/]+)$/, postulante as unknown as Modulo],
  [/^\/api\/v1\/seleccion\/postulantes\/(?<id>[^/]+)\/documentos$/, documentos as unknown as Modulo],
  [/^\/api\/v1\/seleccion\/postulaciones$/, postulaciones as unknown as Modulo],
  [/^\/api\/v1\/seleccion\/postulaciones\/(?<id>[^/]+)$/, postulacion as unknown as Modulo],
  [/^\/api\/v1\/api-key$/, llaveActual as unknown as Modulo],
  [/^\/api\/openapi\.json$/, openapi as unknown as unknown as Modulo],
];

/** fetch que resuelve http://talentia.test/* con las rutas reales de la API de Talentia, sin red. */
export const fetchEnProceso: typeof fetch = async (entrada, init) => {
  const req = new Request(entrada, init);
  const url = new URL(req.url);
  if (url.host !== "talentia.test") throw new TypeError(`fetch a host no permitido en pruebas: ${url.host}`);
  for (const [patron, modulo] of RUTAS) {
    const m = url.pathname.match(patron);
    if (!m) continue;
    const manejador = modulo[req.method];
    if (!manejador) return new Response(null, { status: 405 });
    return manejador(req, { params: Promise.resolve({ ...(m.groups ?? {}) }) });
  }
  return new Response("No encontrado", { status: 404 });
};

/** Llamada JSON a la API con la llave indicada. */
export async function api(metodo: string, ruta: string, llave: string | null, cuerpo?: unknown, extra: Record<string, string> = {}) {
  const headers: Record<string, string> = { Accept: "application/json", ...extra };
  if (llave) headers.auth_token = llave;
  let body: BodyInit | undefined;
  if (cuerpo instanceof FormData) body = cuerpo;
  else if (cuerpo !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(cuerpo);
  }
  const r = await fetchEnProceso(`http://talentia.test${ruta}`, { method: metodo, headers, body });
  const texto = await r.text();
  return { status: r.status, headers: r.headers, body: texto ? JSON.parse(texto) : null };
}

export function formularioCv(bytes: Uint8Array, sha256: string, nombre = "cv.pdf") {
  const f = new FormData();
  f.set("archivo", new File([bytes.slice()], nombre, { type: "application/pdf" }));
  f.set("sha256", sha256);
  f.set("tipo", "CV");
  return f;
}

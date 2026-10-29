import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { sembrarDemo } from "../prisma/datos-demo";
import { crearAplicacion, autorizarAplicacion } from "@/modules/aplicaciones";
import { enviarSolicitud } from "@/modules/postulacion";
import * as token from "@/app/oauth/v2/accessToken/route";
import * as jobPostings from "@/app/api/v1/jobPostings/route";
import * as cerrar from "@/app/api/v1/jobPostings/[externalJobId]/close/route";
import * as autorizaciones from "@/app/api/v1/autorizaciones/route";
import * as media from "@/app/api/v1/media/[id]/route";
import * as lifecycle from "@/app/api/v1/jobApplications/[jobApplicationId]/lifecycle/route";
import * as openapi from "@/app/api/openapi.json/route";

export { prisma };

/** Vacía el esquema de Vínculo y siembra los datos de demostración. */
export async function reiniciarBd() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE "IntentoEntrega", "Outbox", "Postulacion", "AutorizacionEmpresa", "AplicacionDev", "Vacante", "Experiencia", "Educacion", "Perfil", "ArchivoCv", "Empresa", "Session", "Account", "Verification", "User" CASCADE`,
  );
  await sembrarDemo(prisma);
}

export function leerCv(nombre = "cv-camila-ejemplo.pdf"): Uint8Array {
  return new Uint8Array(readFileSync(path.resolve(__dirname, "../../../fixtures/cv", nombre)));
}

type Modulo = Record<string, (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response> | Response>;
const RUTAS: [RegExp, Modulo][] = [
  [/^\/oauth\/v2\/accessToken$/, token as unknown as Modulo],
  [/^\/api\/v1\/jobPostings$/, jobPostings as unknown as Modulo],
  [/^\/api\/v1\/jobPostings\/(?<externalJobId>[^/]+)\/close$/, cerrar as unknown as Modulo],
  [/^\/api\/v1\/autorizaciones$/, autorizaciones as unknown as Modulo],
  [/^\/api\/v1\/media\/(?<id>[^/]+)$/, media as unknown as Modulo],
  [/^\/api\/v1\/jobApplications\/(?<jobApplicationId>[^/]+)\/lifecycle$/, lifecycle as unknown as Modulo],
  [/^\/api\/openapi\.json$/, openapi as unknown as Modulo],
];

/** Webhook de integrador falso: responde el desafío con el secreto indicado y registra las entregas. */
export class WebhookDoble {
  entregas: { cuerpo: string; firma: string | null }[] = [];
  desafios = 0;
  respuestas: number[] = [];
  constructor(
    public url: string,
    public secreto: () => string,
  ) {}
  async atender(req: Request): Promise<Response> {
    const u = new URL(req.url);
    if (req.method === "GET") {
      this.desafios++;
      const code = u.searchParams.get("challengeCode") ?? "";
      return Response.json({ challengeCode: code, challengeResponse: createHmac("sha256", this.secreto()).update(code).digest("hex") });
    }
    this.entregas.push({ cuerpo: await req.text(), firma: req.headers.get("x-li-signature") });
    const status = this.respuestas.shift() ?? 200;
    return Response.json(status === 200 ? { estado: "RECIBIDO" } : { errors: [{ errorCode: "TRANSIENT_ERROR" }] }, { status });
  }
}

export const webhooks = new Map<string, WebhookDoble>();

/** fetch sin red: vinculo.test → rutas reales de Vínculo; integrador.test → webhooks dobles registrados. */
export const fetchEnProceso: typeof fetch = async (entrada, init) => {
  const req = new Request(entrada, init);
  const url = new URL(req.url);
  if (url.host === "integrador.test") {
    const w = webhooks.get(url.origin + url.pathname);
    return w ? w.atender(req) : new Response("No existe", { status: 404 });
  }
  if (url.host !== "vinculo.test") throw new TypeError(`fetch a host no permitido en pruebas: ${url.host}`);
  for (const [patron, modulo] of RUTAS) {
    const m = url.pathname.match(patron);
    if (!m) continue;
    const manejador = modulo[req.method];
    if (!manejador) return new Response(null, { status: 405 });
    return manejador(req, { params: Promise.resolve({ ...(m.groups ?? {}) }) });
  }
  return new Response("No encontrado", { status: 404 });
};

export const empresaAndina = () => prisma.empresa.findUniqueOrThrow({ where: { slug: "andina-software" } });
export const reclutadora = () => prisma.user.findUniqueOrThrow({ where: { email: "reclutadora@andina.demo.test" } });
export const candidata = () => prisma.user.findUniqueOrThrow({ where: { email: "valentina.rios@demo.test" } });

/** Aplicación de integrador con webhook doble, autorizada (o no) por Andina. Devuelve credenciales y el webhook. */
export async function aplicacionIntegrador(opciones: { autorizar?: boolean; ruta?: string } = {}) {
  const r = await reclutadora();
  const urlWebhook = `http://integrador.test${opciones.ruta ?? `/webhook/${randomUUID()}`}`;
  const creada = await crearAplicacion(r.id, { nombre: "ATS de prueba" });
  if (!creada.ok) throw new Error(creada.error);
  const w = new WebhookDoble(urlWebhook, () => creada.clientSecret);
  webhooks.set(urlWebhook, w);
  if (opciones.autorizar !== false) await autorizarAplicacion((await empresaAndina()).id, creada.app.clientId, r.id);
  return { app: creada.app, clientId: creada.app.clientId, clientSecret: creada.clientSecret, webhook: w };
}

export async function pedirToken(clientId: string, clientSecret: string) {
  const r = await fetchEnProceso("http://vinculo.test/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }).toString(),
  });
  return { status: r.status, body: await r.json() };
}

export async function api(metodo: string, ruta: string, bearer: string | null, cuerpo?: unknown) {
  const headers: Record<string, string> = {};
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  if (cuerpo !== undefined) headers["Content-Type"] = "application/json";
  const r = await fetchEnProceso(`http://vinculo.test${ruta}`, { method: metodo, headers, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
  const tipo = r.headers.get("content-type") ?? "";
  return { status: r.status, headers: r.headers, body: tipo.includes("json") ? await r.json() : new Uint8Array(await r.arrayBuffer()) };
}

/** Publica por API una vacante de Andina con Solicitud sencilla hacia el webhook de la aplicación. */
export async function publicarVacante(int: Awaited<ReturnType<typeof aplicacionIntegrador>>, externalJobId = "9001") {
  const { body: t } = await pedirToken(int.clientId, int.clientSecret);
  const r = await api("POST", "/api/v1/jobPostings", t.access_token, {
    externalJobId,
    companyId: (await empresaAndina()).id,
    title: "Desarrollador/a Backend Java",
    description: "Servicios backend en Java y Spring Boot. Vacante ficticia de pruebas.",
    location: "Medellín",
    workplaceType: "HYBRID",
    onsiteApply: { jobApplicationWebhookUrl: int.webhook.url },
  });
  return { token: t.access_token as string, respuesta: r };
}

export const contacto = { nombre: "Valentina", apellido: "Ríos Gaviria", correo: "valentina.rios@demo.test", telefono: "3001112233", ciudad: "Medellín" };

/** La candidata de demostración envía una Solicitud sencilla con un CV nuevo. */
export async function solicitar(vacanteId: string, cv = "cv-camila-ejemplo.pdf") {
  const u = await candidata();
  const r = await enviarSolicitud(u.id, vacanteId, contacto, { archivo: { nombre: cv, bytes: leerCv(cv) } });
  if (!r.ok) throw new Error(JSON.stringify(r.errores));
  return r;
}

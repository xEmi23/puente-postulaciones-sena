import * as webhook from "@/app/api/puente/webhook/route";
import * as media from "@/app/api/origen/media/[id]/route";
import * as candidatos from "@/app/api/ats/v1/candidatos/route";
import * as documentos from "@/app/api/ats/v1/candidatos/[id]/documentos/route";
import * as postulaciones from "@/app/api/ats/v1/postulaciones/route";
import * as procesos from "@/app/api/ats/v1/procesos/route";

// fetch que resuelve http://app.test/* llamando a los route handlers reales de Next.js, sin red.
// Permite probar el recorrido completo (origen → puente → ATS) con PostgreSQL real.

const params = <T>(p: T) => ({ params: Promise.resolve(p) });

export const fetchEnProceso: typeof fetch = async (entrada, init) => {
  const req = new Request(entrada, init);
  // Igual que un fetch real: si la señal se aborta (timeout), la llamada se rechaza aunque el servidor siga trabajando.
  const senal = init?.signal;
  if (!senal) return despachar(req);
  if (senal.aborted) throw senal.reason;
  return Promise.race([
    despachar(req),
    new Promise<never>((_, rechazar) => senal.addEventListener("abort", () => rechazar(senal.reason), { once: true })),
  ]);
};

async function despachar(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (url.host !== "app.test") throw new TypeError(`fetch a host no permitido en pruebas: ${url.host}`);
  const ruta = url.pathname;
  let m: RegExpMatchArray | null;

  if (ruta === "/api/puente/webhook") return req.method === "GET" ? webhook.GET(req) : webhook.POST(req);
  if ((m = ruta.match(/^\/api\/origen\/media\/([^/]+)$/))) return media.GET(req, params({ id: m[1] }));
  if (ruta === "/api/ats/v1/candidatos") return candidatos.POST(req);
  if ((m = ruta.match(/^\/api\/ats\/v1\/candidatos\/([^/]+)\/documentos$/))) return documentos.POST(req, params({ id: m[1] }));
  if (ruta === "/api/ats/v1/postulaciones") return req.method === "GET" ? postulaciones.GET(req) : postulaciones.POST(req);
  if (ruta === "/api/ats/v1/procesos") return procesos.GET(req);
  return new Response("No encontrado", { status: 404 });
}

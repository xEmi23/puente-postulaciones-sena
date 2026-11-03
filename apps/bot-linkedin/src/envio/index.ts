import type { CanonicaSinFuente } from "../mapeo";
import type { Reloj } from "../navegacion/pausas";
import { relojReal } from "../navegacion/pausas";

// Envío al Puente por la entrada genérica (POST /api/entradas/v1/postulaciones, multipart `datos` + `cv`) con el token
// de la fuente. Reintenta errores de red, 5xx y 429 con espera creciente hasta cubrir ~90 s (arranque en frío de
// Render). Los 4xx de contenido (400, 401, 413, 415, 422) no se reintentan: se informan.

export type EstadoEnvio = "RECIBIDA" | "REQUIERE_REVISION" | "DUPLICADA" | "RECHAZADA" | "ERROR";

export interface ResultadoEnvio {
  estado: EstadoEnvio;
  status: number;
  detalle: string;
}

export interface OpcionesEnvio {
  puenteUrl: string;
  token: string;
  fetchImpl?: typeof fetch;
  reloj?: Reloj;
  /** Esperas entre intentos (ms). Por defecto suman ~120 s. */
  esperas?: number[];
}

const ESPERAS = [2000, 4000, 8000, 16000, 30000, 30000, 30000];

async function conReintentos(o: OpcionesEnvio, pedir: () => Promise<Response>): Promise<Response> {
  const reloj = o.reloj ?? relojReal;
  const esperas = o.esperas ?? ESPERAS;
  let ultimo: unknown;
  for (let i = 0; i <= esperas.length; i++) {
    try {
      const r = await pedir();
      if (r.status < 500 && r.status !== 429) return r;
      ultimo = new Error(`el Puente respondió ${r.status}`);
      if (i === esperas.length) return r;
      const retry = Number(r.headers.get("retry-after"));
      await reloj.dormir(Number.isFinite(retry) && retry > 0 ? retry * 1000 : esperas[i]);
    } catch (e) {
      ultimo = e;
      if (i === esperas.length) break;
      await reloj.dormir(esperas[i]);
    }
  }
  throw new Error(`No se pudo contactar al Puente (${o.puenteUrl}): ${ultimo instanceof Error ? ultimo.message : ultimo}`);
}

const autorizacion = (token: string) => ({ authorization: `Bearer ${token}` });

/** Vacantes vinculadas a la fuente del token (el bot solo recorre estas). */
export async function vacantesPermitidas(o: OpcionesEnvio): Promise<string[]> {
  const f = o.fetchImpl ?? fetch;
  const r = await conReintentos(o, () => f(`${o.puenteUrl}/api/entradas/v1/vacantes`, { headers: autorizacion(o.token) }));
  if (r.status === 401) throw new Error("El Puente rechazó el token de la fuente (401). Genera uno nuevo en Puente → Fuentes y ponlo en PUENTE_BOT_TOKEN.");
  if (!r.ok) throw new Error(`El Puente respondió ${r.status} al listar las vacantes de la fuente.`);
  const cuerpo = (await r.json()) as { vacantes: { vacanteExterna: string }[] };
  return cuerpo.vacantes.map((v) => v.vacanteExterna);
}

export async function enviarPostulacion(o: OpcionesEnvio, datos: CanonicaSinFuente, cv: { bytes: Uint8Array; nombreArchivo: string } | null): Promise<ResultadoEnvio> {
  const f = o.fetchImpl ?? fetch;
  const r = await conReintentos(o, () => {
    const fd = new FormData();
    fd.set("datos", JSON.stringify(datos));
    if (cv) fd.set("cv", new Blob([cv.bytes.slice()], { type: "application/pdf" }), cv.nombreArchivo);
    return f(`${o.puenteUrl}/api/entradas/v1/postulaciones`, { method: "POST", headers: autorizacion(o.token), body: fd });
  });
  let cuerpo: { estado?: string; mensaje?: string; motivos?: string[] } = {};
  try {
    cuerpo = await r.json();
  } catch {
    cuerpo = {};
  }
  if (r.status === 202 && cuerpo.estado === "RECIBIDA") return { estado: "RECIBIDA", status: r.status, detalle: "recibida por el Puente" };
  if (r.status === 202 && cuerpo.estado === "REQUIERE_REVISION") return { estado: "REQUIERE_REVISION", status: r.status, detalle: `en revisión: ${(cuerpo.motivos ?? []).join(", ")}` };
  if (r.status === 200 && cuerpo.estado === "DUPLICADA") return { estado: "DUPLICADA", status: r.status, detalle: "ya estaba en el Puente; no se creó nada" };
  if (r.status === 401) throw new Error("El Puente rechazó el token de la fuente (401): se detiene el bot.");
  if (r.status >= 400 && r.status < 500) return { estado: "RECHAZADA", status: r.status, detalle: cuerpo.mensaje ?? `rechazada (${r.status})` };
  return { estado: "ERROR", status: r.status, detalle: cuerpo.mensaje ?? `respuesta inesperada (${r.status})` };
}

import { createHash } from "node:crypto";
import { conexionVinculo, marcarContacto, tiempoDeEspera, type ConexionVinculo } from "./conexiones";

// Conector HTTP del puente hacia Vínculo (API modelada sobre Apply Connect, docs/contratos.md §1). Es el único lugar
// del puente que conoce el formato de Vínculo. Token de aplicación por client credentials, cacheado en memoria hasta
// 5 minutos antes de vencer (§4.3).

export type TipoFalloVinculo = "sin_conexion" | "red" | "credenciales" | "servidor" | "validacion";

export class ErrorVinculo extends Error {
  constructor(
    public tipo: TipoFalloVinculo,
    message: string,
    public status?: number,
    public codigo?: string,
  ) {
    super(message);
    this.name = "ErrorVinculo";
  }
}

interface TokenCache {
  clave: string;
  token: string;
  venceEn: number;
}
let cache: TokenCache | null = null;
const MARGEN_MS = 5 * 60_000;

export function olvidarToken() {
  cache = null;
}

async function conexion(): Promise<ConexionVinculo> {
  const c = await conexionVinculo();
  if (!c) throw new ErrorVinculo("sin_conexion", "El puente no tiene configurada la conexión con Vínculo (ver Conexiones).");
  return c;
}

const huella = (c: ConexionVinculo) => createHash("sha256").update(`${c.urlBase}|${c.clientId}|${c.clientSecret}`).digest("hex");

async function pedir(c: ConexionVinculo, ruta: string, init: RequestInit, fetchImpl: typeof fetch): Promise<Response> {
  try {
    const r = await fetchImpl(`${c.urlBase}${ruta}`, { ...init, redirect: "manual", signal: AbortSignal.timeout(await tiempoDeEspera("VINCULO")) });
    await marcarContacto("VINCULO");
    return r;
  } catch (e) {
    const nombre = e instanceof Error ? e.name : "";
    throw new ErrorVinculo("red", nombre === "TimeoutError" ? "Vínculo no respondió a tiempo." : "No fue posible conectar con Vínculo.");
  }
}

/** Access token vigente; pide uno nuevo si falta, si cambió la conexión o si vence en menos de 5 minutos. */
export async function obtenerToken(fetchImpl: typeof fetch = fetch, opciones: { forzar?: boolean } = {}): Promise<string> {
  const c = await conexion();
  const clave = huella(c);
  if (!opciones.forzar && cache && cache.clave === clave && cache.venceEn - MARGEN_MS > Date.now()) return cache.token;
  const r = await pedir(
    c,
    "/oauth/v2/accessToken",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: c.clientId, client_secret: c.clientSecret }).toString(),
    },
    fetchImpl,
  );
  if (r.status === 400 || r.status === 401) throw new ErrorVinculo("credenciales", "Vínculo rechazó el Client ID o el Client Secret del puente.", r.status);
  if (!r.ok) throw new ErrorVinculo("servidor", `Vínculo respondió ${r.status} al pedir el token.`, r.status);
  const datos = (await r.json()) as { access_token?: string; expires_in?: number };
  if (!datos.access_token) throw new ErrorVinculo("servidor", "Vínculo no devolvió un access token.");
  cache = { clave, token: datos.access_token, venceEn: Date.now() + (datos.expires_in ?? 3600) * 1000 };
  return cache.token;
}

/** Llamada con Bearer. Si el token dejó de valer (401), se pide uno nuevo una vez. */
async function llamar<T>(metodo: "GET" | "POST", ruta: string, cuerpo: unknown, fetchImpl: typeof fetch = fetch): Promise<T> {
  const c = await conexion();
  for (let intento = 0; intento < 2; intento++) {
    const token = await obtenerToken(fetchImpl, { forzar: intento > 0 });
    const r = await pedir(
      c,
      ruta,
      { method: metodo, headers: { Authorization: `Bearer ${token}`, ...(cuerpo === undefined ? {} : { "Content-Type": "application/json" }) }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) },
      fetchImpl,
    );
    const texto = await r.text();
    let json: unknown = null;
    try {
      json = texto ? JSON.parse(texto) : null;
    } catch {
      json = null;
    }
    if (r.ok) return json as T;
    const e = json as { code?: string; message?: string } | null;
    if (r.status === 401 && intento === 0) continue;
    if (r.status === 401 || r.status === 403) throw new ErrorVinculo("credenciales", e?.message ?? "Vínculo rechazó las credenciales del puente.", r.status, e?.code);
    if (r.status === 429 || r.status >= 500) throw new ErrorVinculo("servidor", `Vínculo respondió ${r.status}.`, r.status, e?.code);
    throw new ErrorVinculo("validacion", e?.message ?? `Vínculo rechazó la solicitud (${r.status}).`, r.status, e?.code);
  }
  throw new ErrorVinculo("credenciales", "Vínculo rechazó el token del puente.");
}

export interface Autorizaciones {
  application: { clientId: string; name: string; webhookStatus: string };
  elements: { companyId: string; name: string; authorizedAt: string }[];
}
export const autorizaciones = (f?: typeof fetch) => llamar<Autorizaciones>("GET", "/api/v1/autorizaciones", undefined, f);

export interface VacanteVinculo {
  id: string;
  externalJobId: string;
  state: "DRAFT" | "LISTED" | "CLOSED";
  applyMethod: "ONSITE_APPLY" | "COMPANY_SITE";
  url: string;
  notOnsiteReason: string | null;
  closedAt: string | null;
}

export function publicarVacante(
  datos: { externalJobId: string; companyId: string; title: string; description: string; location: string; workplaceType: "ON_SITE" | "HYBRID" | "REMOTE"; webhookUrl: string },
  f?: typeof fetch,
) {
  const { webhookUrl, ...resto } = datos;
  return llamar<VacanteVinculo & { webhookValidation: string | null }>("POST", "/api/v1/jobPostings", { ...resto, employmentType: "FULL_TIME", listingType: "BASIC", onsiteApply: { jobApplicationWebhookUrl: webhookUrl } }, f);
}

export const cerrarVacante = (externalJobId: string, f?: typeof fetch) => llamar<VacanteVinculo>("POST", `/api/v1/jobPostings/${encodeURIComponent(externalJobId)}/close`, undefined, f);

/** Aviso de ciclo de vida a Vínculo (lo ve el candidato en «Mis postulaciones»). */
export const avisarCicloDeVida = (jobApplicationId: string, action: "VIEWED" | "RESUME_DOWNLOADED" | "REJECTED", f?: typeof fetch) =>
  llamar<{ status: string }>("POST", `/api/v1/jobApplications/${encodeURIComponent(jobApplicationId)}/lifecycle`, { action }, f);

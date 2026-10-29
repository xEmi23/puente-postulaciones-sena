import { config } from "@/lib/config";

// Conector HTTP del puente hacia Vínculo (API modelada sobre Apply Connect, docs/contratos.md §1).
// Token de aplicación por client credentials, cacheado en memoria hasta 5 minutos antes de vencer.

export class ErrorVinculo extends Error {
  constructor(
    public tipo: "red" | "credenciales" | "servidor",
    message: string,
    public status?: number,
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

/** Access token vigente para la aplicación configurada; pide uno nuevo si falta o vence en menos de 5 minutos. */
export async function obtenerToken(fetchImpl: typeof fetch = fetch, ahora = Date.now()): Promise<string> {
  const cfg = config();
  const clave = `${cfg.ORIGEN_BASE_URL}|${cfg.VINCULO_CLIENT_ID}`;
  if (cache && cache.clave === clave && cache.venceEn - MARGEN_MS > ahora) return cache.token;
  let r: Response;
  try {
    r = await fetchImpl(`${cfg.ORIGEN_BASE_URL.replace(/\/$/, "")}/oauth/v2/accessToken`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: cfg.VINCULO_CLIENT_ID, client_secret: cfg.SIM_CLIENT_SECRET }).toString(),
      redirect: "manual",
      signal: AbortSignal.timeout(Number(process.env.VINCULO_TIMEOUT_MS ?? 15_000)),
    });
  } catch {
    throw new ErrorVinculo("red", "No fue posible conectar con Vínculo para obtener el token.");
  }
  if (r.status === 400 || r.status === 401) throw new ErrorVinculo("credenciales", "Vínculo rechazó el Client ID o el Client Secret del puente.", r.status);
  if (!r.ok) throw new ErrorVinculo("servidor", `Vínculo respondió ${r.status} al pedir el token.`, r.status);
  const datos = (await r.json()) as { access_token?: string; expires_in?: number };
  if (!datos.access_token) throw new ErrorVinculo("servidor", "Vínculo no devolvió un access token.");
  cache = { clave, token: datos.access_token, venceEn: ahora + (datos.expires_in ?? 3600) * 1000 };
  return cache.token;
}

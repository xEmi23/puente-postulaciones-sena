import { prisma } from "@/lib/db";
import { apiHabilitada } from "@/lib/config";
import { leerToken } from "@/lib/tokens";
import type { AplicacionDev } from "@/generated/prisma/client";

// Capa HTTP de la API de Vínculo para aplicaciones de integradores (contrato del simulador modelado sobre Apply Connect).
// Autenticación: Authorization: Bearer <access_token> obtenido con client credentials.
// Errores: { status, code, message, details? } (forma propia del simulador).

export function respuesta(status: number, cuerpo: unknown, encabezados: Record<string, string> = {}) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...encabezados },
  });
}

export function error(status: number, code: string, message: string, details?: Record<string, unknown>) {
  return respuesta(status, details ? { status, code, message, details } : { status, code, message }, status === 401 ? { "WWW-Authenticate": "Bearer" } : {});
}

/** Valida el Bearer: token vigente, aplicación existente y no revocada, y misma versión del Client Secret. */
export async function aplicacionDelToken(req: Request): Promise<AplicacionDev | null> {
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return null;
  const datos = await leerToken(token);
  if (!datos) return null;
  const app = await prisma.aplicacionDev.findUnique({ where: { id: datos.app } });
  if (!app || app.revocadaEn || app.secretoVersion !== datos.ver) return null;
  return app;
}

/** Con VINCULO_API_HABILITADA apagada la API no existe: 404 sin cuerpo útil, como una ruta que no hay. */
export function apiNoDisponible(): Response | null {
  return apiHabilitada() ? null : error(404, "NOT_FOUND", "No existe.");
}

export async function conAplicacion(req: Request, manejador: (app: AplicacionDev) => Promise<Response>): Promise<Response> {
  const apagada = apiNoDisponible();
  if (apagada) return apagada;
  const app = await aplicacionDelToken(req);
  if (!app) return error(401, "INVALID_ACCESS_TOKEN", "El access token falta, venció o no es válido.");
  try {
    return await manejador(app);
  } catch (e) {
    console.error("[vinculo:api] error inesperado", e instanceof Error ? e.message : e);
    return error(500, "INTERNAL_ERROR", "Error inesperado en el Simulador LinkedIn.");
  }
}

export async function leerJson(req: Request): Promise<{ ok: true; datos: unknown } | { ok: false; respuesta: Response }> {
  try {
    return { ok: true, datos: await req.json() };
  } catch {
    return { ok: false, respuesta: error(400, "INVALID_JSON", "El cuerpo no es JSON válido.") };
  }
}

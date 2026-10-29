import { prisma } from "@/lib/db";
import { emitirToken } from "@/lib/tokens";
import { secretoCorrecto } from "@/modules/aplicaciones";

export const dynamic = "force-dynamic";

const errorOAuth = (status: number, error: string, descripcion: string) =>
  Response.json({ error, error_description: descripcion }, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Token de aplicación (client credentials), como el flujo de 2 patas de LinkedIn (contrato del simulador para la ruta).
 * Acepta application/x-www-form-urlencoded (como LinkedIn) o JSON.
 */
export async function POST(req: Request) {
  let campos: Record<string, string> = {};
  const tipo = req.headers.get("content-type") ?? "";
  try {
    campos = tipo.includes("application/json") ? await req.json() : Object.fromEntries(new URLSearchParams(await req.text()));
  } catch {
    return errorOAuth(400, "invalid_request", "Cuerpo ilegible.");
  }
  if (campos.grant_type !== "client_credentials") return errorOAuth(400, "unsupported_grant_type", "Solo se admite grant_type=client_credentials.");
  if (!campos.client_id || !campos.client_secret) return errorOAuth(400, "invalid_request", "Faltan client_id o client_secret.");
  const app = await prisma.aplicacionDev.findUnique({ where: { clientId: String(campos.client_id) } });
  if (!app || app.revocadaEn || !secretoCorrecto(app, String(campos.client_secret))) {
    return errorOAuth(401, "invalid_client", "Client ID o Client Secret incorrectos.");
  }
  return Response.json(await emitirToken(app), { headers: { "Cache-Control": "no-store" } });
}

import { jwtVerify, SignJWT } from "jose";
import { config, urlPublica } from "./config";

// Access tokens de las aplicaciones (client credentials): JWT HS256 de 60 minutos.
// Llevan la versión del Client Secret: al regenerarlo o revocar la aplicación, los tokens emitidos dejan de valer.

export const DURACION_TOKEN_S = 3600;
const clave = () => new TextEncoder().encode(config().VINCULO_JWT_SECRET);

export async function emitirToken(app: { id: string; clientId: string; secretoVersion: number }) {
  const token = await new SignJWT({ app: app.id, ver: app.secretoVersion })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(app.clientId)
    .setIssuer(urlPublica())
    .setIssuedAt()
    .setExpirationTime(`${DURACION_TOKEN_S}s`)
    .sign(clave());
  return { access_token: token, expires_in: DURACION_TOKEN_S, token_type: "Bearer" };
}

/** Devuelve { app, ver } si el token es válido y vigente; null en otro caso. */
export async function leerToken(token: string): Promise<{ app: string; ver: number } | null> {
  try {
    const { payload } = await jwtVerify(token, clave(), { algorithms: ["HS256"], issuer: urlPublica() });
    if (typeof payload.app !== "string" || typeof payload.ver !== "number") return null;
    return { app: payload.app, ver: payload.ver };
  } catch {
    return null;
  }
}

import { z } from "zod";

// Configuración de Vínculo validada con Zod. Se lee en cada llamada para que las pruebas
// puedan ajustar process.env sin reiniciar módulos.
const esquema = z.object({
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  // 32 bytes en hexadecimal: cifra los Client Secret de las aplicaciones (AES-256-GCM).
  // 64 hexadecimales (32 bytes) o cualquier secreto de 32+ caracteres (p. ej. generateValue de Render), del que se deriva la clave.
  VINCULO_CLAVE_CIFRADO: z.string().min(32, "Debe tener al menos 32 caracteres (ideal: 64 hexadecimales)."),
  // Firma los access tokens (JWT HS256) de las aplicaciones.
  VINCULO_JWT_SECRET: z.string().min(32),
  CV_MAX_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
  MEDIA_TTL_DAYS: z.coerce.number().int().positive().default(30),
  NODE_ENV: z.string().default("development"),
});

export type Config = z.infer<typeof esquema>;

export function config(): Config {
  const r = esquema.safeParse(process.env);
  if (!r.success) {
    const campos = r.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Configuración inválida o incompleta en .env: ${campos}`);
  }
  return r.data;
}

/** URL pública de Vínculo: APP_BASE_URL local o RENDER_EXTERNAL_URL en Render. */
export function urlPublica(): string {
  return (process.env.APP_BASE_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:3001").replace(/\/$/, "");
}

/** ¿Se sirve desde una máquina local? (localhost, 127.0.0.1, ::1 o el TLD reservado .test). */
export function esEntornoLocal(): boolean {
  const host = new URL(urlPublica()).hostname;
  return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(host) || host.endsWith(".test");
}

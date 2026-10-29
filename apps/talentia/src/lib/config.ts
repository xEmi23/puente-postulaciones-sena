import { z } from "zod";

// Configuración de Talentia validada con Zod. Se lee en cada llamada para que las pruebas
// puedan ajustar process.env sin reiniciar módulos.
const esquema = z.object({
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  CV_MAX_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
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

/** URL pública de esta app: APP_BASE_URL local o RENDER_EXTERNAL_URL en Render. */
export function urlPublica(): string {
  return (process.env.APP_BASE_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:3002").replace(/\/$/, "");
}

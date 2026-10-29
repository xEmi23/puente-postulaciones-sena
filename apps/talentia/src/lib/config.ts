import { z } from "zod";

// Configuración de Talentia validada con Zod. Se lee en cada llamada para que las pruebas
// puedan ajustar process.env sin reiniciar módulos.
const esquema = z.object({
  DATABASE_URL: z.url(),
  APP_BASE_URL: z.url(),
  ATS_API_KEY: z.string().min(16),
  CV_MAX_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
  DEMO_AUTH_ENABLED: z.enum(["true", "false"]).default("false"),
  DEMO_ADMIN_USER: z.string().optional(),
  DEMO_ADMIN_PASSWORD: z.string().optional(),
  SESSION_SECRET: z.string().optional(),
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

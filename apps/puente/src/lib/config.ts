import { z } from "zod";

// Configuración del puente validada con Zod. Se lee en cada llamada para que las pruebas
// puedan ajustar process.env sin reiniciar módulos.
const esquema = z.object({
  DATABASE_URL: z.url(),
  APP_BASE_URL: z.url(),
  ORIGEN_BASE_URL: z.url(),
  ATS_BASE_URL: z.url(),
  SIM_CLIENT_SECRET: z.string().min(16),
  ORIGEN_MEDIA_ACCESS_TOKEN: z.string().min(16),
  ATS_API_KEY: z.string().min(16),
  CV_MAX_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
  PUENTE_MODO_PRUEBAS: z.enum(["0", "1"]).default("0"),
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

/**
 * ¿La aplicación se sirve desde una máquina local? (localhost, 127.0.0.1, ::1 o el TLD reservado .test).
 * `next start` siempre corre con NODE_ENV=production, así que NODE_ENV no distingue una demo local de un
 * despliegue real; el host público sí: un entorno real nunca tiene APP_BASE_URL en localhost.
 */
export function esEntornoLocal(): boolean {
  const host = new URL(config().APP_BASE_URL).hostname;
  return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(host) || host.endsWith(".test");
}

/** Los fallos inyectables de los conectores solo existen con PUENTE_MODO_PRUEBAS=1 y en un entorno local (D-12). */
export function modoPrueba(): boolean {
  return config().PUENTE_MODO_PRUEBAS === "1" && esEntornoLocal();
}

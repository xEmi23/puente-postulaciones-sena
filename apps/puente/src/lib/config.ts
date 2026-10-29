import { z } from "zod";

// Configuración del puente validada con Zod. Se lee en cada llamada para que las pruebas
// puedan ajustar process.env sin reiniciar módulos.
// Las URL y credenciales de Vínculo y Talentia NO van aquí: se configuran en /conexiones (ESPECIFICACION §6).
const esquema = z.object({
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  // 32 bytes en hexadecimal: cifra el Client Secret de Vínculo y la API Key de Talentia (AES-256-GCM, §4.4).
  PUENTE_CLAVE_CIFRADO: z.string().regex(/^[0-9a-f]{64}$/, "Debe tener 64 caracteres hexadecimales (32 bytes)."),
  CV_MAX_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
  PUENTE_MODO_PRUEBAS: z.enum(["0", "1"]).default("0"),
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

/** URL pública del puente: APP_BASE_URL local o RENDER_EXTERNAL_URL en Render. */
export function urlPublica(): string {
  return (process.env.APP_BASE_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:3003").replace(/\/$/, "");
}

/** URL del webhook que se registra en Vínculo. */
export const urlWebhook = () => `${urlPublica()}/api/webhooks/vinculo`;

/**
 * ¿Se sirve desde una máquina local? (localhost, 127.0.0.1, ::1 o el TLD reservado .test).
 * `next start` siempre corre con NODE_ENV=production, así que NODE_ENV no distingue una demo local de un
 * despliegue real; el host público sí.
 */
export function esEntornoLocal(): boolean {
  const host = new URL(urlPublica()).hostname;
  return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(host) || host.endsWith(".test");
}

/** Los fallos inyectables de los conectores solo existen con PUENTE_MODO_PRUEBAS=1 y en un entorno local (D-12). */
export function modoPrueba(): boolean {
  return config().PUENTE_MODO_PRUEBAS === "1" && esEntornoLocal();
}

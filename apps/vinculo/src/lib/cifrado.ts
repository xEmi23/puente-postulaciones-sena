import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { config } from "./config";

// Cifrado de secretos en reposo con AES-256-GCM (clave VINCULO_CLAVE_CIFRADO). Formato: v1.<iv>.<etiqueta>.<cifrado> en base64url.
// Vínculo necesita el Client Secret en claro para firmar las entregas y responder el desafío del webhook,
// por eso se cifra en lugar de guardar solo un hash.

const clave = () => Buffer.from(config().VINCULO_CLAVE_CIFRADO, "hex");

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", clave(), iv);
  const cifrado = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), cifrado.toString("base64url")].join(".");
}

export function descifrar(valor: string): string {
  const [version, iv, etiqueta, cifrado] = valor.split(".");
  if (version !== "v1" || !iv || !etiqueta || !cifrado) throw new Error("Formato de secreto cifrado desconocido.");
  const d = createDecipheriv("aes-256-gcm", clave(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(etiqueta, "base64url"));
  return Buffer.concat([d.update(Buffer.from(cifrado, "base64url")), d.final()]).toString("utf8");
}

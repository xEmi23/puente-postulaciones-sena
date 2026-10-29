import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { config } from "./config";

// Cifrado de secretos en reposo con AES-256-GCM (clave PUENTE_CLAVE_CIFRADO). Formato: v1.<iv>.<etiqueta>.<cifrado> en base64url.
// El puente necesita los secretos en claro para llamar a Vínculo y a Talentia y para verificar la firma de las entregas,
// por eso se cifran en lugar de guardar solo un hash (ESPECIFICACION §4.4).

/** 64 hexadecimales se usan tal cual (setup local); otro valor (Render lo genera en base64) se deriva a 32 bytes con SHA-256. */
function clave(): Buffer {
  const valor = config().PUENTE_CLAVE_CIFRADO;
  return /^[0-9a-f]{64}$/i.test(valor) ? Buffer.from(valor, "hex") : createHash("sha256").update(valor, "utf8").digest();
}

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

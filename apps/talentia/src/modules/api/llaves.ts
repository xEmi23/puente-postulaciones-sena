import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";

// API Keys de Talentia. La llave completa se muestra UNA sola vez al crearla; se guarda solo su SHA-256
// y un prefijo visible para reconocerla en las listas y en el registro de actividad.
// Permisos por módulo (Selección → Lectura y/o Modificación), como en BUK (docs/contratos.md, Verificado).

export const hashLlave = (llave: string) => createHash("sha256").update(llave, "utf8").digest("hex");

/** Formato: tal_<8 hex>.<43 caracteres base64url>. El prefijo es la parte antes del punto. */
export function generarLlave() {
  const prefijo = `tal_${randomBytes(4).toString("hex")}`;
  const llave = `${prefijo}.${randomBytes(32).toString("base64url")}`;
  return { prefijo, llave, hash: hashLlave(llave) };
}

export const prefijoDe = (llave: string) => (/^tal_[0-9a-f]{8}\./.test(llave) ? llave.slice(0, 12) : null);

export const esquemaNuevaLlave = z
  .object({
    nombre: z.string().trim().min(3, "El nombre debe tener al menos 3 caracteres.").max(60, "Máximo 60 caracteres."),
    lectura: z.boolean(),
    modificacion: z.boolean(),
  })
  .refine((d) => d.lectura || d.modificacion, { message: "Elige al menos un permiso.", path: ["lectura"] });

export async function crearApiKey(entrada: z.input<typeof esquemaNuevaLlave>, creadaPorId: string | null, demo = false) {
  const r = esquemaNuevaLlave.safeParse(entrada);
  if (!r.success) return { ok: false as const, error: r.error.issues[0].message };
  const { prefijo, llave, hash } = generarLlave();
  const registro = await prisma.apiKey.create({
    data: { nombre: r.data.nombre, prefijo, hash, permisoLectura: r.data.lectura, permisoModificacion: r.data.modificacion, creadaPorId, demo },
  });
  return { ok: true as const, llave, registro };
}

export async function revocarApiKey(id: string) {
  if (!z.uuid().safeParse(id).success) return false;
  const r = await prisma.apiKey.updateMany({ where: { id, revocadaEn: null }, data: { revocadaEn: new Date() } });
  return r.count === 1;
}

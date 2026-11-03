import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma, esViolacionUnica } from "@/lib/db";
import { esquemaNombreFuente } from "@/nucleo/contrato/canonica";
import { auditar, type Actor } from "@/nucleo/auditoria";

// Fuentes de postulaciones y sus tokens (ESPECIFICACION_V4 §8.1). El token se muestra UNA vez al generarlo; se guarda
// solo su SHA-256 y un prefijo visible para reconocerlo. La fuente de una postulación sale del token, nunca del cuerpo.
// Formato: "pf_<prefijo de 10 hex>.<secreto de 32 bytes en base64url>".

const sha = (t: string) => createHash("sha256").update(t, "utf8").digest("hex");

export type ResultadoFuente = { ok: true; mensaje: string; token?: string } | { ok: false; mensaje: string };

export async function crearFuente(nombre: string, descripcion: string, actor: Actor): Promise<ResultadoFuente> {
  const n = esquemaNombreFuente.safeParse(nombre.trim());
  if (!n.success) return { ok: false, mensaje: n.error.issues[0].message };
  try {
    await prisma.fuente.create({ data: { nombre: n.data, descripcion: descripcion.trim().slice(0, 200) } });
  } catch (e) {
    if (esViolacionUnica(e)) return { ok: false, mensaje: `Ya existe una fuente «${n.data}».` };
    throw e;
  }
  await auditar(actor, "fuente.creada", null, n.data);
  return { ok: true, mensaje: `Fuente «${n.data}» creada. Genera su token para que pueda enviar postulaciones.` };
}

/** Genera (o rota) el token de una fuente. El anterior deja de funcionar de inmediato. */
export async function generarToken(nombre: string, actor: Actor): Promise<ResultadoFuente> {
  const f = await prisma.fuente.findUnique({ where: { nombre } });
  if (!f) return { ok: false, mensaje: "La fuente no existe." };
  if (f.sistema) return { ok: false, mensaje: "Esta fuente es del sistema y no usa token (Apply Connect usa la firma HMAC del webhook)." };
  const prefijo = randomBytes(5).toString("hex");
  const token = `pf_${prefijo}.${randomBytes(32).toString("base64url")}`;
  await prisma.fuente.update({ where: { id: f.id }, data: { tokenHash: sha(token), tokenPrefijo: prefijo, activa: true, revocadaEn: null } });
  await auditar(actor, "fuente.token_generado", null, nombre);
  return { ok: true, mensaje: "Token generado. Cópialo ahora: no se volverá a mostrar.", token };
}

export async function revocarFuente(nombre: string, actor: Actor): Promise<ResultadoFuente> {
  const f = await prisma.fuente.findUnique({ where: { nombre } });
  if (!f) return { ok: false, mensaje: "La fuente no existe." };
  if (f.sistema) return { ok: false, mensaje: "La fuente del sistema no se revoca desde aquí." };
  await prisma.fuente.update({ where: { id: f.id }, data: { activa: false, revocadaEn: new Date(), tokenHash: null } });
  await auditar(actor, "fuente.revocada", null, nombre);
  return { ok: true, mensaje: `Fuente «${nombre}» revocada: su token ya no funciona.` };
}

/** Autentica un token: busca por prefijo y compara el SHA-256 en tiempo constante. Devuelve el nombre de la fuente. */
export async function autenticarToken(token: string | null | undefined): Promise<string | null> {
  const m = /^pf_([0-9a-f]{10})\.[A-Za-z0-9_-]{20,}$/.exec(token ?? "");
  if (!m) return null;
  const candidatas = await prisma.fuente.findMany({ where: { tokenPrefijo: m[1], activa: true, tokenHash: { not: null } } });
  const esperado = Buffer.from(sha(token!), "hex");
  for (const f of candidatas) {
    const guardado = Buffer.from(f.tokenHash!, "hex");
    if (guardado.length === esperado.length && timingSafeEqual(guardado, esperado)) {
      await prisma.fuente.update({ where: { id: f.id }, data: { ultimoUsoEn: new Date() } });
      return f.nombre;
    }
  }
  return null;
}

/** Del encabezado Authorization: Bearer <token>. */
export function tokenDeSolicitud(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : null;
}

const DESCRIPCION_SISTEMA = "Apply Connect (Simulador LinkedIn): webhook firmado con HMAC";

/** La fuente del sistema de Apply Connect existe siempre (la siembra también la migración). Su descripción se
 *  reescribe porque la migración guardó el nombre visible anterior (D-74). */
export async function asegurarFuenteSistema() {
  await prisma.fuente.upsert({
    where: { nombre: "apply-connect" },
    create: { nombre: "apply-connect", descripcion: DESCRIPCION_SISTEMA, sistema: true },
    update: { descripcion: DESCRIPCION_SISTEMA },
  });
}

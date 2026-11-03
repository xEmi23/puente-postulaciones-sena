import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { config, urlPublica } from "@/lib/config";
import { pareceUnPdf } from "@/lib/archivos";
import { normalizarCorreo } from "@/nucleo/contrato/canonica";
import { registrarRecepcion } from "@/nucleo/recepcion/registrar";
import { auditar, type Actor } from "@/nucleo/auditoria";
import { VERSION_AVISO } from "./aviso";

// Formulario público del Puente (V4 F6, D-75): la oferta en LinkedIn lleva un enlace externo a /postular/<código>.
// Cada vacante vinculada a un proceso del ATS tiene un código público: es una Correspondencia de la fuente
// «formulario-publico» cuya vacanteExterna es el código. Lo enviado entra por registrarRecepcion(), igual que las
// demás fuentes (deduplicación, revisión, reintentos y envío al ATS por ConectorATS).
// Protecciones: límite por IP y por vacante, campo trampa, tiempo mínimo de llenado firmado, tope de tamaño, PDF por
// contenido y la misma respuesta para una postulación nueva o repetida (no revela si un correo ya existe).

export const FUENTE_FORMULARIO = "formulario-publico";
const DESCRIPCION_FUENTE = "Formulario público del Puente (enlace externo en la oferta)";
const ACTOR: Actor = { tipo: "fuente", id: FUENTE_FORMULARIO };

export const formatoCodigo = /^[a-z0-9]{12}$/;
const ALFABETO = "abcdefghijkmnpqrstuvwxyz23456789";

/** 12 caracteres sin ambigüedades (sin 0/o, 1/l): ~60 bits, no se adivinan. */
export function nuevoCodigo(): string {
  return Array.from(randomBytes(12), (b) => ALFABETO[b % ALFABETO.length]).join("");
}

export const urlFormulario = (codigo: string) => `${urlPublica()}/postular/${codigo}`;

const clave = () => createHash("sha256").update(`formulario-publico:${config().PUENTE_CLAVE_CIFRADO}`, "utf8").digest();
const hmac = (texto: string) => createHmac("sha256", clave()).update(texto, "utf8").digest("hex");

export const MIN_LLENADO_MS = () => Number(process.env.PUENTE_FORMULARIO_MIN_MS ?? 3000);
const MAX_LLENADO_MS = 2 * 60 * 60 * 1000;
export const LIMITE_POR_IP = () => Number(process.env.PUENTE_FORMULARIO_LIMITE_IP ?? 5);
export const LIMITE_POR_VACANTE = () => Number(process.env.PUENTE_FORMULARIO_LIMITE_VACANTE ?? 100);
const VENTANA_IP_MS = 10 * 60 * 1000;
const VENTANA_VACANTE_MS = 60 * 60 * 1000;

export async function asegurarFuenteFormulario() {
  await prisma.fuente.upsert({
    where: { nombre: FUENTE_FORMULARIO },
    create: { nombre: FUENTE_FORMULARIO, descripcion: DESCRIPCION_FUENTE, sistema: true },
    update: {},
  });
}

/** Vacante pública activa por su código, o null (código inexistente, mal formado o desactivado). */
export async function vacantePublica(codigo: string) {
  if (!formatoCodigo.test(codigo)) return null;
  const c = await prisma.correspondencia.findUnique({ where: { externalJobId: `${FUENTE_FORMULARIO}:${codigo}` } });
  return c && c.activa ? { codigo, titulo: c.descripcion, procesoAtsId: c.procesoAtsId } : null;
}

/** Crea (o reactiva) el enlace público de un proceso del ATS. Un proceso tiene un solo código. */
export async function crearEnlace(procesoAtsId: number, titulo: string, actor: Actor): Promise<string> {
  await asegurarFuenteFormulario();
  const existente = await prisma.correspondencia.findFirst({ where: { fuente: FUENTE_FORMULARIO, procesoAtsId } });
  if (existente) {
    await prisma.correspondencia.update({ where: { id: existente.id }, data: { activa: true, cerradaEn: null, descripcion: titulo } });
    await auditar(actor, "formulario.enlace_activado", null, `proceso ${procesoAtsId}`);
    return existente.vacanteExterna!;
  }
  const codigo = nuevoCodigo();
  await prisma.correspondencia.create({
    data: { fuente: FUENTE_FORMULARIO, vacanteExterna: codigo, externalJobId: `${FUENTE_FORMULARIO}:${codigo}`, procesoAtsId, descripcion: titulo, demo: false },
  });
  await auditar(actor, "formulario.enlace_creado", null, `proceso ${procesoAtsId}`);
  return codigo;
}

/** Desactiva el enlace: el formulario deja de aceptar postulaciones (las anteriores se respetan, D-17). */
export async function desactivarEnlace(codigo: string, actor: Actor) {
  await prisma.correspondencia.updateMany({ where: { externalJobId: `${FUENTE_FORMULARIO}:${codigo}` }, data: { activa: false, cerradaEn: new Date() } });
  await auditar(actor, "formulario.enlace_desactivado", null, codigo);
}

// ───────────── Protecciones ─────────────

/** Marca de tiempo firmada que la página pone en un campo oculto: prueba cuándo se abrió el formulario. */
export function marcaDeTiempo(codigo: string, ahora = Date.now()): string {
  return `${ahora}.${hmac(`t:${codigo}:${ahora}`)}`;
}

export function tiempoValido(codigo: string, marca: string, ahora = Date.now()): "ok" | "rapido" | "invalido" {
  const [t, firma] = marca.split(".");
  const n = Number(t);
  if (!Number.isInteger(n) || !firma) return "invalido";
  const esperado = Buffer.from(hmac(`t:${codigo}:${n}`), "hex");
  const recibido = Buffer.from(firma, "hex");
  if (recibido.length !== esperado.length || !timingSafeEqual(recibido, esperado)) return "invalido";
  if (ahora - n > MAX_LLENADO_MS) return "invalido";
  return ahora - n < MIN_LLENADO_MS() ? "rapido" : "ok";
}

/** IP del cliente. En Render llega por el proxy (Supuesto pendiente de verificar qué encabezado es confiable). */
export function ipDe(req: Request): string {
  const h = req.headers;
  return (h.get("true-client-ip") ?? h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "desconocida").trim();
}

/** Origen resumido para la prueba del consentimiento y el límite: HMAC de la IP (no reversible sin la clave). */
export const resumirOrigen = (ip: string) => `hmac:${hmac(`ip:${ip}`).slice(0, 24)}`;

const ventanas = new Map<string, { inicio: number; usadas: number }>();

function cupo(clave: string, limite: number, ventanaMs: number, ahora: number): boolean {
  const v = ventanas.get(clave);
  if (!v || ahora - v.inicio >= ventanaMs) {
    ventanas.set(clave, { inicio: ahora, usadas: 1 });
    return true;
  }
  if (v.usadas >= limite) return false;
  v.usadas++;
  return true;
}

/** Límite en memoria del proceso (una sola instancia en Render gratuito; ver limite.ts de la entrada genérica). */
export function consumirCupoFormulario(origen: string, codigo: string, ahora = Date.now()): boolean {
  return cupo(`ip:${origen}`, LIMITE_POR_IP(), VENTANA_IP_MS, ahora) && cupo(`vac:${codigo}`, LIMITE_POR_VACANTE(), VENTANA_VACANTE_MS, ahora);
}

/** Solo pruebas. */
export function reiniciarCuposFormulario() {
  ventanas.clear();
}

// ───────────── Envío ─────────────

export type ResultadoFormulario =
  | { ok: true } // nueva, repetida, en revisión o campo trampa: la persona ve lo mismo
  | { ok: false; error: "vacante" | "limite" | "rapido" | "datos" | "consentimiento" | "sin_cv" | "no_pdf" | "grande"; campos?: string[] };

const texto = (form: FormData, campo: string) => {
  const v = form.get(campo);
  return typeof v === "string" ? v : "";
};

/** Procesa el envío del formulario. No escribe datos personales en los registros (solo el id de la recepción). */
export async function recibirFormulario(req: Request, codigo: string): Promise<ResultadoFormulario> {
  const vacante = await vacantePublica(codigo);
  if (!vacante) return { ok: false, error: "vacante" };
  const origen = resumirOrigen(ipDe(req));
  if (!consumirCupoFormulario(origen, codigo)) return { ok: false, error: "limite" };

  const max = config().CV_MAX_BYTES;
  const declarado = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declarado) && declarado > max + 64 * 1024) return { ok: false, error: "grande" };
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return { ok: false, error: "datos" };
  }

  // Campo trampa: una persona no lo ve ni lo llena. Se responde como si todo hubiera ido bien.
  if (texto(form, "sitio_web").trim() !== "") return { ok: true };
  const t = tiempoValido(codigo, texto(form, "t"));
  if (t === "invalido") return { ok: false, error: "datos" };
  if (t === "rapido") return { ok: false, error: "rapido" };
  if (texto(form, "autorizacion") !== "si") return { ok: false, error: "consentimiento" };

  const archivo = form.get("cv");
  if (!(archivo instanceof File) || archivo.size === 0) return { ok: false, error: "sin_cv" };
  if (archivo.size > max) return { ok: false, error: "grande" };
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  if (!pareceUnPdf(bytes)) return { ok: false, error: "no_pdf" };

  const correo = normalizarCorreo(texto(form, "correo"));
  const candidato = { nombres: texto(form, "nombres"), apellidos: texto(form, "apellidos"), correo, telefono: texto(form, "telefono") };
  const faltan = (["nombres", "apellidos", "correo", "telefono"] as const).filter((c) => !candidato[c].trim());
  if (faltan.length) return { ok: false, error: "datos", campos: [...faltan] };

  // Misma persona (correo) en la misma vacante = misma postulación: el núcleo la responde DUPLICADA. El id externo es un
  // hash para no llevar el correo a la referencia que viaja al ATS.
  const idExterno = createHash("sha256").update(`${codigo}:${correo}`, "utf8").digest("hex").slice(0, 32);
  const r = await registrarRecepcion(
    { version: "1", fuente: FUENTE_FORMULARIO, idExterno, vacanteExterna: codigo, candidato, origenDatos: "fuente" },
    { tipo: "binario", bytes, nombreArchivo: archivo.name || "cv.pdf" },
    ACTOR,
    {
      detalleRecibido: "Postulación recibida por el formulario público (autorización de datos aceptada).",
      detalleDuplicado: "La misma persona (mismo correo) envió de nuevo el formulario de esta vacante; no se creó nada.",
      consentimiento: { en: new Date(), version: VERSION_AVISO, origen },
    },
  );
  switch (r.resultado) {
    case "RECIBIDA":
    case "REQUIERE_REVISION":
    case "DUPLICADA":
      return { ok: true };
    case "SIN_CORRESPONDENCIA":
      return { ok: false, error: "vacante" };
    case "INVALIDA":
      return { ok: false, error: "datos", campos: [...new Set(r.errores.map((e) => e.campo.split(".").pop()!))] };
    case "CV_INVALIDO":
      return { ok: false, error: r.codigo === "DEMASIADO_GRANDE" ? "grande" : "no_pdf" };
  }
}

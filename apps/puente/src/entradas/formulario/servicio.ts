import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { config, urlPublica } from "@/lib/config";
import { pareceUnPdf } from "@/lib/archivos";
import { referenciaCorta } from "@/lib/privacidad";
import { referenciaDe, registrarRecepcion } from "@/nucleo/recepcion/registrar";
import { auditar, type Actor } from "@/nucleo/auditoria";
import { VERSION_AVISO } from "./aviso";
import { CAMPO_TRAMPA, MODALIDADES, TIPOS_EMPLEO, validarFormulario, type ErroresCampos } from "./campos";

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

// ───────────── Ficha pública de la vacante ─────────────

/** Lo que ve el candidato. Es del Puente: editarla no cambia el proceso del ATS. */
export interface Ficha {
  titulo: string;
  ciudad: string;
  modalidad: string;
  tipoEmpleo: string;
  descripcion: string;
}

/** Datos del proceso del ATS de los que sale la ficha por defecto. */
export interface ProcesoBase {
  titulo: string;
  ciudad?: string;
  descripcion?: string;
}

export function fichaPorDefecto(p: ProcesoBase): Ficha {
  return {
    titulo: p.titulo.slice(0, 120),
    ciudad: (p.ciudad || "Por definir").slice(0, 80),
    modalidad: "Presencial",
    tipoEmpleo: "Tiempo completo",
    descripcion: (p.descripcion || `Postúlate a la vacante ${p.titulo}. El equipo de selección revisará tu hoja de vida.`).slice(0, 1200),
  };
}

const textoFicha = (max: number) =>
  z
    .string()
    .transform((v) => v.replace(/[ \t]+/g, " ").trim())
    .pipe(z.string().min(2, "Mínimo 2 caracteres.").max(max, `Máximo ${max} caracteres.`));

export const esquemaFicha = z.object({
  titulo: textoFicha(120),
  ciudad: textoFicha(80),
  modalidad: z.enum(MODALIDADES, { error: "Modalidad no válida." }),
  tipoEmpleo: z.enum(TIPOS_EMPLEO, { error: "Tipo de empleo no válido." }),
  descripcion: z
    .string()
    .transform((v) => v.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim())
    .pipe(z.string().min(20, "La descripción debe tener al menos 20 caracteres.").max(1200, "Máximo 1200 caracteres.")),
});

/** Vacante pública activa por su código, o null (código inexistente, mal formado o desactivado). */
export async function vacantePublica(codigo: string): Promise<{ codigo: string; procesoAtsId: number; ficha: Ficha } | null> {
  if (!formatoCodigo.test(codigo)) return null;
  const c = await prisma.correspondencia.findUnique({ where: { externalJobId: `${FUENTE_FORMULARIO}:${codigo}` } });
  if (!c || !c.activa) return null;
  const f = await prisma.fichaVacante.findUnique({ where: { codigo } });
  const ficha = f
    ? { titulo: f.titulo, ciudad: f.ciudad, modalidad: f.modalidad, tipoEmpleo: f.tipoEmpleo, descripcion: f.descripcion }
    : fichaPorDefecto({ titulo: c.descripcion });
  return { codigo, procesoAtsId: c.procesoAtsId, ficha };
}

/** Crea (o reactiva) el enlace público de un proceso del ATS. Un proceso tiene un solo código; su ficha se conserva. */
export async function crearEnlace(procesoAtsId: number, proceso: ProcesoBase, actor: Actor): Promise<string> {
  await asegurarFuenteFormulario();
  const existente = await prisma.correspondencia.findFirst({ where: { fuente: FUENTE_FORMULARIO, procesoAtsId } });
  const codigo = existente?.vacanteExterna ?? nuevoCodigo();
  if (existente) {
    await prisma.correspondencia.update({ where: { id: existente.id }, data: { activa: true, cerradaEn: null } });
    await auditar(actor, "formulario.enlace_activado", null, `proceso ${procesoAtsId}`);
  } else {
    await prisma.correspondencia.create({
      data: { fuente: FUENTE_FORMULARIO, vacanteExterna: codigo, externalJobId: `${FUENTE_FORMULARIO}:${codigo}`, procesoAtsId, descripcion: proceso.titulo, demo: false },
    });
    await auditar(actor, "formulario.enlace_creado", null, `proceso ${procesoAtsId}`);
  }
  if (!(await prisma.fichaVacante.findUnique({ where: { codigo } }))) await prisma.fichaVacante.create({ data: { codigo, ...fichaPorDefecto(proceso) } });
  return codigo;
}

/** Guarda la ficha pública de un enlace (Panel → Formulario público). El proceso del ATS no cambia. */
export async function guardarFicha(codigo: string, datos: unknown, actor: Actor): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  if (!formatoCodigo.test(codigo) || !(await prisma.correspondencia.findUnique({ where: { externalJobId: `${FUENTE_FORMULARIO}:${codigo}` } }))) {
    return { ok: false, mensaje: "El enlace no existe." };
  }
  const r = esquemaFicha.safeParse(datos);
  if (!r.success) {
    const i = r.error.issues[0];
    return { ok: false, mensaje: `${ETIQUETA_FICHA[String(i.path[0])] ?? "Dato"}: ${i.message}` };
  }
  await prisma.fichaVacante.upsert({ where: { codigo }, create: { codigo, ...r.data }, update: r.data });
  await auditar(actor, "formulario.ficha_guardada", null, codigo);
  return { ok: true };
}

const ETIQUETA_FICHA: Record<string, string> = { titulo: "Título", ciudad: "Ciudad", modalidad: "Modalidad", tipoEmpleo: "Tipo de empleo", descripcion: "Descripción" };

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

export type CodigoError = "vacante" | "limite" | "rapido" | "datos" | "consentimiento" | "sin_cv" | "no_pdf" | "grande";
export type ResultadoFormulario =
  | { ok: true; referencia: string } // nueva, repetida, en revisión o campo trampa: la persona ve lo mismo
  | { ok: false; error: CodigoError; campos?: ErroresCampos };

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

  // Campo trampa: una persona no lo ve ni lo llena. Se responde como si todo hubiera ido bien (referencia al azar).
  if (texto(form, CAMPO_TRAMPA).trim() !== "") return { ok: true, referencia: referenciaCorta(randomBytes(8).toString("hex")) };
  const t = tiempoValido(codigo, texto(form, "t"));
  if (t === "invalido") return { ok: false, error: "datos" };
  if (t === "rapido") return { ok: false, error: "rapido" };

  const v = validarFormulario({
    nombres: texto(form, "nombres"),
    apellidos: texto(form, "apellidos"),
    correo: texto(form, "correo"),
    indicativo: texto(form, "indicativo") || "+57",
    telefono: texto(form, "telefono"),
    ciudad: texto(form, "ciudad"),
    perfil: texto(form, "perfil"),
  });
  if (!v.ok) return { ok: false, error: "datos", campos: v.errores };
  if (texto(form, "autorizacion") !== "si") return { ok: false, error: "consentimiento" };

  const archivo = form.get("cv");
  if (!(archivo instanceof File) || archivo.size === 0) return { ok: false, error: "sin_cv" };
  if (archivo.size > max) return { ok: false, error: "grande" };
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  if (!pareceUnPdf(bytes)) return { ok: false, error: "no_pdf" };

  const d = v.datos;
  // Misma persona (correo) en la misma vacante = misma postulación: el núcleo la responde DUPLICADA. El id externo es un
  // hash para no llevar el correo a la referencia que viaja al ATS.
  const idExterno = createHash("sha256").update(`${codigo}:${d.correo}`, "utf8").digest("hex").slice(0, 32);
  const r = await registrarRecepcion(
    {
      version: "1",
      fuente: FUENTE_FORMULARIO,
      idExterno,
      vacanteExterna: codigo,
      // La ciudad va a candidato.ciudad y el perfil a candidato.perfilUrl: campos que la canónica v1 ya tiene.
      candidato: { nombres: d.nombres, apellidos: d.apellidos, correo: d.correo, telefono: d.telefono, ciudad: d.ciudad, ...(d.perfil ? { perfilUrl: d.perfil } : {}) },
      origenDatos: "fuente",
    },
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
      // La referencia corta que también muestra Operaciones (de la referencia global). Repetida = la de la primera.
      return { ok: true, referencia: referenciaCorta(referenciaDe(FUENTE_FORMULARIO, idExterno)) };
    case "SIN_CORRESPONDENCIA":
      return { ok: false, error: "vacante" };
    case "INVALIDA":
      return { ok: false, error: "datos" };
    case "CV_INVALIDO":
      return { ok: false, error: r.codigo === "DEMASIADO_GRANDE" ? "grande" : "no_pdf" };
  }
}

import { z } from "zod";

// PostulacionCanonica v1 (ESPECIFICACION_V4 §6): el ÚNICO formato que conoce el núcleo del Puente. Todo adaptador de
// entrada (Apply Connect, entrada genérica, importador, bot) entrega esto y nada más. El binario del CV viaja aparte;
// aquí solo van su nombre, tipo, SHA-256 y tamaño.

export const VERSION_CONTRATO = "1";
export const ORIGENES_DATOS = ["fuente", "extraido-del-cv", "confirmado-por-persona"] as const;
export type OrigenDatos = (typeof ORIGENES_DATOS)[number];

/** Correo en minúsculas y sin espacios. */
export function normalizarCorreo(valor: string): string {
  return valor.replace(/\s+/g, "").toLowerCase();
}

/** Espacios repetidos o en los extremos fuera. */
export function normalizarTexto(valor: string): string {
  return valor.replace(/\s+/g, " ").trim();
}

/**
 * Teléfono a E.164. Sin indicativo se asume Colombia (+57). Devuelve null si no queda un número E.164 válido
 * (de 8 a 15 dígitos en total).
 */
export function normalizarTelefono(valor: string): string | null {
  const limpio = valor.replace(/[\s().\-/]/g, "");
  if (!limpio) return null;
  let e164: string;
  if (limpio.startsWith("+")) e164 = `+${limpio.slice(1).replace(/\D/g, "")}`;
  else if (limpio.startsWith("00")) e164 = `+${limpio.slice(2).replace(/\D/g, "")}`;
  else e164 = `+57${limpio.replace(/\D/g, "")}`;
  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

const textoOpcional = (max: number) =>
  z
    .string()
    .max(max)
    .transform(normalizarTexto)
    .optional()
    .transform((v) => (v ? v : undefined));

const esquemaCandidato = z.object({
  nombres: z.string().max(120).transform(normalizarTexto).pipe(z.string().min(1, "Los nombres son obligatorios.")),
  apellidos: textoOpcional(120),
  correo: z
    .string()
    .max(200)
    .transform(normalizarCorreo)
    .pipe(z.union([z.literal(""), z.email("Correo con formato inválido.")]))
    .optional()
    .transform((v) => (v ? v : undefined)),
  telefono: z
    .string()
    .max(40)
    .optional()
    .transform((v, ctx) => {
      if (!v || !v.trim()) return undefined;
      const e164 = normalizarTelefono(v);
      if (!e164) {
        ctx.addIssue({ code: "custom", message: "Teléfono inválido: no se pudo llevar a E.164." });
        return z.NEVER;
      }
      return e164;
    }),
  ciudad: textoOpcional(120),
  titular: textoOpcional(200),
  perfilUrl: textoOpcional(500),
});

const esquemaCv = z.object({
  nombreArchivo: z.string().min(1).max(200),
  tipo: z.literal("application/pdf", { error: "El CV debe ser application/pdf." }),
  sha256: z.string().regex(/^[0-9a-f]{64}$/, "SHA-256 en hexadecimal minúsculo."),
  bytes: z.number().int().positive(),
});

const camposComunes = {
  version: z.literal(VERSION_CONTRATO, { error: "Versión del contrato no soportada (se espera «1»)." }),
  idExterno: z.string().trim().min(1, "idExterno es obligatorio.").max(300),
  vacanteExterna: z.string().trim().min(1, "vacanteExterna es obligatoria.").max(300),
  recibidaEn: z.iso
    .datetime({ offset: true, error: "recibidaEn debe ser una fecha ISO 8601." })
    .optional(),
  candidato: esquemaCandidato,
  cv: esquemaCv.optional(),
  respuestas: z
    .array(z.object({ pregunta: z.string().max(500), respuesta: z.string().max(2000) }))
    .max(50)
    .optional(),
  origenDatos: z.enum(ORIGENES_DATOS).default("fuente"),
};

/** Nombre de una fuente: corto, en minúsculas, con guiones (p. ej. «apply-connect», «importador», «linkedin-bot»). */
export const esquemaNombreFuente = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{1,39}$/, "Nombre de fuente: 2 a 40 caracteres en minúsculas, números o guiones.");

/** La canónica completa, tal como la guarda el núcleo. */
export const esquemaCanonica = z.object({ ...camposComunes, fuente: esquemaNombreFuente });

/** Lo que manda una fuente por la entrada genérica: la canónica SIN `fuente` (la fija el token, nunca el cuerpo). */
export const esquemaEntrada = z.object(camposComunes).strict();

export type PostulacionCanonica = z.infer<typeof esquemaCanonica>;
export type EntradaCanonica = z.infer<typeof esquemaEntrada>;
export type CandidatoCanonico = PostulacionCanonica["candidato"];
export type EntradaCanonicaSinNormalizar = z.input<typeof esquemaEntrada>;

export type ResultadoValidacion<T> = { ok: true; datos: T } | { ok: false; errores: { campo: string; mensaje: string }[] };

function aErrores(error: z.ZodError) {
  return error.issues.slice(0, 20).map((i) => ({ campo: i.path.join(".") || "(raíz)", mensaje: i.message }));
}

/** Valida y normaliza una canónica completa. */
export function validarCanonica(valor: unknown): ResultadoValidacion<PostulacionCanonica> {
  const r = esquemaCanonica.safeParse(valor);
  return r.success ? { ok: true, datos: r.data } : { ok: false, errores: aErrores(r.error) };
}

/** Valida la entrada de una fuente y le pone la fuente del token. */
export function validarEntrada(valor: unknown, fuente: string): ResultadoValidacion<PostulacionCanonica> {
  if (valor && typeof valor === "object" && "fuente" in valor) {
    return { ok: false, errores: [{ campo: "fuente", mensaje: "La fuente la fija el token; no se envía en el cuerpo." }] };
  }
  const r = esquemaEntrada.safeParse(valor);
  return r.success ? { ok: true, datos: { ...r.data, fuente } } : { ok: false, errores: aErrores(r.error) };
}

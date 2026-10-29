import { config } from "@/lib/config";
import { conFalloSimulado, type RutaFallo } from "./fallos";

// Conector HTTP del puente hacia Talentia (API v1 del simulador, docs/contratos.md §3). Es el ÚNICO lugar del puente
// que conoce el formato de Talentia: traduce el modelo interno a sus recursos (postulantes, documentos, postulaciones)
// y clasifica cada fallo para que el procesador decida si reintentar. Autenticación: API Key en `auth_token`.

export type TipoFalloAts = "red" | "servidor" | "autenticacion" | "validacion" | "conflicto";

export class ErrorAts extends Error {
  constructor(
    public tipo: TipoFalloAts,
    message: string,
    public status?: number,
    public codigo?: string,
    public detalle?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ErrorAts";
  }
  /** ¿Puede haber quedado escrita la operación aunque no tengamos respuesta? */
  get resultadoIncierto(): boolean {
    return this.tipo === "red" || this.tipo === "servidor";
  }
}

const timeoutMs = () => Number(process.env.ATS_TIMEOUT_MS ?? 10_000);

export interface OpcionesCliente {
  fetchImpl?: typeof fetch;
}

interface Llamada extends OpcionesCliente {
  cuerpo?: unknown;
  formulario?: FormData;
  claveIdempotencia?: string;
  operacion?: RutaFallo;
}

async function llamar<T>(metodo: "GET" | "POST" | "PATCH", ruta: string, opciones: Llamada): Promise<{ status: number; datos: T }> {
  const cfg = config();
  const fetchImpl = opciones.fetchImpl ?? fetch;
  const headers: Record<string, string> = { auth_token: cfg.ATS_API_KEY, Accept: "application/json" };
  if (opciones.cuerpo !== undefined) headers["Content-Type"] = "application/json";
  if (opciones.claveIdempotencia) headers["Idempotency-Key"] = opciones.claveIdempotencia;

  let r: Response;
  const senal = AbortSignal.timeout(timeoutMs());
  const peticion = () =>
    fetchImpl(`${cfg.ATS_BASE_URL.replace(/\/$/, "")}${ruta}`, {
      method: metodo,
      headers,
      body: opciones.formulario ?? (opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo)),
      signal: senal,
      redirect: "manual",
    });
  try {
    r = opciones.operacion ? await conFalloSimulado(opciones.operacion, senal, peticion) : await peticion();
  } catch (e) {
    const nombre = e instanceof Error ? e.name : "Error";
    const mensaje = nombre === "TimeoutError" ? "El ATS no respondió a tiempo." : "No fue posible conectar con el ATS.";
    throw new ErrorAts("red", mensaje);
  }
  let json: unknown = null;
  const texto = await r.text();
  try {
    json = texto ? JSON.parse(texto) : null;
  } catch {
    json = null;
  }
  if (r.ok) return { status: r.status, datos: (json as { data: T }).data };
  const err = (json as { error?: { codigo?: string; mensaje?: string; detalle?: Record<string, unknown> } } | null)?.error;
  const datosError = [r.status, err?.codigo, err?.detalle] as const;
  if (r.status === 401 || r.status === 403) throw new ErrorAts("autenticacion", "El ATS rechazó las credenciales del puente.", ...datosError);
  if (r.status === 409) throw new ErrorAts("conflicto", err?.mensaje ?? "El ATS reporta un conflicto.", ...datosError);
  if (r.status === 429 || r.status >= 500) throw new ErrorAts("servidor", `El ATS respondió ${r.status}.`, ...datosError);
  throw new ErrorAts("validacion", err?.mensaje ?? `El ATS rechazó la solicitud (${r.status}).`, ...datosError);
}

const S = "/api/v1/seleccion";

interface PostulanteTalentia {
  id: string;
}
interface DocumentoTalentia {
  id: string;
  sha256: string;
}
interface PostulacionTalentia {
  id: string;
  proceso_id: number;
  etapa: { nombre: string };
  referencia_externa: string | null;
}

/**
 * Busca al postulante por correo; si existe lo actualiza, si no lo crea (un postulante por persona).
 * Si otro proceso lo creó entre la búsqueda y la creación (409), se reutiliza.
 */
export async function crearOBuscarCandidato(
  datos: { nombre: string; apellido: string; correo: string; telefono?: string | null; ciudad?: string | null; referenciaExterna: string },
  clave: string,
  o: OpcionesCliente = {},
): Promise<{ id: string; existente: boolean }> {
  const cuerpo = { nombre: datos.nombre, apellido: datos.apellido, correo: datos.correo, telefono: datos.telefono ?? null, ciudad: datos.ciudad ?? null, referencia_externa: datos.referenciaExterna };
  const encontrados = await llamar<PostulanteTalentia[]>("GET", `${S}/postulantes?email=${encodeURIComponent(datos.correo)}`, { ...o, operacion: "candidatos" });
  if (encontrados.datos[0]) {
    const cambios = { nombre: cuerpo.nombre, apellido: cuerpo.apellido, telefono: cuerpo.telefono, ciudad: cuerpo.ciudad, referencia_externa: cuerpo.referencia_externa };
    await llamar<PostulanteTalentia>("PATCH", `${S}/postulantes/${encontrados.datos[0].id}`, { ...o, cuerpo: cambios, claveIdempotencia: `${clave}:actualizar`, operacion: "candidatos" });
    return { id: encontrados.datos[0].id, existente: true };
  }
  try {
    const r = await llamar<PostulanteTalentia>("POST", `${S}/postulantes`, { ...o, cuerpo, claveIdempotencia: clave, operacion: "candidatos" });
    return { id: r.datos.id, existente: false };
  } catch (e) {
    const id = e instanceof ErrorAts && e.codigo === "POSTULANTE_EXISTENTE" ? (e.detalle?.postulante_id as string | undefined) : undefined;
    if (!id) throw e;
    return { id, existente: true };
  }
}

/** Sube el CV como multipart (archivo + sha256). Talentia recalcula el SHA-256 y responde 422 si no coincide. */
export async function subirDocumento(
  candidatoId: string,
  datos: { nombreArchivo: string; tipo: "CV"; bytes: Uint8Array; sha256: string },
  clave: string,
  o: OpcionesCliente = {},
): Promise<DocumentoTalentia> {
  const formulario = new FormData();
  formulario.set("archivo", new File([datos.bytes.slice()], datos.nombreArchivo, { type: "application/pdf" }));
  formulario.set("sha256", datos.sha256);
  formulario.set("tipo", datos.tipo);
  const r = await llamar<DocumentoTalentia>("POST", `${S}/postulantes/${encodeURIComponent(candidatoId)}/documentos`, { ...o, formulario, claveIdempotencia: clave, operacion: "documentos" });
  return r.datos;
}

export async function crearPostulacion(
  datos: { procesoId: number; candidatoId: string; documentoId: string; fuente: string; referenciaExterna: string },
  clave: string,
  o: OpcionesCliente = {},
): Promise<{ id: string }> {
  const cuerpo = { proceso_id: datos.procesoId, postulante_id: datos.candidatoId, documento_id: datos.documentoId, fuente: datos.fuente, referencia_externa: datos.referenciaExterna };
  const r = await llamar<PostulacionTalentia>("POST", `${S}/postulaciones`, { ...o, cuerpo, claveIdempotencia: clave, operacion: "postulaciones" });
  return { id: r.datos.id };
}

/** Consulta por referencia externa para reconciliar (capacidad del simulador; no atribuida a BUK). */
export async function buscarPostulacionPorReferencia(referenciaExterna: string, o: OpcionesCliente = {}) {
  const r = await llamar<PostulacionTalentia[]>("GET", `${S}/postulaciones?referencia_externa=${encodeURIComponent(referenciaExterna)}`, { ...o, operacion: "consulta" });
  return r.datos[0] ?? null;
}

export async function listarProcesos(o: OpcionesCliente = {}) {
  const r = await llamar<{ id: number; titulo: string; estado: string; etapas: { nombre: string }[] }[]>("GET", `${S}/procesos`, o);
  return r.datos.map((p) => ({ id: p.id, nombre: p.titulo, estado: p.estado, etapas: p.etapas.map((e) => e.nombre) }));
}

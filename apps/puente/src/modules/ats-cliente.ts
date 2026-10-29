import { conFalloSimulado, type RutaFallo } from "./fallos";
import { conexionTalentia, marcarContacto, tiempoDeEspera } from "./conexiones";

// Conector HTTP del puente hacia Talentia (API v1 del simulador, docs/contratos.md §3). Es el ÚNICO lugar del puente
// que conoce el formato de Talentia: traduce el modelo interno a sus recursos (postulantes, documentos, postulaciones)
// y clasifica cada fallo para que el procesador decida si reintentar. Autenticación: API Key en `auth_token`.

export type TipoFalloAts = "sin_conexion" | "red" | "servidor" | "autenticacion" | "permiso" | "validacion" | "conflicto";

export class ErrorAts extends Error {
  constructor(
    public tipo: TipoFalloAts,
    message: string,
    public status?: number,
    public codigo?: string,
    public detalle?: Record<string, unknown>,
    /** Segundos de Retry-After (429). */
    public reintentarEn?: number,
  ) {
    super(message);
    this.name = "ErrorAts";
  }
  /** ¿Puede haber quedado escrita la operación aunque no tengamos respuesta? */
  get resultadoIncierto(): boolean {
    return this.tipo === "red" || (this.tipo === "servidor" && this.status !== 429);
  }
}

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
  const c = await conexionTalentia();
  if (!c) throw new ErrorAts("sin_conexion", "El puente no tiene configurada la conexión con Talentia (ver Conexiones).");
  const fetchImpl = opciones.fetchImpl ?? fetch;
  const headers: Record<string, string> = { auth_token: c.apiKey, Accept: "application/json" };
  if (opciones.cuerpo !== undefined) headers["Content-Type"] = "application/json";
  if (opciones.claveIdempotencia) headers["Idempotency-Key"] = opciones.claveIdempotencia;

  let r: Response;
  const senal = AbortSignal.timeout(Number(process.env.ATS_TIMEOUT_MS ?? 0) || (await tiempoDeEspera("TALENTIA")));
  const peticion = () =>
    fetchImpl(`${c.urlBase}${ruta}`, {
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
    const mensaje = nombre === "TimeoutError" ? "Talentia no respondió a tiempo." : "No fue posible conectar con Talentia.";
    throw new ErrorAts("red", mensaje);
  }
  await marcarContacto("TALENTIA");
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
  if (r.status === 401) throw new ErrorAts("autenticacion", "La API Key de Talentia fue revocada o no es válida.", ...datosError);
  if (r.status === 403) throw new ErrorAts("permiso", err?.mensaje ?? "La API Key de Talentia no tiene el permiso necesario.", ...datosError);
  if (r.status === 409) throw new ErrorAts("conflicto", err?.mensaje ?? "Talentia reporta un conflicto.", ...datosError);
  if (r.status === 429) {
    const espera = Number(r.headers.get("retry-after") ?? "60");
    throw new ErrorAts("servidor", `Talentia limitó las solicitudes (429); se reintenta en ${espera} s.`, ...datosError, Number.isFinite(espera) ? espera : 60);
  }
  if (r.status >= 500) throw new ErrorAts("servidor", `Talentia respondió ${r.status}.`, ...datosError);
  throw new ErrorAts("validacion", err?.mensaje ?? `Talentia rechazó la solicitud (${r.status}).`, ...datosError);
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
export interface ProcesoTalentia {
  id: number;
  titulo: string;
  area: string;
  ciudad: string;
  descripcion: string;
  prioridad: string;
  estado: string;
  total_postulaciones: number;
  etapas: { nombre: string }[];
}

/**
 * Busca al postulante por correo; si existe lo actualiza, si no lo crea (un postulante por persona).
 * Si otro proceso lo creó entre la búsqueda y la creación (409), se reutiliza.
 */
export async function crearOBuscarPostulante(
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
  postulanteId: string,
  datos: { nombreArchivo: string; tipo: "CV"; bytes: Uint8Array; sha256: string },
  clave: string,
  o: OpcionesCliente = {},
): Promise<DocumentoTalentia> {
  const formulario = new FormData();
  formulario.set("archivo", new File([datos.bytes.slice()], datos.nombreArchivo, { type: "application/pdf" }));
  formulario.set("sha256", datos.sha256);
  formulario.set("tipo", datos.tipo);
  const r = await llamar<DocumentoTalentia>("POST", `${S}/postulantes/${encodeURIComponent(postulanteId)}/documentos`, { ...o, formulario, claveIdempotencia: clave, operacion: "documentos" });
  return r.datos;
}

export async function crearPostulacion(
  datos: { procesoId: number; postulanteId: string; documentoId: string; fuente: string; referenciaExterna: string },
  clave: string,
  o: OpcionesCliente = {},
): Promise<{ id: string }> {
  const cuerpo = { proceso_id: datos.procesoId, postulante_id: datos.postulanteId, documento_id: datos.documentoId, fuente: datos.fuente, referencia_externa: datos.referenciaExterna };
  const r = await llamar<PostulacionTalentia>("POST", `${S}/postulaciones`, { ...o, cuerpo, claveIdempotencia: clave, operacion: "postulaciones" });
  return { id: r.datos.id };
}

/** Consulta por referencia externa para reconciliar (capacidad del simulador; no atribuida a BUK). */
export async function buscarPostulacionPorReferencia(referenciaExterna: string, o: OpcionesCliente = {}) {
  const r = await llamar<PostulacionTalentia[]>("GET", `${S}/postulaciones?referencia_externa=${encodeURIComponent(referenciaExterna)}`, { ...o, operacion: "consulta" });
  return r.datos[0] ?? null;
}

export async function listarProcesos(o: OpcionesCliente = {}) {
  return (await llamar<ProcesoTalentia[]>("GET", `${S}/procesos`, o)).datos;
}

export async function obtenerProceso(id: number, o: OpcionesCliente = {}) {
  return (await llamar<ProcesoTalentia>("GET", `${S}/procesos/${id}`, o)).datos;
}

export interface LlaveTalentia {
  nombre: string;
  prefijo: string;
  permisos: { seleccion: { lectura: boolean; modificacion: boolean } };
}
export async function llaveActual(o: OpcionesCliente = {}) {
  return (await llamar<LlaveTalentia>("GET", "/api/v1/api-key", o)).datos;
}

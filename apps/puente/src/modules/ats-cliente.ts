import { config } from "@/lib/config";
import { conFalloSimulado, type RutaFallo } from "./fallos";

// Cliente HTTP del puente hacia el ATS simulado. Contrato del simulador (docs/contratos.md §ATS),
// no atribuido a BUK. Clasifica cada fallo para que el procesador decida si reintentar.

export type TipoFalloAts = "red" | "servidor" | "autenticacion" | "validacion" | "conflicto";

export class ErrorAts extends Error {
  constructor(
    public tipo: TipoFalloAts,
    message: string,
    public status?: number,
    public cuerpo?: unknown,
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

async function llamar<T>(
  metodo: "GET" | "POST",
  ruta: string,
  opciones: OpcionesCliente & { cuerpo?: unknown; claveIdempotencia?: string; operacion?: RutaFallo },
): Promise<{ status: number; datos: T }> {
  const cfg = config();
  const fetchImpl = opciones.fetchImpl ?? fetch;
  const headers: Record<string, string> = { Authorization: `Bearer ${cfg.ATS_API_KEY}`, Accept: "application/json" };
  if (opciones.cuerpo !== undefined) headers["Content-Type"] = "application/json";
  if (opciones.claveIdempotencia) headers["Idempotency-Key"] = opciones.claveIdempotencia;

  let r: Response;
  const senal = AbortSignal.timeout(timeoutMs());
  const peticion = () =>
    fetchImpl(`${cfg.ATS_BASE_URL}${ruta}`, {
      method: metodo,
      headers,
      body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
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
  let datos: unknown = null;
  const texto = await r.text();
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = texto;
  }
  if (r.ok) return { status: r.status, datos: datos as T };
  if (r.status === 401 || r.status === 403) throw new ErrorAts("autenticacion", "El ATS rechazó las credenciales del puente.", r.status, datos);
  if (r.status === 409) throw new ErrorAts("conflicto", "El ATS reporta un conflicto.", r.status, datos);
  if (r.status === 429 || r.status >= 500) throw new ErrorAts("servidor", `El ATS respondió ${r.status}.`, r.status, datos);
  throw new ErrorAts("validacion", `El ATS rechazó la solicitud (${r.status}).`, r.status, datos);
}

export interface CandidatoAts {
  id: string;
  existente: boolean;
}
export interface DocumentoAts {
  id: string;
  sha256: string;
}
export interface PostulacionAts {
  id: string;
  procesoId: number;
  etapa: string;
  referenciaExterna: string;
}

export function crearOBuscarCandidato(
  datos: { nombre: string; apellido: string; correo: string; telefono?: string | null; ciudad?: string | null; referenciaExterna: string },
  clave: string,
  o: OpcionesCliente = {},
) {
  return llamar<CandidatoAts>("POST", "/candidatos", { ...o, cuerpo: datos, claveIdempotencia: clave, operacion: "candidatos" }).then((r) => r.datos);
}

export function subirDocumento(
  candidatoId: string,
  datos: { nombreArchivo: string; tipo: "CV"; contenidoBase64: string; sha256: string },
  clave: string,
  o: OpcionesCliente = {},
) {
  return llamar<DocumentoAts>("POST", `/candidatos/${encodeURIComponent(candidatoId)}/documentos`, {
    ...o,
    cuerpo: datos,
    claveIdempotencia: clave,
    operacion: "documentos",
  }).then((r) => r.datos);
}

export function crearPostulacion(
  datos: { procesoId: number; candidatoId: string; documentoId: string; fuente: string; referenciaExterna: string },
  clave: string,
  o: OpcionesCliente = {},
) {
  return llamar<PostulacionAts>("POST", "/postulaciones", { ...o, cuerpo: datos, claveIdempotencia: clave, operacion: "postulaciones" }).then((r) => r.datos);
}

/** Consulta por referencia externa (capacidad del simulador para reconciliar; no atribuida a BUK). */
export async function buscarPostulacionPorReferencia(referenciaExterna: string, o: OpcionesCliente = {}) {
  const r = await llamar<{ resultados: PostulacionAts[] }>(
    "GET",
    `/postulaciones?referenciaExterna=${encodeURIComponent(referenciaExterna)}`,
    { ...o, operacion: "consulta" },
  );
  return r.datos.resultados[0] ?? null;
}

export async function listarProcesos(o: OpcionesCliente = {}) {
  const r = await llamar<{ resultados: { id: number; nombre: string; estado: string; etapas: string[] }[] }>("GET", "/procesos", o);
  return r.datos.resultados;
}

import { conFalloSimulado, type RutaFallo } from "@/modules/fallos";
import { conexionTalentia, marcarContacto, tiempoDeEspera } from "@/modules/conexiones";
import {
  ErrorConectorATS,
  type ArchivoCV,
  type ConectorATS,
  type DatosCandidato,
  type ExtraPostulacion,
  type ExtraPostulante,
  type PostulacionATS,
  type ProcesoATS,
  type ResultadoConexion,
} from "../conector-ats";

// Adaptador de salida para Talentia (ATS **simulado**, API v1 del simulador: docs/contratos.md §3 y §6). Es el ÚNICO
// lugar del Puente que conoce las rutas y el formato de Talentia (traslado del ats-cliente de la v2, sin cambiar su
// comportamiento). Autenticación: API Key en `auth_token` (Supuesto pendiente, D-26). Nada de esto se atribuye a BUK.

export interface OpcionesTalentia {
  fetchImpl?: typeof fetch;
}

interface Llamada {
  cuerpo?: unknown;
  formulario?: FormData;
  claveIdempotencia?: string;
  operacion?: RutaFallo;
}

const S = "/api/v1/seleccion";

interface PostulacionTalentia {
  id: string;
  proceso_id: number;
  postulante_id: string;
  etapa: { nombre: string };
  referencia_externa: string | null;
}
interface ProcesoTalentia {
  id: number;
  titulo: string;
  area: string;
  ciudad: string;
  descripcion: string;
  prioridad: string;
  estado: string;
  total_postulaciones: number;
}
interface LlaveTalentia {
  nombre: string;
  prefijo: string;
  permisos: { seleccion: { lectura: boolean; modificacion: boolean } };
}

const aPostulacion = (p: PostulacionTalentia): PostulacionATS => ({ id: p.id, idProceso: String(p.proceso_id), idPostulante: p.postulante_id });

export function crearConectorTalentia(opciones: OpcionesTalentia = {}): ConectorATS {
  async function llamar<T>(metodo: "GET" | "POST" | "PATCH", ruta: string, o: Llamada = {}): Promise<{ status: number; datos: T }> {
    const c = await conexionTalentia();
    if (!c) throw new ErrorConectorATS("sin_conexion", "El puente no tiene configurada la conexión con el Simulador BUK (ver Conexiones).");
    const fetchImpl = opciones.fetchImpl ?? fetch;
    const headers: Record<string, string> = { auth_token: c.apiKey, Accept: "application/json" };
    if (o.cuerpo !== undefined) headers["Content-Type"] = "application/json";
    if (o.claveIdempotencia) headers["Idempotency-Key"] = o.claveIdempotencia;

    let r: Response;
    const senal = AbortSignal.timeout(Number(process.env.ATS_TIMEOUT_MS ?? 0) || (await tiempoDeEspera("TALENTIA")));
    const peticion = () =>
      fetchImpl(`${c.urlBase}${ruta}`, {
        method: metodo,
        headers,
        body: o.formulario ?? (o.cuerpo === undefined ? undefined : JSON.stringify(o.cuerpo)),
        signal: senal,
        redirect: "manual",
      });
    try {
      r = o.operacion ? await conFalloSimulado(o.operacion, senal, peticion) : await peticion();
    } catch (e) {
      const nombre = e instanceof Error ? e.name : "Error";
      const mensaje = nombre === "TimeoutError" ? "El Simulador BUK no respondió a tiempo." : "No fue posible conectar con el Simulador BUK.";
      throw new ErrorConectorATS("red", mensaje);
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
    if (r.status === 401) throw new ErrorConectorATS("autenticacion", "La API Key del Simulador BUK fue revocada o no es válida.", ...datosError);
    if (r.status === 403) throw new ErrorConectorATS("permiso", err?.mensaje ?? "La API Key del Simulador BUK no tiene el permiso necesario.", ...datosError);
    if (r.status === 409) throw new ErrorConectorATS("conflicto", err?.mensaje ?? "El Simulador BUK reporta un conflicto.", ...datosError);
    if (r.status === 429) {
      const espera = Number(r.headers.get("retry-after") ?? "60");
      throw new ErrorConectorATS("servidor", `El Simulador BUK limitó las solicitudes (429); se reintenta en ${espera} s.`, ...datosError, Number.isFinite(espera) ? espera : 60);
    }
    if (r.status >= 500) throw new ErrorConectorATS("servidor", `El Simulador BUK respondió ${r.status}.`, ...datosError);
    throw new ErrorConectorATS("validacion", err?.mensaje ?? `El Simulador BUK rechazó la solicitud (${r.status}).`, ...datosError);
  }

  return {
    nombre: "talentia",
    capacidades: { adjuntarCV: true, buscarPorCorreo: true, idempotencia: true },

    /** Consulta la llave (permisos de Selección) y lista los procesos. */
    async verificarConexion(): Promise<ResultadoConexion> {
      const llave = (await llamar<LlaveTalentia>("GET", "/api/v1/api-key")).datos;
      const procesos = (await llamar<ProcesoTalentia[]>("GET", `${S}/procesos`)).datos;
      const { lectura, modificacion } = llave.permisos.seleccion;
      const faltan = !lectura || !modificacion;
      const detalle = `Llave «${llave.nombre}» (${llave.prefijo}…): Lectura ${lectura ? "sí" : "no"}, Modificación ${modificacion ? "sí" : "no"}. ${procesos.length} procesos visibles.${
        faltan ? " El puente necesita ambos permisos de Selección." : ""
      }`;
      return { ok: !faltan, detalle, extra: { permisoLectura: lectura, permisoEscritura: modificacion } };
    },

    async listarProcesos(): Promise<ProcesoATS[]> {
      const datos = (await llamar<ProcesoTalentia[]>("GET", `${S}/procesos`)).datos;
      return datos.map((p) => ({
        id: String(p.id),
        titulo: p.titulo,
        estado: p.estado,
        area: p.area,
        ciudad: p.ciudad,
        descripcion: p.descripcion,
        prioridad: p.prioridad,
        totalPostulaciones: p.total_postulaciones,
      }));
    },

    async buscarPostulante({ correo }) {
      const r = await llamar<{ id: string }[]>("GET", `${S}/postulantes?email=${encodeURIComponent(correo)}`, { operacion: "candidatos" });
      return r.datos[0] ? { id: r.datos[0].id, existente: true } : null;
    },

    /**
     * Busca al postulante por correo; si existe lo actualiza, si no lo crea (un postulante por persona).
     * Si otro proceso lo creó entre la búsqueda y la creación (409), se reutiliza.
     */
    async crearPostulante(datos: DatosCandidato, clave: string, extra: ExtraPostulante = {}) {
      const cuerpo = {
        nombre: datos.nombres,
        apellido: datos.apellidos ?? "",
        correo: datos.correo ?? "",
        telefono: datos.telefono ?? null,
        ciudad: datos.ciudad ?? null,
        referencia_externa: extra.referenciaExterna ?? null,
      };
      const encontrados = await llamar<{ id: string }[]>("GET", `${S}/postulantes?email=${encodeURIComponent(cuerpo.correo)}`, { operacion: "candidatos" });
      if (encontrados.datos[0]) {
        const cambios = { nombre: cuerpo.nombre, apellido: cuerpo.apellido, telefono: cuerpo.telefono, ciudad: cuerpo.ciudad, referencia_externa: cuerpo.referencia_externa };
        await llamar("PATCH", `${S}/postulantes/${encontrados.datos[0].id}`, { cuerpo: cambios, claveIdempotencia: `${clave}:actualizar`, operacion: "candidatos" });
        return { id: encontrados.datos[0].id, existente: true };
      }
      try {
        const r = await llamar<{ id: string }>("POST", `${S}/postulantes`, { cuerpo, claveIdempotencia: clave, operacion: "candidatos" });
        return { id: r.datos.id, existente: false };
      } catch (e) {
        const id = e instanceof ErrorConectorATS && e.codigo === "POSTULANTE_EXISTENTE" ? (e.detalle?.postulante_id as string | undefined) : undefined;
        if (!id) throw e;
        return { id, existente: true };
      }
    },

    /** Sube el CV como multipart (archivo + sha256). Talentia recalcula el SHA-256 y responde 422 si no coincide. */
    async adjuntarCV(idPostulante: string, cv: ArchivoCV, clave: string) {
      const formulario = new FormData();
      formulario.set("archivo", new File([cv.bytes.slice()], cv.nombreArchivo, { type: "application/pdf" }));
      formulario.set("sha256", cv.sha256);
      formulario.set("tipo", "CV");
      const r = await llamar<{ id: string; sha256: string }>("POST", `${S}/postulantes/${encodeURIComponent(idPostulante)}/documentos`, {
        formulario,
        claveIdempotencia: clave,
        operacion: "documentos",
      });
      return { idDocumento: r.datos.id };
    },

    async crearPostulacion(idPostulante: string, idProceso: string, clave: string, extra: ExtraPostulacion = {}) {
      const cuerpo = {
        proceso_id: Number(idProceso),
        postulante_id: idPostulante,
        documento_id: extra.idDocumento ?? null,
        fuente: extra.fuente ?? "Puente de postulaciones",
        referencia_externa: extra.referenciaExterna ?? null,
      };
      const r = await llamar<PostulacionTalentia>("POST", `${S}/postulaciones`, { cuerpo, claveIdempotencia: clave, operacion: "postulaciones" });
      return { id: r.datos.id, idProceso, idPostulante };
    },

    /** Reconciliación: ¿ya existe la postulación de esa persona en ese proceso? (capacidad del simulador). */
    async consultarPostulacion(idPostulante: string, idProceso: string) {
      const r = await llamar<PostulacionTalentia[]>("GET", `${S}/postulaciones?proceso_id=${encodeURIComponent(idProceso)}`, { operacion: "consulta" });
      const p = r.datos.find((x) => x.postulante_id === idPostulante);
      return p ? aPostulacion(p) : null;
    },
  };
}

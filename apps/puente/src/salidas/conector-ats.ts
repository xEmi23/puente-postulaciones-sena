import type { CandidatoCanonico } from "@/nucleo/contrato/canonica";

// Interfaz de salida hacia un ATS (ESPECIFICACION_V4 §9). El procesador solo habla con esto; las rutas y formatos de
// cada ATS viven en su adaptador (salidas/talentia, salidas/buk). Los parámetros `extra` son opcionales y conservan
// lo que la v2 ya enviaba a Talentia (documento vinculado, fuente visible y referencia externa); un ATS que no los
// use los ignora (D-54).

export type NombreATS = "talentia" | "buk";

export interface CapacidadesATS {
  adjuntarCV: boolean;
  buscarPorCorreo: boolean;
  idempotencia: boolean;
}

export interface ResultadoConexion {
  ok: boolean;
  detalle: string;
  /** Datos propios del ATS para mostrar (p. ej., permisos de la llave). */
  extra?: Record<string, unknown>;
}

export interface ProcesoATS {
  id: string;
  titulo: string;
  /** INICIADO | CERRADO u otro valor propio del ATS. */
  estado: string;
  area?: string;
  ciudad?: string;
  descripcion?: string;
  prioridad?: string;
  totalPostulaciones?: number;
}

export interface PostulanteATS {
  id: string;
  /** true si ya existía (p. ej., el mismo correo) y se actualizó en vez de crear otro. */
  existente?: boolean;
}

export interface PostulacionATS {
  id: string;
  idProceso: string;
  idPostulante: string;
}

export interface ArchivoCV {
  nombreArchivo: string;
  tipo: "application/pdf";
  bytes: Uint8Array;
  sha256: string;
}

/** Candidato tal como lo entrega el núcleo: los nombres siempre; el resto, si existe. */
export type DatosCandidato = Pick<CandidatoCanonico, "nombres"> & Partial<Omit<CandidatoCanonico, "nombres">>;

export interface ExtraPostulante {
  referenciaExterna?: string;
}

export interface ExtraPostulacion {
  idDocumento?: string;
  /** Texto visible de la fuente en el ATS. */
  fuente?: string;
  referenciaExterna?: string;
}

export interface ConectorATS {
  nombre: NombreATS;
  capacidades: CapacidadesATS;
  verificarConexion(): Promise<ResultadoConexion>;
  listarProcesos(): Promise<ProcesoATS[]>;
  buscarPostulante(criterio: { correo: string }): Promise<PostulanteATS | null>;
  /** Crea el postulante; si el ATS ya tiene a la persona (mismo correo), la actualiza y la devuelve con existente = true. */
  crearPostulante(datos: DatosCandidato, clave: string, extra?: ExtraPostulante): Promise<PostulanteATS>;
  /** Devuelve el id del documento si el ATS lo informa (la interfaz de la §9 declara void; ver D-54). */
  adjuntarCV(idPostulante: string, cv: ArchivoCV, clave: string): Promise<{ idDocumento?: string } | void>;
  crearPostulacion(idPostulante: string, idProceso: string, clave: string, extra?: ExtraPostulacion): Promise<PostulacionATS>;
  consultarPostulacion(idPostulante: string, idProceso: string): Promise<PostulacionATS | null>;
}

export type TipoFalloATS = "sin_conexion" | "red" | "servidor" | "autenticacion" | "permiso" | "validacion" | "conflicto" | "no_implementado";

/** Error común de cualquier adaptador de salida; el procesador decide con él si reintentar, detener o rechazar. */
export class ErrorConectorATS extends Error {
  constructor(
    public tipo: TipoFalloATS,
    message: string,
    public status?: number,
    public codigo?: string,
    public detalle?: Record<string, unknown>,
    /** Segundos de Retry-After (429). */
    public reintentarEn?: number,
  ) {
    super(message);
    this.name = "ErrorConectorATS";
  }
  /** ¿Puede haber quedado escrita la operación aunque no tengamos respuesta? */
  get resultadoIncierto(): boolean {
    return this.tipo === "red" || (this.tipo === "servidor" && this.status !== 429);
  }
}

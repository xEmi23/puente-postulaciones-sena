import { createHash, randomUUID } from "node:crypto";

// Dobles de prueba de los sistemas externos, escritos desde su contrato HTTP (docs/contratos.md),
// sin importar código de Vínculo ni de Talentia (cada app es independiente).
// Las pruebas de contrato de cada simulador verifican que el sistema real cumple el mismo contrato.

const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Vínculo: solo la URL privada del CV (mediaUrl con Bearer y expiración). */
export class VinculoDoble {
  archivos = new Map<string, { bytes: Uint8Array; nombre: string; expiraEn: number }>();
  descargas = 0;

  constructor(
    private base: string,
    private token: () => string,
  ) {}

  reiniciar() {
    this.archivos.clear();
    this.descargas = 0;
  }

  agregarCv(bytes: Uint8Array, nombre = "cv.pdf", expiraEn = Date.now() + 30 * 86_400_000) {
    const id = randomUUID();
    this.archivos.set(id, { bytes, nombre, expiraEn });
    return { mediaUrl: `${this.base}/api/origen/media/${id}`, mediaUrn: `urn:li:media:${id}` };
  }

  async atender(req: Request): Promise<Response> {
    const m = new URL(req.url).pathname.match(/^\/api\/origen\/media\/([^/]+)$/);
    if (!m) return json(404, { mensaje: "No existe." });
    if (req.headers.get("authorization") !== `Bearer ${this.token()}`) return json(401, { mensaje: "Token inválido." });
    const a = this.archivos.get(m[1]);
    if (!a) return json(404, { mensaje: "No existe." });
    if (a.expiraEn < Date.now()) return json(410, { mensaje: "Expiró." });
    this.descargas++;
    return new Response(a.bytes.slice(), {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Length": String(a.bytes.length), "Content-Disposition": `attachment; filename="${a.nombre}"` },
    });
  }
}

interface Postulacion {
  id: string;
  procesoId: number;
  candidatoId: string;
  documentoId?: string | null;
  fuente: string;
  referenciaExterna: string;
  etapa: string;
}

/** Talentia: la API v1 del simulador (candidatos, documentos, postulaciones, procesos), con Idempotency-Key. */
export class TalentiaDoble {
  candidatos = new Map<string, { id: string; correo: string; nombre: string; apellido: string; telefono?: string | null }>();
  documentos: { id: string; candidatoId: string; sha256: string; bytes: Uint8Array }[] = [];
  postulaciones: Postulacion[] = [];
  procesos = [
    { id: 9001, nombre: "Desarrollador/a Backend Java", estado: "INICIADO" },
    { id: 9002, nombre: "Analista de Calidad de Software (QA)", estado: "INICIADO" },
  ];
  private claves = new Map<string, { hash: string; status: number; body: unknown }>();

  constructor(private apiKey: () => string) {}

  reiniciar() {
    this.candidatos.clear();
    this.documentos = [];
    this.postulaciones = [];
    this.claves.clear();
  }

  conteo() {
    return { candidatos: this.candidatos.size, documentos: this.documentos.length, postulaciones: this.postulaciones.length };
  }

  /** Crea un candidato por fuera del puente (p. ej., llegó por otra vacante). */
  crearCandidato(datos: { nombre: string; apellido: string; correo: string }) {
    const correo = datos.correo.toLowerCase();
    const existente = [...this.candidatos.values()].find((c) => c.correo === correo);
    if (existente) return existente;
    const c = { id: randomUUID(), ...datos, correo };
    this.candidatos.set(c.id, c);
    return c;
  }

  async atender(req: Request): Promise<Response> {
    if (req.headers.get("authorization") !== `Bearer ${this.apiKey()}`) return json(401, { codigo: "NO_AUTORIZADO", mensaje: "Credenciales inválidas." });
    const url = new URL(req.url);
    const ruta = url.pathname.replace(/^\/api\/ats\/v1/, "");
    if (req.method === "GET" && ruta === "/procesos") return json(200, { resultados: this.procesos.map((p) => ({ ...p, etapas: ["Postulantes"] })) });
    if (req.method === "GET" && ruta === "/postulaciones") {
      const ref = url.searchParams.get("referenciaExterna");
      return json(200, { resultados: this.postulaciones.filter((p) => p.referenciaExterna === ref) });
    }
    if (req.method !== "POST") return json(404, { codigo: "NO_EXISTE", mensaje: "Ruta inexistente." });
    const crudo = await req.text();
    const clave = req.headers.get("idempotency-key");
    const hash = sha(new TextEncoder().encode(`${ruta}\n${crudo}`));
    if (clave) {
      const previa = this.claves.get(clave);
      if (previa) return previa.hash === hash ? json(previa.status, previa.body) : json(422, { codigo: "CLAVE_REUTILIZADA", mensaje: "Clave reutilizada." });
    }
    const { status, body } = this.escribir(ruta, JSON.parse(crudo));
    if (clave && status < 500) this.claves.set(clave, { hash, status, body });
    return json(status, body);
  }

  private escribir(ruta: string, d: Record<string, unknown>): { status: number; body: unknown } {
    if (ruta === "/candidatos") {
      const correo = String(d.correo).toLowerCase();
      const existente = [...this.candidatos.values()].find((c) => c.correo === correo);
      if (existente) return { status: 200, body: { id: existente.id, existente: true } };
      const c = { id: randomUUID(), correo, nombre: String(d.nombre), apellido: String(d.apellido), telefono: (d.telefono as string) ?? null };
      this.candidatos.set(c.id, c);
      return { status: 201, body: { id: c.id, existente: false } };
    }
    const m = ruta.match(/^\/candidatos\/([^/]+)\/documentos$/);
    if (m) {
      if (!this.candidatos.has(m[1])) return { status: 404, body: { codigo: "CANDIDATO_NO_EXISTE", mensaje: "No existe." } };
      const bytes = new Uint8Array(Buffer.from(String(d.contenidoBase64), "base64"));
      if (sha(bytes) !== d.sha256) return { status: 422, body: { codigo: "HASH_NO_COINCIDE", mensaje: "El SHA-256 no coincide." } };
      const doc = { id: randomUUID(), candidatoId: m[1], sha256: String(d.sha256), bytes };
      this.documentos.push(doc);
      return { status: 201, body: { id: doc.id, sha256: doc.sha256 } };
    }
    if (ruta === "/postulaciones") {
      const ref = String(d.referenciaExterna);
      const porRef = this.postulaciones.find((p) => p.referenciaExterna === ref);
      if (porRef) return { status: 200, body: porRef };
      const proceso = this.procesos.find((p) => p.id === d.procesoId);
      if (!proceso) return { status: 404, body: { codigo: "PROCESO_NO_EXISTE", mensaje: "No existe." } };
      if (proceso.estado !== "INICIADO") return { status: 422, body: { codigo: "PROCESO_CERRADO", mensaje: "Cerrado." } };
      const misma = this.postulaciones.find((p) => p.procesoId === proceso.id && p.candidatoId === d.candidatoId);
      if (misma) return { status: 409, body: { codigo: "POSTULACION_EXISTENTE", mensaje: "Ya existe.", postulacionId: misma.id } };
      const p: Postulacion = {
        id: randomUUID(),
        procesoId: proceso.id,
        candidatoId: String(d.candidatoId),
        documentoId: (d.documentoId as string) ?? null,
        fuente: String(d.fuente),
        referenciaExterna: ref,
        etapa: "Postulantes",
      };
      this.postulaciones.push(p);
      return { status: 201, body: p };
    }
    return { status: 404, body: { codigo: "NO_EXISTE", mensaje: "Ruta inexistente." } };
  }
}

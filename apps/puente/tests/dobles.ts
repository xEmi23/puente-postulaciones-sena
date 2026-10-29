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

const errorTal = (status: number, codigo: string, mensaje: string, detalle?: Record<string, unknown>) =>
  json(status, { error: detalle ? { codigo, mensaje, detalle } : { codigo, mensaje } });

/**
 * Talentia: la API v1 del simulador (postulantes, documentos multipart, postulaciones, procesos), con la API Key en
 * `auth_token`, errores { error: { codigo, mensaje, detalle } } e Idempotency-Key.
 */
export class TalentiaDoble {
  candidatos = new Map<string, { id: string; correo: string; nombre: string; apellido: string; telefono?: string | null; ciudad?: string | null }>();
  documentos: { id: string; candidatoId: string; sha256: string; bytes: Uint8Array }[] = [];
  postulaciones: Postulacion[] = [];
  procesos = [
    { id: 9001, titulo: "Desarrollador/a Backend Java", estado: "INICIADO" },
    { id: 9002, titulo: "Analista de Calidad de Software (QA)", estado: "INICIADO" },
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

  /** Crea un postulante por fuera del puente (p. ej., llegó por otra vacante). */
  crearCandidato(datos: { nombre: string; apellido: string; correo: string }) {
    const correo = datos.correo.toLowerCase();
    const existente = [...this.candidatos.values()].find((c) => c.correo === correo);
    if (existente) return existente;
    const c = { id: randomUUID(), ...datos, correo };
    this.candidatos.set(c.id, c);
    return c;
  }

  private vistaPostulacion = (p: Postulacion) => ({
    id: p.id,
    proceso_id: p.procesoId,
    postulante_id: p.candidatoId,
    documento_id: p.documentoId ?? null,
    etapa: { id: "00000000-0000-4000-8000-000000000001", nombre: p.etapa, orden: 1 },
    fuente: p.fuente,
    referencia_externa: p.referenciaExterna,
  });

  async atender(req: Request): Promise<Response> {
    if (req.headers.get("auth_token") !== this.apiKey()) return errorTal(401, "NO_AUTORIZADO", "La API Key no es válida.");
    const url = new URL(req.url);
    const ruta = url.pathname.replace(/^\/api\/v1\/seleccion/, "");
    if (req.method === "GET") {
      if (ruta === "/procesos") return json(200, { data: this.procesos.map((p) => ({ ...p, etapas: [{ nombre: "Postulantes" }] })) });
      if (ruta === "/postulantes") {
        const email = url.searchParams.get("email")?.toLowerCase();
        return json(200, { data: [...this.candidatos.values()].filter((c) => c.correo === email), paginacion: { pagina: 1, por_pagina: 25, total: 0 } });
      }
      if (ruta === "/postulaciones") {
        const ref = url.searchParams.get("referencia_externa");
        return json(200, { data: this.postulaciones.filter((p) => p.referenciaExterna === ref).map(this.vistaPostulacion) });
      }
      return errorTal(404, "NO_ENCONTRADO", "Ruta inexistente.");
    }
    const multipart = /\/documentos$/.test(ruta);
    const form = multipart ? await req.formData() : null;
    const crudo = multipart ? `${form!.get("sha256")}` : await req.text();
    const clave = req.headers.get("idempotency-key");
    const hash = sha(new TextEncoder().encode(`${req.method} ${ruta}\n${crudo}`));
    if (clave) {
      const previa = this.claves.get(clave);
      if (previa) return previa.hash === hash ? json(previa.status, previa.body) : errorTal(422, "CLAVE_REUTILIZADA", "Clave reutilizada.");
    }
    const { status, body } = await this.escribir(req.method, ruta, multipart ? form! : JSON.parse(crudo));
    if (clave && status < 500) this.claves.set(clave, { hash, status, body });
    return json(status, body);
  }

  private async escribir(metodo: string, ruta: string, d: Record<string, unknown> | FormData): Promise<{ status: number; body: unknown }> {
    const error = (status: number, codigo: string, mensaje: string, detalle?: Record<string, unknown>) => ({ status, body: { error: detalle ? { codigo, mensaje, detalle } : { codigo, mensaje } } });
    if (metodo === "POST" && ruta === "/postulantes") {
      const datos = d as Record<string, unknown>;
      const correo = String(datos.correo).toLowerCase();
      const existente = [...this.candidatos.values()].find((c) => c.correo === correo);
      if (existente) return error(409, "POSTULANTE_EXISTENTE", "Ya existe.", { postulante_id: existente.id });
      const c = { id: randomUUID(), correo, nombre: String(datos.nombre), apellido: String(datos.apellido), telefono: (datos.telefono as string) ?? null, ciudad: (datos.ciudad as string) ?? null };
      this.candidatos.set(c.id, c);
      return { status: 201, body: { data: c } };
    }
    const mp = ruta.match(/^\/postulantes\/([^/]+)$/);
    if (metodo === "PATCH" && mp) {
      const c = this.candidatos.get(mp[1]);
      if (!c) return error(404, "NO_ENCONTRADO", "No existe.");
      Object.assign(c, d);
      return { status: 200, body: { data: c } };
    }
    const md = ruta.match(/^\/postulantes\/([^/]+)\/documentos$/);
    if (metodo === "POST" && md) {
      const form = d as FormData;
      if (!this.candidatos.has(md[1])) return error(404, "NO_ENCONTRADO", "No existe.");
      const archivo = form.get("archivo");
      const bytes = archivo instanceof Blob ? new Uint8Array(await archivo.arrayBuffer()) : new Uint8Array();
      if (sha(bytes) !== form.get("sha256")) return error(422, "HASH_NO_COINCIDE", "El SHA-256 no coincide.");
      const doc = { id: randomUUID(), candidatoId: md[1], sha256: String(form.get("sha256")), bytes };
      this.documentos.push(doc);
      return { status: 201, body: { data: { id: doc.id, sha256: doc.sha256 } } };
    }
    if (metodo === "POST" && ruta === "/postulaciones") {
      const datos = d as Record<string, unknown>;
      const ref = String(datos.referencia_externa);
      const porRef = this.postulaciones.find((p) => p.referenciaExterna === ref);
      if (porRef) return { status: 200, body: { data: this.vistaPostulacion(porRef) } };
      const proceso = this.procesos.find((p) => p.id === datos.proceso_id);
      if (!proceso) return error(404, "PROCESO_NO_EXISTE", "No existe.");
      if (proceso.estado !== "INICIADO") return error(422, "PROCESO_CERRADO", "Cerrado.");
      const misma = this.postulaciones.find((p) => p.procesoId === proceso.id && p.candidatoId === datos.postulante_id);
      if (misma) return error(409, "POSTULACION_EXISTENTE", "Ya existe.", { postulacion_id: misma.id });
      const p: Postulacion = {
        id: randomUUID(),
        procesoId: proceso.id,
        candidatoId: String(datos.postulante_id),
        documentoId: (datos.documento_id as string) ?? null,
        fuente: String(datos.fuente),
        referenciaExterna: ref,
        etapa: "Postulantes",
      };
      this.postulaciones.push(p);
      return { status: 201, body: { data: this.vistaPostulacion(p) } };
    }
    return error(404, "NO_ENCONTRADO", "Ruta inexistente.");
  }

}

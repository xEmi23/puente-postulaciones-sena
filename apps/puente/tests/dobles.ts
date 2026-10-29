import { createHash, randomUUID } from "node:crypto";

// Dobles de prueba de los sistemas externos, escritos desde su contrato HTTP (docs/contratos.md),
// sin importar código de Vínculo ni de Talentia (cada app es independiente).
// Las pruebas de contrato de cada simulador verifican que el sistema real cumple el mismo contrato.

const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const json = (status: number, body: unknown, encabezados: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...encabezados } });

interface PublicacionDoble {
  id: string;
  externalJobId: string;
  companyId: string;
  title: string;
  webhook: string | null;
  estado: "LISTED" | "CLOSED";
  closedAt: string | null;
}

/** Vínculo: token por client credentials, mediaUrl con Bearer y expiración, autorizaciones, publicación, cierre y ciclo de vida. */
export class VinculoDoble {
  archivos = new Map<string, { bytes: Uint8Array; nombre: string; expiraEn: number }>();
  descargas = 0;
  tokensEmitidos = 0;
  private tokens = new Set<string>();
  empresa = { companyId: "6f1d2c3b-4a5e-4f60-8a71-b2c3d4e5f601", name: "Andina Software S.A.S." };
  publicaciones = new Map<string, PublicacionDoble>();
  avisos: { jobApplicationId: string; action: string }[] = [];
  /** Respuestas forzadas para el ciclo de vida (p. ej. [503, 503]); después responde 200. */
  fallosAviso: number[] = [];

  constructor(
    private base: string,
    private credenciales: () => { clientId: string; clientSecret: string },
  ) {}

  reiniciar() {
    this.archivos.clear();
    this.descargas = 0;
    this.tokensEmitidos = 0;
    this.tokens.clear();
    this.publicaciones.clear();
    this.avisos = [];
    this.fallosAviso = [];
  }

  /** Invalida los tokens emitidos (como al regenerar el Client Secret). */
  invalidarTokens() {
    this.tokens.clear();
  }

  agregarCv(bytes: Uint8Array, nombre = "cv.pdf", expiraEn = Date.now() + 30 * 86_400_000) {
    const id = randomUUID();
    this.archivos.set(id, { bytes, nombre, expiraEn });
    return { mediaUrl: `${this.base}/api/v1/media/${id}`, mediaUrn: `urn:li:media:${id}` };
  }

  private vista(v: PublicacionDoble) {
    return {
      id: v.id,
      externalJobId: v.externalJobId,
      state: v.estado,
      applyMethod: v.webhook ? "ONSITE_APPLY" : "COMPANY_SITE",
      url: `${this.base}/empleos/${v.id}`,
      notOnsiteReason: null,
      closedAt: v.closedAt,
    };
  }

  async atender(req: Request): Promise<Response> {
    const ruta = new URL(req.url).pathname;
    if (ruta === "/oauth/v2/accessToken" && req.method === "POST") {
      const f = new URLSearchParams(await req.text());
      const c = this.credenciales();
      if (f.get("grant_type") !== "client_credentials" || f.get("client_id") !== c.clientId || f.get("client_secret") !== c.clientSecret) {
        return json(401, { error: "invalid_client", error_description: "Credenciales incorrectas." });
      }
      const token = `token-${randomUUID()}`;
      this.tokens.add(token);
      this.tokensEmitidos++;
      return json(200, { access_token: token, expires_in: 3600, token_type: "Bearer" });
    }
    const presentado = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    if (!this.tokens.has(presentado)) return json(401, { status: 401, code: "INVALID_ACCESS_TOKEN", message: "Token inválido." });

    if (ruta === "/api/v1/autorizaciones") {
      return json(200, {
        application: { clientId: this.credenciales().clientId, name: "Puente de pruebas", webhookStatus: "VALIDADO" },
        elements: [{ ...this.empresa, authorizedAt: new Date().toISOString() }],
      });
    }
    if (ruta === "/api/v1/jobPostings" && req.method === "POST") {
      const d = (await req.json()) as { externalJobId: string; companyId: string; title: string; onsiteApply?: { jobApplicationWebhookUrl: string } };
      if (d.companyId !== this.empresa.companyId) return json(403, { status: 403, code: "COMPANY_NOT_AUTHORIZED", message: "No autorizada." });
      const previa = this.publicaciones.get(d.externalJobId);
      const v: PublicacionDoble = {
        id: previa?.id ?? randomUUID(),
        externalJobId: d.externalJobId,
        companyId: d.companyId,
        title: d.title,
        webhook: d.onsiteApply?.jobApplicationWebhookUrl ?? null,
        estado: "LISTED",
        closedAt: null,
      };
      this.publicaciones.set(d.externalJobId, v);
      return json(previa ? 200 : 201, { ...this.vista(v), webhookValidation: "ok" });
    }
    const cierre = ruta.match(/^\/api\/v1\/jobPostings\/([^/]+)\/close$/);
    if (cierre && req.method === "POST") {
      const v = this.publicaciones.get(decodeURIComponent(cierre[1]));
      if (!v) return json(404, { status: 404, code: "JOB_POSTING_NOT_FOUND", message: "No existe." });
      v.estado = "CLOSED";
      v.closedAt ??= new Date().toISOString();
      return json(200, this.vista(v));
    }
    const ciclo = ruta.match(/^\/api\/v1\/jobApplications\/([^/]+)\/lifecycle$/);
    if (ciclo && req.method === "POST") {
      const forzado = this.fallosAviso.shift();
      if (forzado) return json(forzado, { status: forzado, code: "TRANSIENT", message: "Falla forzada." });
      const { action } = (await req.json()) as { action: string };
      this.avisos.push({ jobApplicationId: decodeURIComponent(ciclo[1]), action });
      return json(200, { jobApplicationId: decodeURIComponent(ciclo[1]), action, status: "CV_DESCARGADO" });
    }
    const m = ruta.match(/^\/api\/v1\/media\/([^/]+)$/);
    if (!m) return json(404, { mensaje: "No existe." });
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

const errorTal = (status: number, codigo: string, mensaje: string, detalle?: Record<string, unknown>, encabezados: Record<string, string> = {}) =>
  json(status, { error: detalle ? { codigo, mensaje, detalle } : { codigo, mensaje } }, encabezados);

/**
 * Talentia: la API v1 del simulador (postulantes, documentos multipart, postulaciones, procesos, llave actual), con la
 * API Key en `auth_token`, errores { error: { codigo, mensaje, detalle } }, Idempotency-Key, 401/403 y 429 con Retry-After.
 */
export class TalentiaDoble {
  candidatos = new Map<string, { id: string; correo: string; nombre: string; apellido: string; telefono?: string | null; ciudad?: string | null }>();
  documentos: { id: string; candidatoId: string; sha256: string; bytes: Uint8Array }[] = [];
  postulaciones: Postulacion[] = [];
  procesos = [
    { id: 9001, titulo: "Desarrollador/a Backend Java", estado: "INICIADO", area: "Ingeniería", ciudad: "Medellín", descripcion: "Servicios backend en Java. Proceso ficticio de pruebas.", prioridad: "Alta", total_postulaciones: 0 },
    { id: 9002, titulo: "Analista de Calidad de Software (QA)", estado: "INICIADO", area: "Calidad", ciudad: "Medellín", descripcion: "Pruebas funcionales. Proceso ficticio de pruebas.", prioridad: "Media", total_postulaciones: 0 },
    { id: 9003, titulo: "Proceso cerrado", estado: "CERRADO", area: "Datos", ciudad: "Remoto", descripcion: "", prioridad: "Baja", total_postulaciones: 0 },
  ];
  /** La llave fue revocada en Talentia: todo responde 401. */
  revocada = false;
  permisos = { lectura: true, modificacion: true };
  /** Cuántas solicitudes siguientes responden 429 con Retry-After. */
  limitar = 0;
  retryAfter = 2;
  solicitudes = 0;
  private claves = new Map<string, { hash: string; status: number; body: unknown }>();

  constructor(private apiKey: () => string) {}

  reiniciar() {
    this.candidatos.clear();
    this.documentos = [];
    this.postulaciones = [];
    this.claves.clear();
    this.revocada = false;
    this.permisos = { lectura: true, modificacion: true };
    this.limitar = 0;
    this.solicitudes = 0;
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
    this.solicitudes++;
    if (this.revocada || req.headers.get("auth_token") !== this.apiKey()) return errorTal(401, "NO_AUTORIZADO", "La API Key fue revocada.");
    if (this.limitar > 0) {
      this.limitar--;
      return errorTal(429, "LIMITE_EXCEDIDO", "Se superó el límite.", undefined, { "Retry-After": String(this.retryAfter) });
    }
    const url = new URL(req.url);
    if (url.pathname === "/api/v1/api-key") {
      return json(200, { data: { nombre: "Llave de pruebas", prefijo: "tal_0000test", permisos: { seleccion: this.permisos }, creada_en: new Date().toISOString() } });
    }
    const ruta = url.pathname.replace(/^\/api\/v1\/seleccion/, "");
    if (req.method === "GET") {
      if (ruta === "/procesos") return json(200, { data: this.procesos.map((p) => ({ ...p, etapas: [{ nombre: "Postulantes" }] })) });
      const mp = ruta.match(/^\/procesos\/(\d+)$/);
      if (mp) {
        const p = this.procesos.find((x) => x.id === Number(mp[1]));
        return p ? json(200, { data: { ...p, etapas: [{ nombre: "Postulantes" }] } }) : errorTal(404, "NO_ENCONTRADO", "No existe.");
      }
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
    if (!this.permisos.modificacion) return errorTal(403, "PERMISO_INSUFICIENTE", "La API Key no tiene el permiso de Modificación del módulo Selección.");
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

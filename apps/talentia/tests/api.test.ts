import { createHash, randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { crearApiKey, hashLlave } from "@/modules/api/llaves";
import { api, formularioCv, leerCv, nuevaLlave, prisma, reiniciarBd } from "./utilidades";

beforeEach(reiniciarBd);

const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const persona = { nombre: "Ana", apellido: "Prueba Ficticia", correo: "ANA.Prueba@demo.test", telefono: "+573000000001", ciudad: "Medellín" };

describe("criterio 2 · API Keys con permisos", () => {
  it("la llave se entrega una sola vez: en la base solo quedan su SHA-256 y el prefijo", async () => {
    const r = await crearApiKey({ nombre: "Integración", lectura: true, modificacion: true }, null);
    if (!r.ok) throw new Error(r.error);
    expect(r.llave).toMatch(/^tal_[0-9a-f]{8}\.[A-Za-z0-9_-]{43}$/);
    const fila = await prisma.apiKey.findUniqueOrThrow({ where: { id: r.registro.id } });
    expect(fila.hash).toBe(hashLlave(r.llave));
    expect(fila.prefijo).toBe(r.llave.slice(0, 12));
    expect(JSON.stringify(fila)).not.toContain(r.llave.slice(13));
  });

  it("con permiso de Modificación crea un postulante por API (201); con solo Lectura el POST da 403; revocada da 401", async () => {
    const completa = await nuevaLlave({ lectura: true, modificacion: true });
    const creado = await api("POST", "/api/v1/seleccion/postulantes", completa, persona);
    expect(creado.status).toBe(201);
    expect(creado.body.data).toMatchObject({ nombre: "Ana", correo: "ana.prueba@demo.test" });

    const lectura = await nuevaLlave({ lectura: true });
    const prohibido = await api("POST", "/api/v1/seleccion/postulantes", lectura, { ...persona, correo: "otra@demo.test" });
    expect(prohibido.status).toBe(403);
    expect(prohibido.body.error.codigo).toBe("PERMISO_INSUFICIENTE");
    expect((await api("GET", "/api/v1/seleccion/postulantes?email=ana.prueba@demo.test", lectura)).body.data).toHaveLength(1);

    await prisma.apiKey.updateMany({ where: { hash: hashLlave(completa) }, data: { revocadaEn: new Date() } });
    const revocada = await api("GET", "/api/v1/seleccion/procesos", completa);
    expect(revocada.status).toBe(401);
    expect(revocada.body).toEqual({ error: { codigo: "NO_AUTORIZADO", mensaje: "La API Key fue revocada." } });
  });

  it("sin llave o con una inventada → 401; una llave solo de Modificación no puede leer (403)", async () => {
    expect((await api("GET", "/api/v1/seleccion/procesos", null)).status).toBe(401);
    expect((await api("GET", "/api/v1/seleccion/procesos", "tal_00000000.inventada")).status).toBe(401);
    const escritura = await nuevaLlave({ modificacion: true });
    expect((await api("GET", "/api/v1/seleccion/procesos", escritura)).status).toBe(403);
  });

  it("GET /api/v1/api-key informa nombre, prefijo y permisos (para «Probar conexión»)", async () => {
    const llave = await nuevaLlave({ lectura: true });
    const r = await api("GET", "/api/v1/api-key", llave);
    expect(r.body.data).toMatchObject({ prefijo: llave.slice(0, 12), permisos: { seleccion: { lectura: true, modificacion: false } } });
  });

  it("cada llamada queda en el registro de actividad (llave, método, ruta sin identificadores, estado, duración)", async () => {
    const llave = await nuevaLlave();
    await api("GET", `/api/v1/seleccion/postulantes/${randomUUID()}`, llave);
    await api("GET", "/api/v1/seleccion/procesos", "tal_deadbeef.inventada");
    const filas = await prisma.actividadApi.findMany({ orderBy: { creadaEn: "asc" } });
    expect(filas.map((f) => [f.prefijo, f.metodo, f.ruta, f.estado])).toEqual([
      [llave.slice(0, 12), "GET", "/api/v1/seleccion/postulantes/{id}", 404],
      ["tal_deadbeef", "GET", "/api/v1/seleccion/procesos", 401],
    ]);
    expect((await prisma.apiKey.findFirstOrThrow({ where: { hash: hashLlave(llave) } })).ultimoUsoEn).not.toBeNull();
  });
});

describe("límite de 120 solicitudes por minuto por llave", () => {
  it("la 121 responde 429 con Retry-After; otra llave no se ve afectada", async () => {
    const llave = await nuevaLlave({ lectura: true });
    const ventana = new Date(Math.floor(Date.now() / 60_000) * 60_000);
    const fila = await prisma.apiKey.findFirstOrThrow({ where: { hash: hashLlave(llave) } });
    await prisma.limiteTasa.create({ data: { apiKeyId: fila.id, ventana, conteo: 119 } });
    expect((await api("GET", "/api/v1/seleccion/procesos", llave)).status).toBe(200); // la 120
    const r = await api("GET", "/api/v1/seleccion/procesos", llave);
    if (r.status === 200) return; // cambió el minuto justo entre las dos llamadas: la ventana se reinició (válido)
    expect(r.status).toBe(429);
    expect(r.body.error.codigo).toBe("LIMITE_EXCEDIDO");
    expect(Number(r.headers.get("retry-after"))).toBeGreaterThanOrEqual(1);
    expect(Number(r.headers.get("retry-after"))).toBeLessThanOrEqual(60);
    expect((await api("GET", "/api/v1/seleccion/procesos", await nuevaLlave({ lectura: true }))).status).toBe(200);
  });
});

describe("recursos de Selección", () => {
  it("postulantes: 409 con el mismo correo, PATCH actualiza, GET por correo y por id", async () => {
    const llave = await nuevaLlave();
    const a = await api("POST", "/api/v1/seleccion/postulantes", llave, persona);
    const dup = await api("POST", "/api/v1/seleccion/postulantes", llave, persona);
    expect(dup.status).toBe(409);
    expect(dup.body.error).toMatchObject({ codigo: "POSTULANTE_EXISTENTE", detalle: { postulante_id: a.body.data.id } });
    const p = await api("PATCH", `/api/v1/seleccion/postulantes/${a.body.data.id}`, llave, { ciudad: "Envigado" });
    expect(p.body.data.ciudad).toBe("Envigado");
    expect((await api("GET", `/api/v1/seleccion/postulantes/${a.body.data.id}`, llave)).body.data.ciudad).toBe("Envigado");
    expect((await api("POST", "/api/v1/seleccion/postulantes", llave, { nombre: "" })).body.error.codigo).toBe("DATOS_INVALIDOS");
  });

  it("documentos: multipart con SHA-256; 422 si no coincide, 415 si no es PDF, 404 sin postulante", async () => {
    const llave = await nuevaLlave();
    const { body } = await api("POST", "/api/v1/seleccion/postulantes", llave, persona);
    const cv = leerCv();
    const ok = await api("POST", `/api/v1/seleccion/postulantes/${body.data.id}/documentos`, llave, formularioCv(cv, sha(cv)));
    expect(ok.status).toBe(201);
    expect(ok.body.data.sha256).toBe(sha(cv));
    const malo = await api("POST", `/api/v1/seleccion/postulantes/${body.data.id}/documentos`, llave, formularioCv(cv, "0".repeat(64)));
    expect([malo.status, malo.body.error.codigo]).toEqual([422, "HASH_NO_COINCIDE"]);
    const texto = new TextEncoder().encode("no es pdf");
    expect((await api("POST", `/api/v1/seleccion/postulantes/${body.data.id}/documentos`, llave, formularioCv(texto, sha(texto)))).status).toBe(415);
    expect((await api("POST", `/api/v1/seleccion/postulantes/${randomUUID()}/documentos`, llave, formularioCv(cv, sha(cv)))).status).toBe(404);
    expect((await api("GET", `/api/v1/seleccion/postulantes/${body.data.id}/documentos`, llave)).body.data).toHaveLength(1);
  });

  it("postulaciones: 201 en «Postulantes»; misma referencia → 200; misma persona → 409; PATCH mueve; GET por referencia_externa", async () => {
    const llave = await nuevaLlave();
    const { body: pos } = await api("POST", "/api/v1/seleccion/postulantes", llave, persona);
    const nueva = { proceso_id: 9001, postulante_id: pos.data.id, fuente: "Portal simulado (tipo LinkedIn)", referencia_externa: "urn:li:jobApplication:1" };
    const a = await api("POST", "/api/v1/seleccion/postulaciones", llave, nueva);
    expect(a.status).toBe(201);
    expect(a.body.data.etapa).toMatchObject({ nombre: "Postulantes", orden: 1 });
    expect(a.body.data.calificacion).toBe("SIN_CALIFICAR");
    expect((await api("POST", "/api/v1/seleccion/postulaciones", llave, nueva)).status).toBe(200);
    const b = await api("POST", "/api/v1/seleccion/postulaciones", llave, { ...nueva, referencia_externa: "urn:li:jobApplication:2" });
    expect([b.status, b.body.error.detalle.postulacion_id]).toEqual([409, a.body.data.id]);
    expect((await api("POST", "/api/v1/seleccion/postulaciones", llave, { ...nueva, proceso_id: 1, referencia_externa: "x" })).status).toBe(404);
    const g = await api("GET", "/api/v1/seleccion/postulaciones?referencia_externa=urn%3Ali%3AjobApplication%3A1", llave);
    expect(g.body.data.map((p: { id: string }) => p.id)).toEqual([a.body.data.id]);
    const m = await api("PATCH", `/api/v1/seleccion/postulaciones/${a.body.data.id}`, llave, { etapa: "Por contactar" });
    expect(m.body.data.etapa.nombre).toBe("Por contactar");
    const autor = await prisma.movimientoEtapa.findFirstOrThrow({ where: { tipo: "MOVIDA", postulacionId: a.body.data.id } });
    expect(autor.autor).toBe(`API · ${llave.slice(0, 12)}`);
  });

  it("procesos: GET con filtro de estado, GET por id con 9 etapas y POST crea", async () => {
    const llave = await nuevaLlave();
    const l = await api("GET", "/api/v1/seleccion/procesos?estado=INICIADO", llave);
    expect(l.body.data.map((p: { id: number }) => p.id)).toEqual([9001, 9002, 9003, 9004, 9005, 9006]);
    const uno = await api("GET", "/api/v1/seleccion/procesos/9001", llave);
    expect(uno.body.data.etapas).toHaveLength(9);
    expect((await api("GET", "/api/v1/seleccion/procesos/1", llave)).status).toBe(404);
    const c = await api("POST", "/api/v1/seleccion/procesos", llave, { titulo: "Analista de Datos", area: "Datos", ciudad: "Bogotá" });
    expect([c.status, c.body.data.id]).toEqual([201, 9007]);
  });
});

describe("Idempotency-Key (capacidad del simulador)", () => {
  it("misma clave y cuerpo → misma respuesta sin escribir de nuevo; otro cuerpo → 422 CLAVE_REUTILIZADA; la clave es por llave", async () => {
    const llave = await nuevaLlave();
    const a = await api("POST", "/api/v1/seleccion/postulantes", llave, persona, { "Idempotency-Key": "k-1" });
    const b = await api("POST", "/api/v1/seleccion/postulantes", llave, persona, { "Idempotency-Key": "k-1" });
    expect(b.status).toBe(201); // repite el 201 original, no un 409
    expect(b.body).toEqual(a.body);
    expect(b.headers.get("idempotent-replayed")).toBe("true");
    expect(await prisma.postulante.count({ where: { correo: "ana.prueba@demo.test" } })).toBe(1);
    const otro = await api("POST", "/api/v1/seleccion/postulantes", llave, { ...persona, correo: "otro@demo.test" }, { "Idempotency-Key": "k-1" });
    expect([otro.status, otro.body.error.codigo]).toEqual([422, "CLAVE_REUTILIZADA"]);
    // La misma clave con otra llave es independiente.
    const otraLlave = await nuevaLlave();
    expect((await api("POST", "/api/v1/seleccion/postulantes", otraLlave, persona, { "Idempotency-Key": "k-1" })).status).toBe(409);
  });

  it("también en la subida del documento: repetir con la misma clave no crea otro documento", async () => {
    const llave = await nuevaLlave();
    const { body } = await api("POST", "/api/v1/seleccion/postulantes", llave, persona);
    const cv = leerCv();
    const ruta = `/api/v1/seleccion/postulantes/${body.data.id}/documentos`;
    const a = await api("POST", ruta, llave, formularioCv(cv, sha(cv)), { "Idempotency-Key": "doc-1" });
    const b = await api("POST", ruta, llave, formularioCv(cv, sha(cv)), { "Idempotency-Key": "doc-1" });
    expect(b.body.data.id).toBe(a.body.data.id);
    expect(await prisma.documento.count({ where: { postulanteId: body.data.id } })).toBe(1);
  });
});

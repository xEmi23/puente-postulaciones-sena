import { createHmac, randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fetchEnProceso, leerCv, prisma, reiniciarBd } from "../utilidades";

// PRUEBAS DE CONTRATO INDEPENDIENTES:
// - Puente frente a la documentación de LinkedIn (el ejemplo oficial de F1 y la tabla de errores), sin pasar por el origen.
// - ATS simulado frente a docs/contratos.md §3 (contrato del simulador), con HTTP crudo, sin el cliente del puente.

beforeEach(reiniciarBd);

const firmar = (cuerpo: string) => createHmac("sha256", process.env.SIM_CLIENT_SECRET!).update(`hmacsha256=${cuerpo}`).digest("hex");

async function postWebhook(cuerpo: string, firma = firmar(cuerpo)) {
  const r = await fetchEnProceso("http://app.test/api/puente/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-LI-Signature": firma },
    body: cuerpo,
  });
  return { status: r.status, body: await r.json() };
}

function ejemploOficial() {
  const p = JSON.parse(readFileSync(path.resolve("tests/contratos/linkedin-receive-applications.ejemplo.json"), "utf8"));
  delete p._fuente;
  // Únicos ajustes: la vacante existe en el simulador y el CV vive en el origen autorizado.
  p.externalJobId = "RT-2026-101";
  p.questionResponses.resumeQuestionResponses.resumeQuestionAnswer.mediaUrl = `http://app.test/api/origen/media/${randomUUID()}`;
  return p;
}

describe("puente frente a la documentación de LinkedIn", () => {
  it("acepta el payload de ejemplo oficial de F1 (con campos que el prototipo no usa) y responde 200", async () => {
    const r = await postWebhook(JSON.stringify(ejemploOficial()));
    expect(r.status).toBe(200);
    const rec = await prisma.recepcion.findUniqueOrThrow({ where: { jobApplicationId: "urn:li:jobApplication:12345678" } });
    expect(rec.nombre).toBe("First");
    expect(rec.correo).toBe("applicant@linkedin.com");
  });

  it("los errores tienen la forma de F1: {errors:[{errorCode, additionalErrorDetails?}]} con códigos de la tabla", async () => {
    const codigosF1 = ["MISSING_REQUIRED_RESPONSE", "INPUT_VALIDATION_FAILED", "DUPLICATE_APPLICATION_RECEIVED", "JOB_POSTING_CLOSED", "TOO_MANY_REQUESTS", "SIGNATURE_MISMATCH", "TRANSIENT_ERROR", "OTHER"];
    const casos: { cuerpo: string; firma?: string; codigo: string }[] = [];
    const base = JSON.stringify(ejemploOficial());
    casos.push({ cuerpo: base, firma: "0".repeat(64), codigo: "SIGNATURE_MISMATCH" });
    const sinCorreo = ejemploOficial();
    delete sinCorreo.questionResponses.contactInformationQuestionResponses.emailAnswer;
    casos.push({ cuerpo: JSON.stringify(sinCorreo), codigo: "MISSING_REQUIRED_RESPONSE" });
    casos.push({ cuerpo: JSON.stringify({ ...ejemploOficial(), appliedAt: "ayer" }), codigo: "INPUT_VALIDATION_FAILED" });
    casos.push({ cuerpo: JSON.stringify({ ...ejemploOficial(), externalJobId: "NO-EXISTE" }), codigo: "JOB_POSTING_CLOSED" });
    for (const c of casos) {
      const r = await postWebhook(c.cuerpo, c.firma);
      expect(r.status).not.toBe(200);
      expect(Array.isArray(r.body.errors)).toBe(true);
      expect(codigosF1).toContain(r.body.errors[0].errorCode);
      expect(r.body.errors[0].errorCode).toBe(c.codigo);
    }
    // MissingQuestionResponseErrorDetails.partnerQuestionIdentifiers es Array(string) (F1).
    const r = await postWebhook(JSON.stringify(sinCorreo));
    expect(r.body.errors[0].additionalErrorDetails.missingQuestionResponseErrorDetails.partnerQuestionIdentifiers).toEqual(["email"]);
  });

  it("validación del endpoint según F2: 200, application/json, challengeResponse = hex(HMAC(challengeCode, secreto)) en minúsculas", async () => {
    const code = randomUUID();
    const r = await fetchEnProceso(`http://app.test/api/puente/webhook?challengeCode=${code}&applicationId=123`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/^application\/json/);
    const j = await r.json();
    expect(j.challengeCode).toBe(code);
    expect(j.challengeResponse).toBe(createHmac("sha256", process.env.SIM_CLIENT_SECRET!).update(code).digest("hex"));
    expect(j.challengeResponse).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("ATS simulado frente a docs/contratos.md §3 (HTTP crudo)", () => {
  const auth = () => ({ Authorization: `Bearer ${process.env.ATS_API_KEY}`, "Content-Type": "application/json" });
  const llamar = async (metodo: string, ruta: string, cuerpo?: unknown, extra: Record<string, string> = {}) => {
    const r = await fetchEnProceso(`http://app.test/api/ats/v1${ruta}`, {
      method: metodo,
      headers: { ...auth(), ...extra },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    return { status: r.status, body: await r.json() };
  };

  it("401 NO_AUTORIZADO sin Bearer o con otra clave", async () => {
    const r = await fetchEnProceso("http://app.test/api/ats/v1/procesos");
    expect(r.status).toBe(401);
    expect((await r.json()).codigo).toBe("NO_AUTORIZADO");
    const r2 = await fetchEnProceso("http://app.test/api/ats/v1/procesos", { headers: { Authorization: "Bearer otra-clave-0123456789" } });
    expect(r2.status).toBe(401);
  });

  it("POST /candidatos: 201 nuevo y 200 existente por correo", async () => {
    const c = { nombre: "Ana", apellido: "Prueba", correo: "ANA@demo.test" };
    const a = await llamar("POST", "/candidatos", c);
    expect(a).toEqual({ status: 201, body: { id: expect.any(String), existente: false } });
    const b = await llamar("POST", "/candidatos", { ...c, correo: "ana@demo.test" });
    expect(b).toEqual({ status: 200, body: { id: a.body.id, existente: true } });
  });

  it("POST /candidatos/{id}/documentos: 201, 422 HASH_NO_COINCIDE, 415 ARCHIVO_NO_PDF, 404 CANDIDATO_NO_EXISTE", async () => {
    const { body: cand } = await llamar("POST", "/candidatos", { nombre: "Ana", apellido: "Prueba", correo: "ana@demo.test" });
    const pdf = Buffer.from(leerCv());
    const sha = createHmac("sha256", "").digest("hex"); // un hash cualquiera, distinto del real
    const real = (await import("node:crypto")).createHash("sha256").update(pdf).digest("hex");
    const doc = { nombreArchivo: "cv.pdf", tipo: "CV", contenidoBase64: pdf.toString("base64") };
    expect((await llamar("POST", `/candidatos/${cand.id}/documentos`, { ...doc, sha256: real })).status).toBe(201);
    const malo = await llamar("POST", `/candidatos/${cand.id}/documentos`, { ...doc, sha256: sha });
    expect(malo.status).toBe(422);
    expect(malo.body.codigo).toBe("HASH_NO_COINCIDE");
    const texto = Buffer.from("no es pdf");
    const noPdf = await llamar("POST", `/candidatos/${cand.id}/documentos`, {
      ...doc,
      contenidoBase64: texto.toString("base64"),
      sha256: (await import("node:crypto")).createHash("sha256").update(texto).digest("hex"),
    });
    expect(noPdf.status).toBe(415);
    expect((await llamar("POST", `/candidatos/${randomUUID()}/documentos`, { ...doc, sha256: real })).status).toBe(404);
  });

  it("POST /postulaciones: 201 en la primera etapa, 200 por misma referencia, 409 misma persona, 404 proceso; GET por referencia", async () => {
    const { body: cand } = await llamar("POST", "/candidatos", { nombre: "Ana", apellido: "Prueba", correo: "ana@demo.test" });
    const post = { procesoId: 9001, candidatoId: cand.id, fuente: "LinkedIn Easy Apply (simulado)", referenciaExterna: "urn:li:jobApplication:1" };
    const a = await llamar("POST", "/postulaciones", post);
    expect(a.status).toBe(201);
    expect(a.body.etapa).toBe("Postulantes");
    expect((await llamar("POST", "/postulaciones", post)).status).toBe(200);
    const b = await llamar("POST", "/postulaciones", { ...post, referenciaExterna: "urn:li:jobApplication:2" });
    expect(b.status).toBe(409);
    expect(b.body).toMatchObject({ codigo: "POSTULACION_EXISTENTE", postulacionId: a.body.id });
    expect((await llamar("POST", "/postulaciones", { ...post, procesoId: 1, referenciaExterna: "x" })).status).toBe(404);
    const g = await llamar("GET", "/postulaciones?referenciaExterna=urn%3Ali%3AjobApplication%3A1");
    expect(g.body.resultados).toHaveLength(1);
    expect((await llamar("GET", "/postulaciones?referenciaExterna=nada")).body.resultados).toEqual([]);
  });

  it("Idempotency-Key: misma clave y cuerpo → misma respuesta sin escribir; otro cuerpo → 422 CLAVE_REUTILIZADA", async () => {
    const c = { nombre: "Luis", apellido: "Prueba", correo: "luis@demo.test" };
    const a = await llamar("POST", "/candidatos", c, { "Idempotency-Key": "k-1" });
    const b = await llamar("POST", "/candidatos", c, { "Idempotency-Key": "k-1" });
    expect(b).toEqual(a); // repite el 201 original
    expect(await prisma.candidato.count()).toBe(1);
    const otro = await llamar("POST", "/candidatos", { ...c, correo: "otro@demo.test" }, { "Idempotency-Key": "k-1" });
    expect(otro.status).toBe(422);
    expect(otro.body.codigo).toBe("CLAVE_REUTILIZADA");
  });

  it("GET /procesos lista procesos con sus etapas", async () => {
    const r = await llamar("GET", "/procesos");
    expect(r.body.resultados.map((p: { id: number }) => p.id)).toEqual([9001, 9002]);
    expect(r.body.resultados[0].etapas[0]).toBe("Postulantes");
  });
});

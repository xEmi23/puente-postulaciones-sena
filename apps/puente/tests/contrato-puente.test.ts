import { createHmac, randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fetchEnProceso, prisma, reiniciarBd } from "./utilidades";

// PRUEBAS DE CONTRATO INDEPENDIENTES:
// - Puente frente a la documentación de LinkedIn (el ejemplo oficial de F1 y la tabla de errores), sin pasar por el origen.

beforeEach(reiniciarBd);

const firmar = (cuerpo: string) => createHmac("sha256", process.env.SIM_CLIENT_SECRET!).update(`hmacsha256=${cuerpo}`).digest("hex");

async function postWebhook(cuerpo: string, firma = firmar(cuerpo)) {
  const r = await fetchEnProceso("http://puente.test/api/puente/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-LI-Signature": firma },
    body: cuerpo,
  });
  return { status: r.status, body: await r.json() };
}

function ejemploOficial() {
  const p = JSON.parse(readFileSync(path.resolve("tests/linkedin-receive-applications.ejemplo.json"), "utf8"));
  delete p._fuente;
  // Únicos ajustes: la vacante existe en el simulador y el CV vive en el origen autorizado.
  p.externalJobId = "RT-2026-101";
  p.questionResponses.resumeQuestionResponses.resumeQuestionAnswer.mediaUrl = `http://vinculo.test/api/v1/media/${randomUUID()}`;
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
    const r = await fetchEnProceso(`http://puente.test/api/puente/webhook?challengeCode=${code}&applicationId=123`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/^application\/json/);
    const j = await r.json();
    expect(j.challengeCode).toBe(code);
    expect(j.challengeResponse).toBe(createHmac("sha256", process.env.SIM_CLIENT_SECRET!).update(code).digest("hex"));
    expect(j.challengeResponse).toMatch(/^[0-9a-f]{64}$/);
  });
});


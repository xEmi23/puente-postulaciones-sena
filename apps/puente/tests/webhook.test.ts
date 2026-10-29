import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { enviarWebhook, fetchEnProceso, payloadValido, prisma, reiniciarBd, talentia } from "./utilidades";

beforeEach(reiniciarBd);

async function sinEscrituras() {
  expect(await prisma.recepcion.count()).toBe(0);
  expect(await prisma.trabajo.count()).toBe(0);
  expect(talentia.conteo().candidatos).toBe(0);
}

describe("GET de validación del webhook", () => {
  it("responde 200 con challengeCode y challengeResponse en JSON", async () => {
    const code = "890e4665-4dfe-4ab1-b689-ed553bceeed0";
    const inicio = Date.now();
    const r = await fetchEnProceso(`http://puente.test/api/puente/webhook?challengeCode=${code}`);
    expect(Date.now() - inicio).toBeLessThan(3000);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("application/json");
    const json = await r.json();
    expect(json).toEqual({
      challengeCode: code,
      challengeResponse: createHmac("sha256", process.env.SIM_CLIENT_SECRET!).update(code).digest("hex"),
    });
  });

  it("responde 400 sin challengeCode", async () => {
    const r = await fetchEnProceso("http://puente.test/api/puente/webhook");
    expect(r.status).toBe(400);
  });
});

describe("POST del webhook", () => {
  it("acepta un payload válido: 200, recepción RECIBIDO y trabajo persistente", async () => {
    const r = await enviarWebhook(JSON.stringify(payloadValido()));
    expect(r.status).toBe(200);
    expect(r.body.estado).toBe("RECIBIDO");
    const rec = await prisma.recepcion.findUniqueOrThrow({ where: { jobApplicationId: "urn:li:jobApplication:1234567890" }, include: { trabajo: true } });
    expect(rec.estado).toBe("RECIBIDO");
    expect(rec.trabajo?.estado).toBe("PENDIENTE");
    expect(rec.correo).toBe("camila.ejemplo@demo.test");
  });

  it("firma inválida → 401 SIGNATURE_MISMATCH y cero escrituras", async () => {
    const r = await enviarWebhook(JSON.stringify(payloadValido()), "0".repeat(64));
    expect(r.status).toBe(401);
    expect(r.body).toEqual({ errors: [{ errorCode: "SIGNATURE_MISMATCH" }] });
    await sinEscrituras();
    expect(await prisma.entregaRechazada.count({ where: { codigo: "SIGNATURE_MISMATCH" } })).toBe(1);
  });

  it("sin firma → 401 SIGNATURE_MISMATCH", async () => {
    const r = await enviarWebhook(JSON.stringify(payloadValido()), null);
    expect(r.status).toBe(401);
    await sinEscrituras();
  });

  it("JSON ilegible → 400 INPUT_VALIDATION_FAILED", async () => {
    const r = await enviarWebhook("{no es json");
    expect(r.status).toBe(400);
    expect((r.body.errors as { errorCode: string }[])[0].errorCode).toBe("INPUT_VALIDATION_FAILED");
    await sinEscrituras();
  });

  it("faltan nombre, correo y CV → 400 MISSING_REQUIRED_RESPONSE con los identificadores", async () => {
    const p = payloadValido();
    const qr = p.questionResponses as Record<string, unknown>;
    qr.contactInformationQuestionResponses = { lastNameAnswer: { value: "Ejemplo" } };
    qr.resumeQuestionResponses = null;
    const r = await enviarWebhook(JSON.stringify(p));
    expect(r.status).toBe(400);
    expect(r.body).toEqual({
      errors: [
        {
          errorCode: "MISSING_REQUIRED_RESPONSE",
          additionalErrorDetails: { missingQuestionResponseErrorDetails: { partnerQuestionIdentifiers: ["firstName", "email", "resume"] } },
        },
      ],
    });
    await sinEscrituras();
  });

  it("tipo de evento o URN inválidos → 400 INPUT_VALIDATION_FAILED", async () => {
    const r = await enviarWebhook(JSON.stringify(payloadValido({ type: "OTRO", jobApplicationId: "123" })));
    expect(r.status).toBe(400);
    const err = (r.body.errors as { errorCode: string; additionalErrorDetails: { inputValidationErrorDetails: { invalidInputQuestionIdentifierDetails: { partnerQuestionIdentifier: string }[] } } }[])[0];
    expect(err.errorCode).toBe("INPUT_VALIDATION_FAILED");
    const campos = err.additionalErrorDetails.inputValidationErrorDetails.invalidInputQuestionIdentifierDetails.map((d) => d.partnerQuestionIdentifier);
    expect(campos).toEqual(expect.arrayContaining(["type", "jobApplicationId"]));
    await sinEscrituras();
  });

  it("correo con formato inválido → 400 INPUT_VALIDATION_FAILED", async () => {
    const p = payloadValido();
    (p.questionResponses.contactInformationQuestionResponses as Record<string, unknown>).emailAnswer = { value: "no-es-correo" };
    const r = await enviarWebhook(JSON.stringify(p));
    expect(r.status).toBe(400);
    await sinEscrituras();
  });

  it("mediaUrl de un host no autorizado → 400 INPUT_VALIDATION_FAILED (nunca se descarga)", async () => {
    const p = payloadValido();
    p.questionResponses.resumeQuestionResponses = { resumeQuestionAnswer: { mediaUrl: "http://169.254.169.254/latest/meta-data", mediaUrn: "urn:li:media:x" } };
    const r = await enviarWebhook(JSON.stringify(p));
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).toContain("mediaUrl fuera del origen autorizado");
    await sinEscrituras();
  });

  it("vacante sin correspondencia → 422 JOB_POSTING_CLOSED sin adivinar proceso", async () => {
    const r = await enviarWebhook(JSON.stringify(payloadValido({ externalJobId: "RT-2026-103" })));
    expect(r.status).toBe(422);
    expect((r.body.errors as { errorCode: string }[])[0].errorCode).toBe("JOB_POSTING_CLOSED");
    await sinEscrituras();
  });
});

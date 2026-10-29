import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { descifrar } from "@/lib/cifrado";
import { regenerarSecreto, revocarAplicacion, registrarWebhook } from "@/modules/aplicaciones";
import { aplicacionIntegrador, api, empresaAndina, pedirToken, publicarVacante, reiniciarBd, solicitar } from "./utilidades";

beforeEach(reiniciarBd);

describe("criterio 4 · aplicación de desarrollador y token por client credentials", () => {
  it("el Client Secret se entrega una vez y se guarda cifrado (nunca en claro)", async () => {
    const { app, clientSecret } = await aplicacionIntegrador();
    const fila = await prisma.aplicacionDev.findUniqueOrThrow({ where: { id: app.id } });
    expect(fila.secretoCifrado).not.toContain(clientSecret);
    expect(fila.secretoCifrado).toMatch(/^v1\./);
    expect(descifrar(fila.secretoCifrado)).toBe(clientSecret);
  });

  it("con credenciales correctas entrega un token de 60 minutos; con un secreto malo, 401 invalid_client", async () => {
    const { clientId, clientSecret } = await aplicacionIntegrador();
    const ok = await pedirToken(clientId, clientSecret);
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ token_type: "Bearer", expires_in: 3600 });
    expect(ok.body.access_token.split(".")).toHaveLength(3);
    const malo = await pedirToken(clientId, "secreto-equivocado");
    expect([malo.status, malo.body.error]).toEqual([401, "invalid_client"]);
    expect((await pedirToken("vin_noexiste", clientSecret)).status).toBe(401);
  });

  it("regenerar el secreto invalida el anterior y los tokens ya emitidos; revocar la aplicación también", async () => {
    const int = await aplicacionIntegrador();
    const { body: t } = await pedirToken(int.clientId, int.clientSecret);
    expect((await api("GET", "/api/v1/autorizaciones", t.access_token)).status).toBe(200);
    const nuevo = await regenerarSecreto(int.app.id);
    expect((await api("GET", "/api/v1/autorizaciones", t.access_token)).status).toBe(401);
    expect((await pedirToken(int.clientId, int.clientSecret)).status).toBe(401);
    const { body: t2 } = await pedirToken(int.clientId, nuevo);
    expect((await api("GET", "/api/v1/autorizaciones", t2.access_token)).status).toBe(200);
    await revocarAplicacion(int.app.id);
    expect((await api("GET", "/api/v1/autorizaciones", t2.access_token)).status).toBe(401);
    expect((await pedirToken(int.clientId, nuevo)).status).toBe(401);
  });

  it("autorizaciones: la aplicación ve las empresas que la conectaron (para obtener el companyId)", async () => {
    const int = await aplicacionIntegrador();
    const { body: t } = await pedirToken(int.clientId, int.clientSecret);
    const r = await api("GET", "/api/v1/autorizaciones", t.access_token);
    expect(r.body.elements).toEqual([expect.objectContaining({ companyId: (await empresaAndina()).id, name: "Andina Software S.A.S." })]);
  });
});

describe("validación del webhook por desafío", () => {
  it("valida cuando el webhook responde hex(HMAC-SHA256(challengeCode, clientSecret)); falla con otro secreto", async () => {
    const int = await aplicacionIntegrador();
    const v = await registrarWebhook(int.app.id, int.webhook.url);
    expect(v.ok).toBe(true);
    expect((await prisma.aplicacionDev.findUniqueOrThrow({ where: { id: int.app.id } })).webhookEstado).toBe("VALIDADO");
    int.webhook.secreto = () => "otro-secreto";
    const mal = await registrarWebhook(int.app.id, int.webhook.url);
    expect(mal.ok).toBe(false);
    expect(mal.detalle).toMatch(/challengeResponse no coincide/);
    expect((await registrarWebhook(int.app.id, "http://integrador.test/no-existe")).detalle).toMatch(/HTTP 404/);
  });
});

describe("publicación por API (jobPostings)", () => {
  it("sin autorización de la empresa → 403 COMPANY_NOT_AUTHORIZED", async () => {
    const int = await aplicacionIntegrador({ autorizar: false });
    const { respuesta } = await publicarVacante(int);
    expect([respuesta.status, (respuesta.body as { code: string }).code]).toEqual([403, "COMPANY_NOT_AUTHORIZED"]);
  });

  it("con webhook válido queda con «Solicitud sencilla»; repetir actualiza la misma vacante (idempotente)", async () => {
    const int = await aplicacionIntegrador();
    const a = await publicarVacante(int, "9001");
    expect(a.respuesta.status).toBe(201);
    expect(a.respuesta.body).toMatchObject({ externalJobId: "9001", state: "LISTED", applyMethod: "ONSITE_APPLY", jobApplicationWebhookUrl: int.webhook.url });
    expect(int.webhook.desafios).toBe(1);
    const b = await publicarVacante(int, "9001");
    expect(b.respuesta.status).toBe(200);
    expect(await prisma.vacante.count({ where: { aplicacionId: int.app.id } })).toBe(1);
  });

  it("si el webhook no pasa el desafío, la vacante queda como «postulación en el sitio de la empresa»", async () => {
    const int = await aplicacionIntegrador();
    int.webhook.secreto = () => "secreto-equivocado";
    const { respuesta } = await publicarVacante(int, "9002");
    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toMatchObject({ applyMethod: "COMPANY_SITE", companyApplyUrl: "https://andina-software.test/empleos" });
    expect((respuesta.body as { notOnsiteReason: string }).notOnsiteReason).toMatch(/Validación del webhook fallida/);
  });

  it("datos inválidos → 400 con los campos; sin token → 401", async () => {
    const int = await aplicacionIntegrador();
    const { body: t } = await pedirToken(int.clientId, int.clientSecret);
    const r = await api("POST", "/api/v1/jobPostings", t.access_token, { externalJobId: "x", companyId: "no-uuid" });
    expect(r.status).toBe(400);
    expect((r.body as { details: { campos: unknown[] } }).details.campos.length).toBeGreaterThan(2);
    expect((await api("POST", "/api/v1/jobPostings", null, {})).status).toBe(401);
  });

  it("cerrar: la vacante pasa a CLOSED y deja de recibir solicitudes; repetir no cambia nada", async () => {
    const int = await aplicacionIntegrador();
    const { token, respuesta } = await publicarVacante(int, "9003");
    const id = (respuesta.body as { id: string }).id;
    const c = await api("POST", "/api/v1/jobPostings/9003/close", token);
    expect([c.status, (c.body as { state: string }).state]).toEqual([200, "CLOSED"]);
    expect((await api("POST", "/api/v1/jobPostings/9003/close", token)).status).toBe(200);
    await expect(solicitar(id)).rejects.toThrow(/ya no recibe postulaciones/);
    expect((await api("POST", "/api/v1/jobPostings/NO-EXISTE/close", token)).status).toBe(404);
  });
});

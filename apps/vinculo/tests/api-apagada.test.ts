import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { apiHabilitada } from "@/lib/config";
import { despacharPendientes } from "@/modules/despachador";
import { aplicacionIntegrador, api, fetchEnProceso, pedirToken, publicarVacante, reiniciarBd, solicitar, webhooks } from "./utilidades";

// D-68: para la empresa, el LinkedIn real NO tiene API. Con VINCULO_API_HABILITADA apagada (el valor por defecto en
// desarrollo y en la demo), Vínculo no expone OAuth, /api/v1 ni OpenAPI (404) y no entrega ningún webhook.
// El resto de las pruebas corre con la API prendida (entorno-pruebas.ts); aquí se apaga y se restaura.

beforeEach(reiniciarBd);
afterEach(() => {
  process.env.VINCULO_API_HABILITADA = "true";
});

describe("VINCULO_API_HABILITADA", () => {
  it("por defecto (sin la variable) la API está apagada; true o 1 la prenden", () => {
    delete process.env.VINCULO_API_HABILITADA;
    expect(apiHabilitada()).toBe(false);
    process.env.VINCULO_API_HABILITADA = "false";
    expect(apiHabilitada()).toBe(false);
    // Un valor inválido o vacío cuenta como apagada (auditoría F4-V).
    for (const v of ["", "  ", "yes", "prendida", "verdadero", "on", "2"]) {
      process.env.VINCULO_API_HABILITADA = v;
      expect(apiHabilitada(), JSON.stringify(v)).toBe(false);
    }
    process.env.VINCULO_API_HABILITADA = " TRUE ";
    expect(apiHabilitada()).toBe(true);
    process.env.VINCULO_API_HABILITADA = "1";
    expect(apiHabilitada()).toBe(true);
    process.env.VINCULO_API_HABILITADA = "true";
    expect(apiHabilitada()).toBe(true);
  });

  it("con false: OAuth, /api/v1, media y OpenAPI responden 404, aunque el token y la aplicación existan", async () => {
    // Se prepara con la API prendida (aplicación autorizada, token y vacante conectada), y luego se apaga.
    const int = await aplicacionIntegrador();
    const { token, respuesta } = await publicarVacante(int, "9001");
    expect(respuesta.status).toBe(201);

    process.env.VINCULO_API_HABILITADA = "false";
    const r = await fetchEnProceso("http://vinculo.test/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: int.clientId, client_secret: int.clientSecret }).toString(),
    });
    expect(r.status).toBe(404);
    expect((await api("GET", "/api/v1/autorizaciones", token)).status).toBe(404);
    expect((await api("POST", "/api/v1/jobPostings", token, { externalJobId: "9002" })).status).toBe(404);
    expect((await api("POST", "/api/v1/jobPostings/9001/close", token)).status).toBe(404);
    expect((await api("POST", "/api/v1/jobApplications/urn:li:jobApplication:1/lifecycle", token, { action: "VIEWED" })).status).toBe(404);
    expect((await api("GET", "/api/v1/media/00000000-0000-0000-0000-000000000000", token)).status).toBe(404);
    expect((await fetchEnProceso("http://vinculo.test/api/openapi.json")).status).toBe(404);

    process.env.VINCULO_API_HABILITADA = "true";
    expect((await pedirToken(int.clientId, int.clientSecret)).status).toBe(200);
  });

  it("con false: una postulación a una vacante conectada no crea entrega y el despachador no envía nada", async () => {
    const int = await aplicacionIntegrador();
    const a = (await publicarVacante(int, "9001")).respuesta.body as { id: string };
    const b = (await publicarVacante(int, "9002")).respuesta.body as { id: string };
    // Una entrega que quedó pendiente de cuando la API estaba prendida…
    await solicitar(b.id);
    expect(await prisma.outbox.count({ where: { estado: "PENDIENTE" } })).toBe(1);

    process.env.VINCULO_API_HABILITADA = "false";
    const r = await solicitar(a.id, "cv-sofia-demo.pdf");
    // La postulación nueva queda en Vínculo para el reclutador (como en el LinkedIn real sin API), sin entrega.
    const p = await prisma.postulacion.findUniqueOrThrow({ where: { id: r.postulacionId }, include: { outbox: true } });
    expect(p.estado).toBe("ENVIADA");
    expect(p.outbox).toHaveLength(0);
    // …tampoco sale mientras la API esté apagada.
    expect(await despacharPendientes()).toBe(0);
    expect(await prisma.outbox.count({ where: { estado: "PENDIENTE" } })).toBe(1);
    expect(webhooks.get(int.webhook.url)!.entregas).toHaveLength(0);
  });
});

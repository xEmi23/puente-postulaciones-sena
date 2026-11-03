import { expect, test } from "@playwright/test";
import { VIN, VIN_SIN_API, detenerVinculoSinApi, iniciarVinculoSinApi } from "./procesos";
import { abrirVacante, correoUnico, iniciarSesionVinculo, registrarCandidato, sufijoUnico } from "./utilidades";

// D-68 (auditoría F4-V): Vínculo con VINCULO_API_HABILITADA=false, como el LinkedIn real para la empresa. Es una
// segunda instancia del mismo build sobre la misma base E2E (puerto 3214); la de 3211 sigue con la API prendida.
// La cookie de sesión de localhost sirve en ambos puertos: se inicia sesión en 3211 y se mira en 3214.
test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  test.setTimeout(120_000);
  await iniciarVinculoSinApi();
});
test.afterAll(detenerVinculoSinApi);

test("sin sesión: ni «Desarrolladores» ni «API para integradores»; portal, OAuth, /api/v1 y OpenAPI responden 404", async ({ page, request }) => {
  await page.goto(`${VIN_SIN_API}/empleos`);
  await expect(page.getByText("Entorno de simulación").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Desarrolladores" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "API para integradores" })).toHaveCount(0);
  for (const ruta of ["/developers", "/developers/docs"]) {
    const r = await page.goto(`${VIN_SIN_API}${ruta}`);
    expect(r?.status(), ruta).toBe(404);
    await expect(page.getByText("No encontramos esta página")).toBeVisible();
  }
  expect((await request.post(`${VIN_SIN_API}/oauth/v2/accessToken`, { form: { grant_type: "client_credentials", client_id: "x", client_secret: "y" } })).status()).toBe(404);
  expect((await request.get(`${VIN_SIN_API}/api/openapi.json`)).status()).toBe(404);
  expect((await request.get(`${VIN_SIN_API}/api/v1/autorizaciones`)).status()).toBe(404);
  expect((await request.post(`${VIN_SIN_API}/api/v1/jobPostings`, { data: {} })).status()).toBe(404);
  // La misma base con la API prendida (3211) sí la expone: el código no se borró.
  expect((await request.get(`${VIN}/api/openapi.json`)).status()).toBe(200);
});

test("reclutadora: sin «Integraciones», una vacante conectada antes no dice «entregada a» y el formulario no ofrece ATS", async ({ page }) => {
  await iniciarSesionVinculo(page, "reclutadora");
  await page.goto(`${VIN_SIN_API}/reclutador`);
  await expect(page.getByRole("navigation", { name: "Secciones del panel" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Integraciones", exact: true })).toHaveCount(0);
  expect((await page.goto(`${VIN_SIN_API}/reclutador/integraciones`))?.status()).toBe(404);

  // 9001 la publicó el Puente por la API (montaje de las E2E): con la API apagada no se presenta como conectada.
  await page.goto(`${VIN_SIN_API}/reclutador`);
  await page.locator('[data-testid="fila-vacante"][data-external-job-id="9001"]').getByRole("link").first().click();
  await expect(page.getByRole("heading", { name: /Postulantes/ })).toBeVisible();
  await expect(page.getByText("Solicitud sencilla en el Simulador LinkedIn")).toBeVisible();
  await expect(page.getByText(/entregada a «/)).toHaveCount(0);
  await expect(page.getByText(/se entregan automáticamente al ATS/)).toHaveCount(0);

  await page.goto(`${VIN_SIN_API}/reclutador/vacantes/nueva`);
  await expect(page.getByLabel("Título del cargo")).toBeVisible();
  await expect(page.getByLabel("Entregar las solicitudes a un ATS conectado")).toHaveCount(0);
});

test("candidato: la Solicitud sencilla no menciona un ATS conectado", async ({ page }) => {
  await registrarCandidato(page, "Lucía", `SinApi ${sufijoUnico()}`, correoUnico("sin.api"));
  await abrirVacante(page, "9001");
  const id = new URL(page.url()).pathname.split("/").pop();
  await page.goto(`${VIN_SIN_API}/empleos/${id}/solicitar`);
  await page.getByLabel("Ciudad").fill("Medellín");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText(/Ley 1581 de 2012/)).toBeVisible();
  await expect(page.getByText(/ATS conectado/)).toHaveCount(0);
});

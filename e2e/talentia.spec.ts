import { expect, test } from "@playwright/test";
import { TAL } from "./procesos";
import { correoUnico, iniciarSesionTalentia } from "./utilidades";

// Criterios 2 y 3 de la v2 sobre Talentia, desde la interfaz y con HTTP real.

async function crearLlave(page: import("@playwright/test").Page, nombre: string, modificacion: boolean) {
  await page.goto(`${TAL}/admin/api-keys`);
  await page.getByLabel("Nombre").fill(nombre);
  const casilla = page.getByLabel("Modificación");
  if (modificacion) await casilla.check();
  else await casilla.uncheck();
  await page.getByRole("button", { name: "Crear llave" }).click();
  const valor = page.getByTestId("valor-llave");
  await expect(valor).toBeVisible();
  return (await valor.textContent())!.trim();
}

test.describe("Talentia", () => {
  test("criterio 2 · el admin crea una API Key, la ve una sola vez y con ella crea un postulante; solo Lectura → 403; revocada → 401", async ({ page, request }) => {
    await iniciarSesionTalentia(page, "admin");
    const llave = await crearLlave(page, `Integración E2E ${Date.now()}`, true);
    expect(llave).toMatch(/^tal_[0-9a-f]{8}\./);
    const prefijo = llave.slice(0, 12);

    // Una sola vez: al volver a la pantalla ya no aparece; la lista solo muestra el prefijo.
    await page.reload();
    await expect(page.getByTestId("valor-llave")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(llave);
    const fila = page.locator(`[data-testid="fila-llave"][data-prefijo="${prefijo}"]`);
    await expect(fila).toContainText(`${prefijo}…`);
    await expect(fila).toContainText("Modificación");

    const correo = correoUnico("api");
    const creado = await request.post(`${TAL}/api/v1/seleccion/postulantes`, {
      headers: { auth_token: llave },
      data: { nombre: "Persona", apellido: "Por API", correo },
    });
    expect(creado.status()).toBe(201);
    expect((await creado.json()).data.correo).toBe(correo);

    const soloLectura = await crearLlave(page, `Solo lectura E2E ${Date.now()}`, false);
    const prohibido = await request.post(`${TAL}/api/v1/seleccion/postulantes`, { headers: { auth_token: soloLectura }, data: { nombre: "X", apellido: "Y", correo: correoUnico("x") } });
    expect(prohibido.status()).toBe(403);
    expect((await request.get(`${TAL}/api/v1/seleccion/procesos`, { headers: { auth_token: soloLectura } })).status()).toBe(200);

    await page.goto(`${TAL}/admin/api-keys`);
    await fila.getByRole("button", { name: /Revocar/ }).click();
    await expect(fila).toContainText("Revocada");
    const revocada = await request.get(`${TAL}/api/v1/seleccion/procesos`, { headers: { auth_token: llave } });
    expect(revocada.status()).toBe(401);

    // El registro de actividad muestra las llamadas con el prefijo, sin cuerpos.
    await page.goto(`${TAL}/admin/actividad-api`);
    await expect(page.getByTestId("fila-actividad").filter({ hasText: prefijo }).first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(correo);
  });

  test("un reclutador no entra a la administración de API Keys", async ({ page }) => {
    await iniciarSesionTalentia(page, "reclutador");
    await expect(page.getByRole("link", { name: "API Keys" })).toHaveCount(0);
    await page.goto(`${TAL}/admin/api-keys`);
    await expect(page).toHaveURL(/error=permiso/);
    await expect(page.getByText("Tu rol no tiene acceso a esa sección.")).toBeVisible();
  });

  test("criterio 3 · /apidocs carga sin sesión con Swagger UI y el documento OpenAPI", async ({ page }) => {
    await page.goto(`${TAL}/apidocs`);
    await expect(page.getByRole("heading", { name: "Documentación de la API del Simulador BUK" })).toBeVisible();
    await expect(page.getByText("Entorno de simulación").first()).toBeVisible();
    await expect(page.locator("#swagger")).toContainText("/api/v1/seleccion/postulantes", { timeout: 20_000 });
    await expect(page.getByRole("button", { name: /Authorize/ })).toBeVisible();
  });

  test("vista tabla, mover una tarjeta de etapa y verlo en el historial de la ficha", async ({ page }) => {
    await iniciarSesionTalentia(page, "reclutador");
    await page.goto(`${TAL}/seleccion/procesos/9004`);
    const postulantes = page.locator('[data-etapa="Postulantes"]');
    const tarjeta = postulantes.getByTestId("tarjeta-postulante").first();
    const nombre = (await tarjeta.getByRole("link").textContent())!.trim();
    await tarjeta.getByLabel(new RegExp(`Mover a ${nombre}`)).selectOption({ label: "Por contactar" });
    await tarjeta.getByRole("button", { name: "Mover" }).click();
    await expect(page.locator('[data-etapa="Por contactar"]').getByTestId("tarjeta-postulante").filter({ hasText: nombre })).toBeVisible();

    await page.getByRole("link", { name: "Vista tabla" }).click();
    await expect(page.getByTestId("vista-tabla").getByTestId("fila-postulacion").filter({ hasText: nombre })).toContainText("Por contactar");

    await page.getByTestId("vista-tabla").getByRole("link", { name: nombre }).click();
    await expect(page.getByTestId("historial")).toContainText("Pasó de «Postulantes» a «Por contactar»");
    await expect(page.getByTestId("historial")).toContainText("Julián Herrera");
  });
});

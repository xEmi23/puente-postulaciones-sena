import { expect, test, type Page } from "@playwright/test";
import { PUE, VIN } from "./procesos";
import { correoUnico, iniciarSesionDemo, iniciarSesionVinculo, postular, quitarFallos, sufijoUnico } from "./utilidades";

async function fallo(page: Page, ruta: string, modo: string, n: string) {
  await page.goto(`${PUE}/pruebas`);
  await page.getByLabel("Operación del ATS").selectOption(ruta);
  await page.getByLabel("Tipo de fallo").selectOption(modo);
  await page.getByLabel(/Solicitudes afectadas/).fill(n);
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page.getByText("Fallo configurado")).toBeVisible();
}

async function abrirOperacionDeConfirmacion(page: Page) {
  const ref = (await page.getByTestId("job-application-id").textContent())!.trim();
  await page.goto(`${PUE}/`);
  const fila = page.locator(`[data-testid="fila-operacion"][data-job-application-id="${ref}"]`);
  await expect(fila).toBeVisible({ timeout: 30_000 });
  await fila.getByRole("link").click();
}

test.describe("P5 · vacantes y casos de fallo", () => {
  test.afterEach(async ({ page }, info) => {
    info.setTimeout(info.timeout + 30_000); // la limpieza no compite con el tiempo de la prueba
    await quitarFallos(page);
  });
  test("editar, cerrar y reabrir una vacante en Vínculo: deja de recibir solicitudes y vuelve a aparecer", async ({ page }) => {
    await iniciarSesionVinculo(page, "reclutadora");
    await page.goto(`${VIN}/reclutador/vacantes/nueva`);
    const titulo = `Analista de Datos ${sufijoUnico()}`;
    await page.getByLabel("Título del cargo").fill(titulo);
    await page.getByLabel("Descripción").fill("Analizarás datos de operación y construirás tableros para el equipo. Vacante ficticia de la demostración.");
    await page.getByLabel("Ciudad").fill("Medellín");
    await page.getByRole("button", { name: "Publicar vacante" }).click();
    await expect(page.locator(".alerta-exito")).toContainText(/Vacante VIN-\d{4}-\d{4} publicada/);

    // Editar.
    await page.getByTestId("fila-vacante").getByRole("link", { name: titulo }).click();
    await page.getByLabel("Título del cargo").fill(`${titulo} (editada)`);
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.locator(".alerta-exito")).toContainText("Cambios guardados.");
    const urlReclutador = page.url().split("?")[0];
    await page.getByRole("link", { name: "Ver como candidato" }).click();
    await page.waitForURL(/\/empleos\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${titulo} (editada)`);
    const urlVacante = page.url();

    // Cerrar: no aparece en el buscador y la vacante ya no recibe solicitudes.
    await page.goto(urlReclutador);
    await page.getByRole("button", { name: "Cerrar vacante" }).click();
    await expect(page.locator(".alerta-exito")).toContainText("Vacante cerrada");
    await page.goto(`${VIN}/empleos?q=${encodeURIComponent(titulo)}`);
    await expect(page.getByRole("link", { name: new RegExp(titulo) })).toHaveCount(0);
    await page.goto(urlVacante);
    await expect(page.getByText("Esta vacante ya no recibe postulaciones.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Solicitud sencilla" })).toHaveCount(0);

    // Reabrir.
    await page.goto(urlReclutador);
    await page.getByRole("button", { name: "Publicar vacante" }).click();
    await expect(page.locator(".alerta-exito")).toContainText("Vacante publicada.");
    await page.goto(`${VIN}/empleos?q=${encodeURIComponent(titulo)}`);
    await expect(page.getByRole("link", { name: new RegExp(titulo) })).toHaveCount(1);
  });

  test("error de autenticación con el ATS: no reintenta, explica qué hacer y «Reintentar» lo completa", async ({ page }) => {
    await iniciarSesionDemo(page);
    await fallo(page, "candidatos", "CREDENCIALES", "-1");
    await postular(page, { apellido: `Credenciales ${sufijoUnico()}`, correo: correoUnico("credenciales") });
    await abrirOperacionDeConfirmacion(page);
    await expect(page.getByTestId("estado-operacion")).toHaveText("Fallido (reintentable)", { timeout: 30_000 });
    await expect(page.getByText("La API Key del Simulador BUK fue revocada o no es válida.").first()).toBeVisible();
    await expect(page.getByText(/Administración → API Keys/)).toBeVisible();
    const url = page.url();
    await page.goto(`${PUE}/pruebas`);
    await page.getByRole("button", { name: "Quitar todos los fallos" }).click();
    await page.goto(url);
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.locator(".alerta-exito")).toContainText("Reintento programado");
    await expect(page.getByTestId("estado-operacion")).toHaveText("Completado", { timeout: 30_000 });
  });

  test("transferencia del CV interrumpida: se detecta, se reintenta y completa", async ({ page }) => {
    await iniciarSesionDemo(page);
    await fallo(page, "media", "INTERRUMPIR", "1");
    await postular(page, { apellido: `Interrumpido ${sufijoUnico()}`, correo: correoUnico("interrumpido") });
    await abrirOperacionDeConfirmacion(page);
    await expect(page.getByTestId("estado-operacion")).toHaveText("Completado", { timeout: 30_000 });
    await expect(page.getByTestId("linea-tiempo")).toContainText("CV_TRANSFERENCIA_INCOMPLETA");
  });
});

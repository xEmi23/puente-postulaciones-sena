import { expect, test, type Page } from "@playwright/test";
import { correoUnico, iniciarSesionDemo, postular, sufijoUnico } from "./utilidades";

async function fallo(page: Page, ruta: string, modo: string, n: string) {
  await page.goto("/puente/pruebas");
  await page.getByLabel("Operación del ATS").selectOption(ruta);
  await page.getByLabel("Tipo de fallo").selectOption(modo);
  await page.getByLabel(/Solicitudes afectadas/).fill(n);
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page.getByText("Fallo configurado")).toBeVisible();
}

async function abrirOperacionDeConfirmacion(page: Page) {
  const ref = (await page.getByTestId("job-application-id").textContent())!.trim();
  await page.goto("/puente");
  const fila = page.locator(`[data-testid="fila-operacion"][data-job-application-id="${ref}"]`);
  await expect(fila).toBeVisible({ timeout: 30_000 });
  await fila.getByRole("link").click();
}

test.describe("P5 · vacantes y casos de fallo", () => {
  test("editar y cerrar una vacante: desaparece del portal, el puente la marca cerrada y al reabrir vuelve", async ({ page }) => {
    await iniciarSesionDemo(page);
    // Crea una vacante propia y la vincula para no afectar a las demás pruebas.
    await page.goto("/origen/admin/vacantes/nueva");
    const titulo = `Analista de Datos ${sufijoUnico()}`;
    await page.getByLabel("Título del cargo").fill(titulo);
    await page.getByLabel("Área").fill("Datos");
    await page.getByLabel("Ciudad").fill("Medellín");
    await page.getByLabel("Descripción").fill("Analizarás datos de operación y construirás tableros para el equipo. Vacante ficticia de la demostración.");
    await page.getByRole("button", { name: "Publicar vacante" }).click();
    const codigo = (await page.locator(".alerta-exito").textContent())!.match(/RT-\d{4}-\d{3}/)![0];
    await page.goto("/puente/correspondencias");
    await page.getByLabel("Código de la vacante en el origen").fill(codigo);
    await page.getByLabel("Proceso del ATS").selectOption("9002");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.locator(".alerta-exito")).toContainText(codigo);

    // Editar.
    await page.goto(`/origen/admin/vacantes/${codigo}`);
    await page.getByLabel("Título del cargo").fill(`${titulo} (editada)`);
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.locator(".alerta-exito")).toContainText(`Vacante ${codigo} actualizada.`);
    await page.goto(`/origen/vacantes/${codigo}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${titulo} (editada)`);

    // Cerrar.
    await page.goto("/origen/admin");
    await page.locator(`[data-testid="fila-vacante"][data-codigo="${codigo}"]`).getByRole("button", { name: "Cerrar" }).click();
    await expect(page.locator(".alerta-exito")).toContainText(`Vacante ${codigo} cerrada.`);
    await page.goto("/origen");
    await expect(page.getByRole("link", { name: new RegExp(titulo) })).toHaveCount(0);
    await page.goto(`/origen/vacantes/${codigo}`);
    await expect(page.getByText("Esta vacante ya no recibe postulaciones.")).toBeVisible();
    await page.goto("/puente/correspondencias");
    const fila = page.getByTestId("fila-correspondencia").filter({ hasText: codigo });
    await expect(fila).toContainText("Cerrada en el origen", { timeout: 20_000 }); // el evento viaja por la outbox

    // Reabrir.
    await page.goto("/origen/admin");
    await page.locator(`[data-testid="fila-vacante"][data-codigo="${codigo}"]`).getByRole("button", { name: "Publicar" }).click();
    await page.goto("/puente/correspondencias");
    await expect(page.getByTestId("fila-correspondencia").filter({ hasText: codigo })).toContainText("Activa", { timeout: 20_000 });
  });

  test("error de autenticación con el ATS: no reintenta, explica qué hacer y «Reintentar» lo completa", async ({ page }) => {
    await iniciarSesionDemo(page);
    await fallo(page, "candidatos", "CREDENCIALES", "-1");
    await postular(page, { apellido: `Credenciales ${sufijoUnico()}`, correo: correoUnico("credenciales") });
    await abrirOperacionDeConfirmacion(page);
    await expect(page.getByTestId("estado-operacion")).toHaveText("Fallido (reintentable)", { timeout: 30_000 });
    await expect(page.getByText(/rechazó las credenciales del puente/).first()).toBeVisible();
    await expect(page.getByText(/Revisa ATS_API_KEY/)).toBeVisible();
    const url = page.url();
    await page.goto("/puente/pruebas");
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

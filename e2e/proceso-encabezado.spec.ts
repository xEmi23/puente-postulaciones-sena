import { expect, test } from "@playwright/test";
import { PUE, TAL, VIN } from "./procesos";
import { correoUnico, iniciarSesionDemo, postular, sufijoUnico } from "./utilidades";

test("encabezado del proceso con prioridad, inicio, vigencia y estado; casilla visual en la tarjeta", async ({ page }) => {
  const apellido = `Encabezado ${sufijoUnico()}`;
  await postular(page, { apellido, correo: correoUnico("encabezado") });
  await expect(page.locator("[data-estado-entrega]")).toHaveText("Entregada a la empresa", { timeout: 30_000 });

  await iniciarSesionDemo(page);
  await page.goto(`${TAL}/seleccion/procesos/9001`);
  const meta = page.getByTestId("meta-proceso");
  await expect(meta).toContainText("Prioridad");
  await expect(meta).toContainText("Alta");
  await expect(meta).toContainText("Fecha de inicio");
  await expect(page.getByTestId("vigencia")).toHaveText("10 días");
  await expect(meta).toContainText("Iniciado");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("9001");

  const tarjeta = page.getByTestId("tarjeta-postulante").filter({ hasText: apellido });
  await expect(tarjeta).toBeVisible({ timeout: 30_000 });
  const casilla = tarjeta.getByRole("checkbox", { name: new RegExp(`Seleccionar a .*${apellido}`) });
  await expect(casilla).not.toBeChecked();
  await casilla.check();
  await expect(casilla).toBeChecked();
  await expect(tarjeta).toContainText("Sin calificar");

  await page.goto(`${TAL}/seleccion/procesos`);
  await expect(page.locator("tbody tr", { hasText: "9001" })).toContainText("Iniciado");
});

test("ningún texto visible dice «LinkedIn Easy Apply»", async ({ page }) => {
  await iniciarSesionDemo(page);
  for (const ruta of [`${VIN}/`, `${VIN}/empleos`, `${TAL}/seleccion/procesos`, `${TAL}/seleccion/procesos/9001`, `${TAL}/seleccion/procesos/9002`, `${PUE}/`, `${VIN}/developers/docs`]) {
    await page.goto(ruta);
    await expect(page.locator("body")).not.toContainText("LinkedIn Easy Apply");
  }
  await page.goto(`${TAL}/seleccion/procesos/9001`);
  const enlace = page.getByTestId("tarjeta-postulante").first().getByRole("link");
  if (await enlace.count()) {
    await enlace.click();
    await expect(page.locator("body")).not.toContainText("LinkedIn Easy Apply");
    await expect(page.locator("body")).toContainText("Portal simulado (tipo LinkedIn)");
  }
});

import { expect, test } from "@playwright/test";
import { PUE, TAL, VIN } from "./procesos";
import { correoUnico, iniciarSesionDemo, postular, sufijoUnico } from "./utilidades";

// Se ejecuta en el proyecto "movil" (Pixel 7) y también en escritorio.
test("@movil postulación, tablero del ATS y panel usables sin desbordes horizontales", async ({ page }) => {
  const sinDesborde = async () => {
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(ancho).toBeLessThanOrEqual(1);
  };
  await page.goto(`${VIN}/`);
  await sinDesborde();
  const apellido = `Movil ${sufijoUnico()}`;
  await postular(page, { apellido, correo: correoUnico("movil") });
  await expect(page.getByRole("heading", { name: "¡Tu postulación fue enviada!" })).toBeVisible();
  await sinDesborde();
  await expect(page.locator("[data-estado-entrega]")).toHaveText("Entregada a la empresa", { timeout: 30_000 });

  await iniciarSesionDemo(page);
  await page.goto(`${TAL}/seleccion/procesos/9001`);
  await expect(page.getByTestId("tarjeta-postulante").filter({ hasText: apellido })).toBeVisible({ timeout: 30_000 });
  await sinDesborde(); // el tablero se desplaza dentro de su propio contenedor
  await page.goto(`${PUE}/`);
  await sinDesborde();
  await expect(page.getByText("Entorno de simulación").first()).toBeVisible();
});

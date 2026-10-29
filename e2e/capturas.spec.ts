import { mkdirSync } from "node:fs";
import path from "node:path";
import { test, type Page } from "@playwright/test";
import { PUE, TAL, VIN } from "./procesos";
import { abrirVacante, iniciarSesionPuente, iniciarSesionTalentia, iniciarSesionVinculo, salirDeVinculo } from "./utilidades";

// Capturas de las pantallas principales para revisarlas a ojo (F4). Solo con CAPTURAS=1:
//   CAPTURAS=1 npx playwright test e2e/capturas.spec.ts --project=escritorio   (y --project=movil)
// Se guardan en capturas/<proyecto>/ (carpeta ignorada por git).
test.skip(!process.env.CAPTURAS, "Solo con CAPTURAS=1");

async function capturar(page: Page, nombre: string, proyecto: string) {
  const dir = path.resolve(__dirname, "../capturas", proyecto);
  mkdirSync(dir, { recursive: true });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.screenshot({ path: path.join(dir, `${nombre}.png`), fullPage: true });
}

test("@movil capturas de los tres sistemas", async ({ page }, info) => {
  test.setTimeout(240_000);
  const p = info.project.name;
  for (const [ruta, nombre] of [
    [`${VIN}/`, "vin-01-portada"],
    [`${VIN}/empleos`, "vin-02-empleos"],
    [`${VIN}/empleos?q=zzzz-sin-resultados`, "vin-03-empleos-vacio"],
    [`${VIN}/empresas/andina-software`, "vin-04-empresa"],
    [`${VIN}/ingresar`, "vin-05-ingresar"],
  ]) {
    await page.goto(ruta);
    await capturar(page, nombre, p);
  }
  await abrirVacante(page, "9001");
  await capturar(page, "vin-06-vacante", p);
  await iniciarSesionVinculo(page, "candidata");
  for (const [ruta, nombre] of [
    [`${VIN}/mis-postulaciones`, "vin-07-mis-postulaciones"],
    [`${VIN}/mi-perfil`, "vin-08-mi-perfil"],
    [`${VIN}/in/valentina-rios-gaviria`, "vin-09-perfil-publico"],
  ]) {
    await page.goto(ruta);
    await capturar(page, nombre, p);
  }
  await abrirVacante(page, "9002");
  await page.getByRole("link", { name: "Solicitud sencilla" }).click();
  await capturar(page, "vin-10-solicitud", p);
  await iniciarSesionVinculo(page, "reclutadora");
  for (const [ruta, nombre] of [
    [`${VIN}/reclutador`, "vin-11-reclutador"],
    [`${VIN}/reclutador/integraciones`, "vin-12-integraciones"],
    [`${VIN}/developers`, "vin-13-developers"],
    [`${VIN}/developers/docs`, "vin-14-developers-docs"],
  ]) {
    await page.goto(ruta);
    await capturar(page, nombre, p);
  }
  await salirDeVinculo(page);

  await page.goto(`${TAL}/ingresar`);
  await capturar(page, "tal-01-ingresar", p);
  await iniciarSesionTalentia(page, "admin");
  for (const [ruta, nombre] of [
    [`${TAL}/seleccion/procesos`, "tal-02-procesos"],
    [`${TAL}/seleccion/procesos/9001`, "tal-03-tablero"],
    [`${TAL}/seleccion/procesos/9001?vista=tabla`, "tal-04-tabla"],
    [`${TAL}/seleccion/procesos/nuevo`, "tal-05-nuevo"],
    [`${TAL}/admin/api-keys`, "tal-06-api-keys"],
    [`${TAL}/admin/actividad-api`, "tal-07-actividad"],
    [`${TAL}/apidocs`, "tal-08-apidocs"],
  ]) {
    await page.goto(ruta);
    await capturar(page, nombre, p);
  }
  await page.goto(`${TAL}/seleccion/procesos/9001`);
  await page.getByTestId("tarjeta-postulante").first().getByRole("link").first().click();
  await capturar(page, "tal-09-postulante", p);

  await page.goto(`${PUE}/ingresar`);
  await capturar(page, "pue-01-ingresar", p);
  await iniciarSesionPuente(page, "admin");
  for (const [ruta, nombre] of [
    [`${PUE}/operaciones`, "pue-02-operaciones"],
    [`${PUE}/conexiones`, "pue-03-conexiones"],
    [`${PUE}/procesos`, "pue-04-procesos"],
    [`${PUE}/correspondencias`, "pue-05-correspondencias"],
    [`${PUE}/rechazos`, "pue-06-rechazos"],
    [`${PUE}/metricas`, "pue-07-metricas"],
    [`${PUE}/pruebas`, "pue-08-pruebas"],
  ]) {
    await page.goto(ruta);
    await capturar(page, nombre, p);
  }
  const fila = page.getByTestId("fila-operacion").first();
  await page.goto(`${PUE}/operaciones`);
  if (await fila.count()) {
    await fila.getByRole("link").click();
    await capturar(page, "pue-09-operacion", p);
  }
});

import { expect, test, type Page } from "@playwright/test";
import { PUE, TAL, VIN } from "./procesos";
import { iniciarSesionPuente, iniciarSesionTalentia, iniciarSesionVinculo } from "./utilidades";

// D-74: en las pantallas visibles las simulaciones se llaman «Simulador LinkedIn» y «Simulador BUK». Esta prueba falla
// si reaparece «Vínculo» o «Talentia» en el texto, el título de la pestaña o un atributo visible (title, placeholder,
// aria-label, alt), o si falta la franja «No es LinkedIn ni BUK: simulación académica».
const VIEJOS = /Vínculo|Vinculo\b|Talentia/;

async function revisar(page: Page, ruta: string, marca: "Simulador LinkedIn" | "Simulador BUK" | "Puente") {
  await page.goto(ruta);
  await page.waitForLoadState("networkidle");
  const franja = page.getByRole("note", { name: "Aviso de entorno" });
  await expect(franja, ruta).toContainText("Entorno de simulación");
  await expect(franja, ruta).toContainText("No es LinkedIn ni BUK: simulación académica");
  const visible = await page.evaluate(() => {
    const atributos = [...document.querySelectorAll("[title],[placeholder],[aria-label],[alt]")].flatMap((e) =>
      ["title", "placeholder", "aria-label", "alt"].map((a) => e.getAttribute(a) ?? ""),
    );
    return [document.title, document.body.innerText, ...atributos].join("\n");
  });
  const hallado = visible.split("\n").find((l) => VIEJOS.test(l));
  expect(hallado, `${ruta} muestra un nombre anterior: «${hallado}»`).toBeUndefined();
  expect(await page.title(), ruta).toContain(marca);
}

test("Simulador LinkedIn: portada, empleos, ingreso, registro, panel, vacante y ficha sin «Vínculo» ni «Talentia»", async ({ page }) => {
  for (const r of ["/", "/empleos", "/ingresar", "/registro", "/empresas/andina-software"]) await revisar(page, `${VIN}${r}`, "Simulador LinkedIn");
  await expect(page.getByRole("link", { name: "Simulador LinkedIn" }).first()).toBeVisible();
  await iniciarSesionVinculo(page, "reclutadora");
  await revisar(page, `${VIN}/reclutador`, "Simulador LinkedIn");
  await page.getByTestId("fila-vacante").first().getByRole("link").first().click();
  await revisar(page, page.url(), "Simulador LinkedIn");
  const ficha = page.getByTestId("enlace-ficha").first();
  if (await ficha.count()) {
    await ficha.click();
    await revisar(page, page.url(), "Simulador LinkedIn");
  }
});

test("Simulador BUK: ingreso, procesos, tablero, postulantes, API Keys y documentación sin «Vínculo» ni «Talentia»", async ({ page }) => {
  await revisar(page, `${TAL}/ingresar`, "Simulador BUK");
  await iniciarSesionTalentia(page, "admin");
  for (const r of ["/seleccion/procesos", "/seleccion/procesos/9001", "/admin/api-keys", "/apidocs"]) await revisar(page, `${TAL}${r}`, "Simulador BUK");
  await expect(page.getByText("Simulador BUK").first()).toBeVisible();
});

test("Puente: Operaciones, Importar, Fuentes, Correspondencias, Procesos, Conexiones y Métricas sin «Vínculo» ni «Talentia»", async ({ page }) => {
  await iniciarSesionPuente(page, "admin");
  for (const r of ["/operaciones", "/importar", "/fuentes", "/correspondencias", "/procesos", "/conexiones", "/metricas"]) await revisar(page, `${PUE}${r}`, "Puente");
  await page.goto(`${PUE}/fuentes`);
  await expect(page.locator('[data-testid="fila-fuente"][data-fuente="importador"]')).toContainText("Importador manual");
  await expect(page.locator('[data-testid="fila-fuente"][data-fuente="apply-connect"]')).toContainText("Simulador LinkedIn (Apply Connect)");
});

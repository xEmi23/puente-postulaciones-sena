import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { PUE, TAL, VIN } from "./procesos";
import { abrirVacante, correoUnico, iniciarSesionDemo, iniciarSesionVinculo, postular, registrarCandidato, sufijoUnico } from "./utilidades";

// Auditoría automática con axe (WCAG 2.1 A/AA). Falla ante violaciones serias o críticas.
async function auditar(page: Page, nombre: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const graves = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const detalle = graves.flatMap((v) =>
    v.nodes.map((n) => `${nombre}: ${v.id} → ${n.html.slice(0, 100)} · ${(n.failureSummary ?? "").replace(/\s+/g, " ").slice(0, 220)}`),
  );
  expect(detalle).toEqual([]);
}

test("las pantallas principales no tienen violaciones de accesibilidad serias", async ({ page }) => {
  test.setTimeout(120_000);
  // Vínculo (público, candidato y reclutadora).
  for (const [ruta, nombre] of [
    [`${VIN}/`, "portada"],
    [`${VIN}/empleos`, "buscador"],
    [`${VIN}/ingresar`, "ingreso Vínculo"],
    [`${VIN}/registro`, "registro"],
    [`${VIN}/empresas/andina-software`, "empresa"],
    [`${VIN}/developers/docs`, "documentación Vínculo"],
  ]) {
    await page.goto(ruta);
    if (ruta.includes("docs") || ruta.includes("apidocs")) await expect(page.locator("#swagger")).toContainText("/api/v1", { timeout: 20_000 });
    await auditar(page, nombre);
  }
  await abrirVacante(page, "RT-2026-101");
  await auditar(page, "detalle de vacante");
  await postular(page, { apellido: `Accesible ${sufijoUnico()}`, correo: correoUnico("a11y") });
  await expect(page.getByRole("heading", { name: "¡Tu solicitud fue enviada!" })).toBeVisible();
  await auditar(page, "confirmación");
  for (const [ruta, nombre] of [
    [`${VIN}/mis-postulaciones`, "mis postulaciones"],
    [`${VIN}/mi-perfil`, "mi perfil"],
    [`${VIN}/developers`, "portal de desarrolladores"],
  ]) {
    await page.goto(ruta);
    if (ruta.includes("docs") || ruta.includes("apidocs")) await expect(page.locator("#swagger")).toContainText("/api/v1", { timeout: 20_000 });
    await auditar(page, nombre);
  }
  await page.goto(`${VIN}/in/valentina-rios-gaviria`);
  await auditar(page, "perfil público");
  await iniciarSesionVinculo(page, "reclutadora");
  for (const [ruta, nombre] of [
    [`${VIN}/reclutador`, "panel reclutador"],
    [`${VIN}/reclutador/vacantes/nueva`, "publicar vacante"],
    [`${VIN}/reclutador/integraciones`, "integraciones"],
  ]) {
    await page.goto(ruta);
    if (ruta.includes("docs") || ruta.includes("apidocs")) await expect(page.locator("#swagger")).toContainText("/api/v1", { timeout: 20_000 });
    await auditar(page, nombre);
  }
  await page.goto(`${VIN}/reclutador`);
  await page.getByTestId("fila-vacante").first().getByRole("link").click();
  await auditar(page, "vacante del reclutador");

  // Talentia y puente.
  await page.goto(`${TAL}/ingresar`);
  await auditar(page, "ingreso Talentia");
  await page.goto(`${PUE}/ingresar`);
  await auditar(page, "ingreso puente");
  await iniciarSesionDemo(page);
  for (const [ruta, nombre] of [
    [`${PUE}/`, "panel"],
    [`${PUE}/correspondencias`, "correspondencias"],
    [`${PUE}/rechazos`, "rechazos"],
    [`${PUE}/pruebas`, "controles de prueba"],
    [`${TAL}/seleccion/procesos`, "procesos Talentia"],
    [`${TAL}/seleccion/procesos/9001`, "tablero Talentia"],
    [`${TAL}/seleccion/procesos/9001?vista=tabla`, "vista tabla"],
    [`${TAL}/seleccion/procesos/nuevo`, "nuevo proceso"],
    [`${TAL}/seleccion/postulantes`, "postulantes"],
    [`${TAL}/admin/api-keys`, "API Keys"],
    [`${TAL}/admin/actividad-api`, "actividad API"],
    [`${TAL}/apidocs`, "documentación Talentia"],
  ]) {
    await page.goto(ruta);
    if (ruta.includes("docs") || ruta.includes("apidocs")) await expect(page.locator("#swagger")).toContainText("/api/v1", { timeout: 20_000 });
    await auditar(page, nombre);
  }
  await page.goto(`${PUE}/`);
  await page.getByTestId("fila-operacion").first().getByRole("link").click();
  await auditar(page, "detalle de operación");
  await page.goto(`${TAL}/seleccion/procesos/9001`);
  await page.getByTestId("tarjeta-postulante").first().getByRole("link").click();
  await auditar(page, "ficha del postulante");
});

test("navegación por teclado: saltar al contenido y completar la Solicitud sencilla sin ratón", async ({ page }) => {
  await registrarCandidato(page, "Laura", `Teclado ${sufijoUnico()}`, correoUnico("teclado"));
  await abrirVacante(page, "RT-2026-102");
  await page.getByRole("link", { name: "Solicitud sencilla" }).click();
  await expect(page.getByRole("heading", { name: "Solicitud sencilla" })).toBeVisible();
  await page.goto(page.url()); // carga completa: el foco empieza en el documento, como al llegar por un enlace externo
  await page.waitForLoadState("networkidle"); // el formulario ya está hidratado
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Saltar al contenido" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#contenido$/);

  await page.getByLabel("Nombre", { exact: true }).focus();
  for (const etiqueta of ["Apellido", "Correo electrónico", /^Teléfono/, "Ciudad"]) {
    await page.keyboard.press("Tab");
    await expect(page.getByLabel(etiqueta)).toBeFocused();
  }
  await page.keyboard.type("Itagüí");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Continuar" })).toBeFocused();
  await page.keyboard.press("Enter");
  await page.getByLabel("Hoja de vida (PDF)").setInputFiles("fixtures/cv/cv-sofia-demo.pdf");
  await page.getByRole("button", { name: "Enviar solicitud" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "¡Tu solicitud fue enviada!" })).toBeVisible();
});

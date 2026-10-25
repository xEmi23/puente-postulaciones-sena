import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { correoUnico, iniciarSesionDemo, postular, sufijoUnico } from "./utilidades";

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
  await page.goto("/");
  await auditar(page, "inicio");
  await page.goto("/origen");
  await auditar(page, "catálogo");
  await page.goto("/origen/vacantes/RT-2026-101");
  await auditar(page, "detalle de vacante");
  await page.getByRole("button", { name: "Enviar postulación" }).click();
  await expect(page.getByText("Revisa los campos marcados para continuar.")).toBeVisible();
  await auditar(page, "formulario con errores");
  await postular(page, { apellido: `Accesible ${sufijoUnico()}`, correo: correoUnico("a11y") });
  await expect(page.getByRole("heading", { name: "¡Tu postulación fue enviada!" })).toBeVisible();
  await auditar(page, "confirmación");
  await page.goto("/ingresar");
  await auditar(page, "ingreso");
  await iniciarSesionDemo(page);
  for (const [ruta, nombre] of [
    ["/puente", "panel"],
    ["/puente/correspondencias", "correspondencias"],
    ["/puente/rechazos", "rechazos"],
    ["/puente/pruebas", "controles de prueba"],
    ["/ats", "procesos ATS"],
    ["/ats/procesos/9001", "tablero ATS"],
    ["/ats/procesos/nuevo", "nuevo proceso"],
    ["/origen/admin", "admin origen"],
    ["/origen/admin/vacantes/nueva", "publicar vacante"],
    ["/origen/admin/consola", "consola"],
  ]) {
    await page.goto(ruta);
    await auditar(page, nombre);
  }
  await page.goto("/puente");
  await page.getByTestId("fila-operacion").first().getByRole("link").click();
  await auditar(page, "detalle de operación");
  await page.goto("/ats/procesos/9001");
  await page.getByTestId("tarjeta-postulante").first().getByRole("link").click();
  await auditar(page, "detalle de candidato");
});

test("navegación por teclado: saltar al contenido y completar la postulación sin ratón", async ({ page }) => {
  await page.goto("/origen/vacantes/RT-2026-102");
  await page.waitForLoadState("networkidle"); // el formulario ya está hidratado
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Saltar al contenido" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#contenido$/);

  await page.getByLabel("Nombre").focus();
  await page.keyboard.type("Laura");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Apellido")).toBeFocused();
  await page.keyboard.type(`Teclado ${sufijoUnico()}`);
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Correo electrónico")).toBeFocused();
  await page.keyboard.type(correoUnico("teclado"));
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Teléfono")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Ciudad")).toBeFocused();
  await page.keyboard.type("Itagüí");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Hoja de vida (PDF)")).toBeFocused();
  await page.getByLabel("Hoja de vida (PDF)").setInputFiles("fixtures/cv/cv-sofia-demo.pdf");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Enviar postulación" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "¡Tu postulación fue enviada!" })).toBeVisible();
});

test("con errores, el foco va al primer campo inválido", async ({ page }) => {
  await page.goto("/origen/vacantes/RT-2026-101");
  await page.getByLabel("Nombre").fill("Ana");
  await page.getByRole("button", { name: "Enviar postulación" }).click();
  await expect(page.getByLabel("Apellido")).toBeFocused();
});

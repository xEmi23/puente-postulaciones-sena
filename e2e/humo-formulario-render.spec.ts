import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

// Prueba de humo del formulario público en Render (V4 F6). No corre en la suite local ni reconfigura conexiones:
//   RENDER_HUMO=1 npx playwright test -c playwright.render-formulario.config.ts
// Crea (o reutiliza) el enlace público del proceso RENDER_PROCESO, postula con un PDF ficticio y verifica Postulantes
// del Simulador BUK con el mismo SHA-256, el duplicado, /privacidad y que el panel exige sesión.
test.skip(!process.env.RENDER_HUMO, "Solo con RENDER_HUMO=1");
test.describe.configure({ mode: "serial" });

const TAL = process.env.RENDER_TAL ?? "https://talentia-simulado.onrender.com";
const PUE = process.env.RENDER_PUE ?? "https://puente-postulaciones.onrender.com";
const PROCESO = process.env.RENDER_PROCESO ?? "9006";
const CLAVE = "Demo2026!";
const CV = path.resolve(__dirname, "../fixtures/cv/cv-camila-ejemplo.pdf");
const sha = createHash("sha256").update(readFileSync(CV)).digest("hex");
const marca = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
const apellido = `Humo ${marca}`;
const correo = `humo.formulario.${marca}@demo.test`;
let enlace = "";
const DESCRIPCION_PRUEBA = [
  "Buscamos un Gerente Administrativo para liderar la gestión administrativa y financiera de nuestra sede en Itagüí.",
  "",
  "- Planear, ejecutar y controlar el presupuesto, los costos y el flujo de caja.",
  "- Coordinar compras, proveedores, contratos y servicios generales.",
  "- Liderar al equipo administrativo y presentar indicadores mensuales a la gerencia general.",
  "- Requisitos: profesional en Administración de Empresas, Ingeniería Industrial o afines, con mínimo 5 años de experiencia en cargos similares y manejo avanzado de Excel y de un ERP.",
].join("\n");

async function ingresar(page: Page, base: string, cuenta: string) {
  await page.context().clearCookies();
  await page.goto(`${base}/ingresar`, { timeout: 120_000 });
  await page.getByLabel("Correo").fill(cuenta);
  await page.getByLabel("Contraseña").fill(CLAVE);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).not.toHaveURL(/ingresar/, { timeout: 60_000 });
}

async function postular(page: Page, correoUsado: string) {
  await page.context().clearCookies();
  await page.goto(enlace);
  await page.getByLabel("Nombres").fill("Daniela");
  await page.getByLabel("Apellidos").fill(apellido);
  await page.getByLabel("Correo").fill(correoUsado);
  await page.getByLabel("Indicativo del país").selectOption("+57");
  await page.getByLabel("Teléfono").fill("300 555 0142");
  await page.getByLabel("Ciudad de residencia").fill("Itagüí");
  await page.getByLabel("Hoja de vida en PDF").setInputFiles(CV);
  await page.getByLabel(/Autorizo el tratamiento de mis datos/).check();
  await page.waitForTimeout(3500);
  await page.getByRole("button", { name: "Enviar postulación" }).click();
  await expect(page.getByRole("heading", { name: "Recibimos tu postulación" })).toBeVisible();
  await expect(page.getByTestId("referencia")).toHaveText(/^[A-Z0-9]{8}$/);
}

test("0 · Puente y Simulador BUK despiertos", async ({ request }) => {
  for (const base of [PUE, TAL]) {
    await expect(async () => expect((await request.get(`${base}/api/salud`, { timeout: 120_000 })).ok()).toBe(true)).toPass({ timeout: 170_000 });
  }
});

test("1 · el panel exige sesión; el admin obtiene el enlace público del proceso", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto(`${PUE}/formulario`);
  await expect(page).toHaveURL(/\/ingresar/);
  await ingresar(page, PUE, "admin@puente.demo.test");
  await page.goto(`${PUE}/formulario`);
  const fila = page.locator(`[data-testid="fila-formulario"][data-proceso="${PROCESO}"]`);
  const crear = fila.getByRole("button", { name: new RegExp(`enlace público del proceso ${PROCESO}`) });
  if (await crear.count()) await crear.click();
  enlace = await fila.getByTestId("enlace-publico").inputValue();
  expect(enlace).toMatch(new RegExp(`^${PUE}/postular/[a-z0-9]{12}$`));
  console.log(`ENLACE PÚBLICO: ${enlace}`);

  // Ficha pública de la vacante de prueba (D-77): lo que ve el candidato. El proceso del ATS no cambia.
  if (process.env.RENDER_FICHA_PRUEBA) {
    const ficha = page.locator(`[data-testid="ficha-vacante"][data-proceso="${PROCESO}"]`);
    await ficha.getByLabel("Título público").fill("Gerente Administrativo");
    await ficha.getByLabel("Ciudad").fill("Itagüí, Antioquia");
    await ficha.getByLabel("Modalidad").selectOption("Presencial");
    await ficha.getByLabel("Tipo de empleo").selectOption("Tiempo completo");
    await ficha.getByLabel("Descripción corta").fill(DESCRIPCION_PRUEBA);
    await ficha.getByRole("button", { name: `Guardar datos de la vacante ${PROCESO}` }).click();
    await expect(page.locator(".alerta-exito")).toContainText("Datos de la vacante guardados");
  }
  await page.context().clearCookies();
  await page.goto(enlace);
  console.log(`TÍTULO PÚBLICO: ${await page.getByTestId("titulo-vacante").textContent()}`);
});

test("2 · el formulario carga y el envío llega a Postulantes del Simulador BUK con el mismo SHA-256", async ({ page }) => {
  await postular(page, correo);
  await ingresar(page, TAL, "reclutador@andina.demo.test");
  await expect(async () => {
    await page.goto(`${TAL}/seleccion/procesos/${PROCESO}`);
    await expect(page.locator('[data-etapa="Postulantes"]').getByTestId("tarjeta-postulante").filter({ hasText: apellido })).toHaveCount(1, { timeout: 5_000 });
  }).toPass({ timeout: 170_000 });
  await page.getByRole("link", { name: new RegExp(apellido) }).click();
  await expect(page.getByTestId("sha256-documento")).toHaveText(sha);
});

test("3 · el segundo envío es duplicado: misma confirmación y una sola postulación en el ATS", async ({ page }) => {
  await postular(page, correo.toUpperCase());
  await ingresar(page, PUE, "operador@puente.demo.test");
  await page.goto(`${PUE}/operaciones?fuente=formulario-publico`);
  await page.getByRole("row").filter({ hasText: "hu•••@demo.test" }).first().getByRole("link").first().click();
  await expect(page.locator("main")).toContainText("envió de nuevo el formulario de esta vacante; no se creó nada");
  await expect(page.getByTestId("estado-operacion")).toHaveText("Completado");
  await ingresar(page, TAL, "reclutador@andina.demo.test");
  await page.goto(`${TAL}/seleccion/procesos/${PROCESO}`);
  await expect(page.locator('[data-etapa="Postulantes"]').getByTestId("tarjeta-postulante").filter({ hasText: apellido })).toHaveCount(1);
});

test("4 · /privacidad carga sin sesión, rotulada como borrador", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto(`${PUE}/privacidad`);
  await expect(page.getByTestId("rotulo-borrador")).toContainText("Borrador pendiente de validación legal (Ley 1581 de 2012)");
  await expect(page).not.toHaveURL(/ingresar/);
});

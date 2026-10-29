import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

// Prueba de humo contra el despliegue en Render (no corre en la suite local). Uso:
//   RENDER_HUMO=1 npx playwright test -c playwright.render.config.ts
// URLs: RENDER_VIN, RENDER_TAL, RENDER_PUE (por defecto las del Blueprint). Configura las conexiones solo por las
// pantallas, publica un proceso, postula con la candidata demo y verifica Postulantes y el SHA-256 del CV.
test.skip(!process.env.RENDER_HUMO, "Solo con RENDER_HUMO=1");
test.describe.configure({ mode: "serial" });

const VIN = process.env.RENDER_VIN ?? "https://vinculo-simulado.onrender.com";
const TAL = process.env.RENDER_TAL ?? "https://talentia-simulado.onrender.com";
const PUE = process.env.RENDER_PUE ?? "https://puente-postulaciones.onrender.com";
const PROCESO = process.env.RENDER_PROCESO ?? "9001";
const CLAVE = "Demo2026!";
// Candidato demo que postula (RENDER_CANDIDATO=santiago para repetir sobre un proceso al que Valentina ya postuló).
const CANDIDATO = process.env.RENDER_CANDIDATO === "santiago" ? { correo: "santiago.mejia@demo.test", nombre: "Santiago" } : { correo: "valentina.rios@demo.test", nombre: "Valentina" };
const CV = path.resolve(__dirname, "../fixtures/cv/cv-camila-ejemplo.pdf");
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const marca = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");

async function ingresar(page: Page, base: string, correo: string) {
  await page.context().clearCookies();
  await page.goto(`${base}/ingresar`, { timeout: 120_000 });
  await page.getByLabel("Correo").fill(correo);
  await page.getByLabel("Contraseña").fill(CLAVE);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).not.toHaveURL(/ingresar/, { timeout: 60_000 });
}

let apiKey = "";
let clientId = "";
let clientSecret = "";
let urlApp = "";
let urlWebhook = "";
// Título sembrado del proceso en Talentia (la vacante publicada lo copia).
const titulo = process.env.RENDER_TITULO ?? "Desarrollador/a Backend Java";
let jobApplicationId = "";

test("0 · los tres servicios responden (arranque en frío)", async ({ request }) => {
  for (const base of [VIN, TAL, PUE]) {
    await expect(async () => {
      const r = await request.get(`${base}/api/salud`, { timeout: 90_000 });
      expect((await r.json()).estado).toBe("ok");
    }).toPass({ timeout: 180_000 });
  }
});

test("1 · Talentia: el admin crea una API Key con Lectura y Modificación", async ({ page }) => {
  await ingresar(page, TAL, "admin@andina.demo.test");
  await page.goto(`${TAL}/admin/api-keys`);
  await page.getByLabel("Nombre").fill(`Puente Render ${marca}`);
  await page.getByLabel("Modificación").check();
  await page.getByRole("button", { name: "Crear llave" }).click();
  apiKey = (await page.getByTestId("valor-llave").textContent())!.trim();
  expect(apiKey).toMatch(/^tal_/);
});

test("2 · Vínculo: la reclutadora registra la aplicación del puente y Andina la autoriza", async ({ page }) => {
  await ingresar(page, VIN, "reclutadora@andina.demo.test");
  await page.goto(`${VIN}/developers`);
  await page.getByLabel("Nombre de la aplicación").fill(`Puente de postulaciones ${marca}`);
  await page.getByRole("button", { name: "Crear aplicación" }).click();
  clientId = (await page.getByTestId("client-id").textContent())!.trim();
  clientSecret = (await page.getByTestId("client-secret").textContent())!.trim();
  await page.getByRole("link", { name: "Ir a la aplicación" }).click();
  await expect(page.getByTestId("client-id-app")).toHaveText(clientId);
  urlApp = page.url();
  await page.goto(`${VIN}/reclutador/integraciones`);
  await page.getByLabel("Client ID de la aplicación del integrador").fill(clientId);
  await page.getByRole("button", { name: "Autorizar aplicación" }).click();
  await expect(page.locator("main")).toContainText(`Puente de postulaciones ${marca}`);
});

test("3 · Puente: el admin configura y prueba las dos conexiones", async ({ page }) => {
  await ingresar(page, PUE, "admin@puente.demo.test");
  await page.goto(`${PUE}/conexiones`);
  const v = page.getByTestId("conexion-vinculo");
  await v.getByLabel("URL base de Vínculo").fill(VIN);
  await v.getByLabel("Client ID").fill(clientId);
  await v.getByLabel("Client Secret").fill(clientSecret);
  await v.getByRole("button", { name: "Guardar y probar" }).click();
  await expect(page.getByTestId("resultado-guardar-vin")).toContainText("autorizada por «Andina Software S.A.S.»", { timeout: 120_000 });
  const t = page.getByTestId("conexion-talentia");
  await t.getByLabel("URL base de Talentia").fill(TAL);
  await t.getByLabel("API Key").fill(apiKey);
  await t.getByRole("button", { name: "Guardar y probar" }).click();
  await expect(page.getByTestId("resultado-guardar-tal")).toContainText("Lectura sí, Modificación sí", { timeout: 120_000 });
  urlWebhook = (await page.getByTestId("url-webhook").textContent())!.trim();
  expect(urlWebhook).toBe(`${PUE}/api/webhooks/vinculo`);
});

test("4 · Vínculo valida el webhook del puente (desafío firmado)", async ({ page }) => {
  await ingresar(page, VIN, "reclutadora@andina.demo.test");
  await page.goto(urlApp);
  await page.getByLabel("URL del webhook").fill(urlWebhook);
  await page.getByRole("button", { name: "Guardar y validar" }).click();
  await expect(page.getByTestId("resultado-validacion")).toContainText("✓", { timeout: 120_000 });
});

test("5 · Puente: «Publicar en Vínculo» el proceso con Solicitud sencilla", async ({ page }) => {
  await ingresar(page, PUE, "admin@puente.demo.test");
  await page.goto(`${PUE}/procesos`);
  const fila = page.locator(`[data-testid="fila-proceso"][data-proceso="${PROCESO}"]`);
  await fila.getByRole("button", { name: /Publicar en Vínculo|Publicar de nuevo/ }).click();
  await expect(page.locator(".alerta-exito")).toContainText(`Proceso ${PROCESO} publicado en Vínculo con «Solicitud sencilla»`, { timeout: 120_000 });
});

test("6 · la candidata demo postula con Solicitud sencilla y un PDF", async ({ page }) => {
  await ingresar(page, VIN, CANDIDATO.correo);
  await page.goto(`${VIN}/empleos?${new URLSearchParams({ q: titulo, empresa: "andina-software" })}`);
  await page.getByTestId("tarjeta-vacante").getByRole("link", { name: titulo, exact: true }).first().click();
  await page.getByRole("link", { name: "Solicitud sencilla" }).click();
  await page.getByLabel("Ciudad").fill("Medellín");
  await page.getByRole("button", { name: "Continuar" }).click();
  // La candidata demo ya tiene CV en su perfil: se sube otro para comparar su SHA-256 con el que llegue a Talentia.
  const otra = page.getByLabel("Subir otra hoja de vida");
  if (await otra.count()) await otra.check();
  await page.getByLabel("Hoja de vida (PDF)").setInputFiles(CV);
  await page.getByRole("button", { name: "Enviar solicitud" }).click();
  await expect(page.getByRole("heading", { name: "¡Tu solicitud fue enviada!" })).toBeVisible({ timeout: 60_000 });
  jobApplicationId = (await page.getByTestId("job-application-id").textContent())!.trim();
});

test("7 · la postulación llega a Postulantes de Talentia con el mismo SHA-256 y el puente la marca Completado", async ({ page }) => {
  test.setTimeout(300_000);
  await ingresar(page, PUE, "admin@puente.demo.test");
  await expect(async () => {
    await page.goto(`${PUE}/operaciones`);
    await expect(page.locator(`[data-testid="fila-operacion"][data-job-application-id="${jobApplicationId}"]`)).toContainText("Completado", { timeout: 2000 });
  }).toPass({ timeout: 240_000, intervals: [5000] });

  await ingresar(page, TAL, "reclutador@andina.demo.test");
  await page.goto(`${TAL}/seleccion/procesos/${PROCESO}`);
  const tarjeta = page.locator('[data-etapa="Postulantes"]').getByTestId("tarjeta-postulante").filter({ hasText: CANDIDATO.nombre });
  await expect(tarjeta.first()).toBeVisible();
  await tarjeta.first().getByRole("link").first().click();
  const [descarga] = await Promise.all([page.waitForEvent("download"), page.getByTestId("descargar-cv").first().click()]);
  expect(sha(readFileSync((await descarga.path())!))).toBe(sha(readFileSync(CV)));
});

test("8 · la candidata ve «CV descargado» en Mis postulaciones", async ({ page }) => {
  test.setTimeout(240_000);
  await ingresar(page, VIN, CANDIDATO.correo);
  await expect(async () => {
    await page.goto(`${VIN}/mis-postulaciones`);
    await expect(page.locator(`[data-testid="mi-postulacion"][data-job-application-id="${jobApplicationId}"]`).getByTestId("estado-postulacion")).toHaveText("CV descargado", {
      timeout: 2000,
    });
  }).toPass({ timeout: 180_000, intervals: [5000] });
});

import { expect, test, type Page } from "@playwright/test";
import { PUE, TAL, VIN } from "./procesos";
import { CV, correoUnico, iniciarSesionPuente, iniciarSesionTalentia, iniciarSesionVinculo, postular, referencia, sha256Archivo, sufijoUnico } from "./utilidades";

// F3 · los tres sistemas conectados solo desde sus pantallas (ESPECIFICACION §4 y criterios 5–13):
// API Key en Talentia → Client Secret en el portal de desarrolladores de Vínculo → asistente de /conexiones del puente →
// webhook validado → «Publicar en Vínculo» → Solicitud sencilla → «Postulantes» en Talentia con el mismo PDF →
// el candidato ve «CV descargado». Después, la llave revocada detiene la transferencia con un mensaje claro.
test.describe.configure({ mode: "serial" });

const sufijo = sufijoUnico();
const titulo = `Ingeniero/a de Integraciones ${sufijo}`;
let procesoId = "";
let correoCandidato = "";
let jobApplicationId = "";

async function crearLlave(page: Page, nombre: string) {
  await iniciarSesionTalentia(page, "admin");
  await page.goto(`${TAL}/admin/api-keys`);
  await page.getByLabel("Nombre").fill(nombre);
  await page.getByLabel("Modificación").check();
  await page.getByRole("button", { name: "Crear llave" }).click();
  const valor = page.getByTestId("valor-llave");
  await expect(valor).toBeVisible();
  return (await valor.textContent())!.trim();
}

async function guardarTalentia(page: Page, apiKey: string) {
  await iniciarSesionPuente(page, "admin");
  await page.goto(`${PUE}/conexiones`);
  const t = page.getByTestId("conexion-talentia");
  await t.getByLabel("URL base de Talentia").fill(TAL);
  await t.getByLabel("API Key").fill(apiKey);
  await t.getByRole("button", { name: "Guardar y probar" }).click();
  await expect(page.getByTestId("resultado-guardar-tal")).toContainText("Lectura sí, Modificación sí", { timeout: 30_000 });
}

test("1 · el administrador desconecta el puente y lo vuelve a conectar desde las pantallas de los tres sistemas", async ({ page }) => {
  test.setTimeout(120_000);
  await iniciarSesionPuente(page, "admin");
  await page.goto(`${PUE}/conexiones`);
  await page.getByRole("button", { name: "Desconectar Vínculo" }).click();
  await expect(page.getByTestId("estado-vinculo")).toHaveText("Sin configurar");
  await page.getByRole("button", { name: "Desconectar Talentia" }).click();
  await expect(page.getByTestId("estado-talentia")).toHaveText("Sin configurar");
  const urlWebhook = (await page.getByTestId("url-webhook").textContent())!.trim();
  expect(urlWebhook).toBe(`${PUE}/api/webhooks/vinculo`);

  // Talentia: API Key con Lectura y Modificación (se muestra una sola vez).
  const apiKey = await crearLlave(page, `Puente E2E ${sufijo}`);
  expect(apiKey).toMatch(/^tal_/);

  // Vínculo: la reclutadora regenera el Client Secret de la aplicación del puente (autorizada por Andina).
  await iniciarSesionVinculo(page, "reclutadora");
  await page.goto(`${VIN}/developers`);
  await page.getByTestId("mi-aplicacion").getByRole("link", { name: /Puente de postulaciones/ }).click();
  const clientId = (await page.getByTestId("client-id-app").textContent())!.trim();
  await page.getByRole("button", { name: "Regenerar Client Secret" }).click();
  const secreto = (await page.getByTestId("client-secret").textContent())!.trim();
  const urlApp = page.url();

  // Puente: asistente de conexiones con «Probar conexión».
  await iniciarSesionPuente(page, "admin");
  await page.goto(`${PUE}/conexiones`);
  const v = page.getByTestId("conexion-vinculo");
  await v.getByLabel("URL base de Vínculo").fill(VIN);
  await v.getByLabel("Client ID").fill(clientId);
  await v.getByLabel("Client Secret").fill(secreto);
  await v.getByRole("button", { name: "Guardar y probar" }).click();
  await expect(page.getByTestId("resultado-guardar-vin")).toContainText("autorizada por «Andina Software S.A.S.»", { timeout: 30_000 });
  await guardarTalentia(page, apiKey);
  await page.reload();
  await expect(page.getByTestId("estado-vinculo")).toHaveText("Funciona");
  await expect(page.getByTestId("estado-talentia")).toHaveText("Funciona");
  // Los secretos nunca vuelven a mostrarse completos.
  await expect(page.locator("body")).not.toContainText(secreto);
  await expect(page.locator("body")).not.toContainText(apiKey);
  await page.getByTestId("conexion-talentia").getByRole("button", { name: "Probar conexión" }).click();
  await expect(page.getByTestId("resultado-probar-tal")).toContainText("procesos visibles");

  // Vínculo: registrar y validar el webhook del puente (desafío respondido con el secreto guardado).
  await iniciarSesionVinculo(page, "reclutadora");
  await page.goto(urlApp);
  await page.getByLabel("URL del webhook").fill(urlWebhook);
  await page.getByRole("button", { name: "Guardar y validar" }).click();
  await expect(page.getByTestId("resultado-validacion")).toContainText("✓");
  await iniciarSesionPuente(page, "admin");
  await page.goto(`${PUE}/conexiones`);
  await expect(page.getByTestId("estado-webhook")).toContainText("Vínculo validó el webhook");
});

test("2 · un proceso nuevo de Talentia se publica en Vínculo desde el puente", async ({ page }) => {
  await iniciarSesionTalentia(page, "admin");
  await page.goto(`${TAL}/seleccion/procesos/nuevo`);
  await page.getByLabel("Título del proceso").fill(titulo);
  await page.getByLabel("Área").fill("Ingeniería");
  await page.getByLabel("Ciudad").fill("Medellín");
  await page.getByRole("button", { name: "Crear proceso" }).click();
  await expect(page.getByText(/Proceso \d+ creado/)).toBeVisible();
  procesoId = page.url().match(/procesos\/(\d+)/)![1];

  await iniciarSesionPuente(page, "admin");
  await page.goto(`${PUE}/procesos`);
  const fila = page.locator(`[data-testid="fila-proceso"][data-proceso="${procesoId}"]`);
  await expect(fila).toContainText(titulo);
  await fila.getByRole("button", { name: "Publicar en Vínculo" }).click();
  await expect(page.locator(".alerta-exito")).toContainText(`Proceso ${procesoId} publicado en Vínculo con «Solicitud sencilla»`);
  await expect(page.locator(`[data-testid="fila-proceso"][data-proceso="${procesoId}"]`).getByTestId("estado-publicacion")).toContainText("Publicada");
});

test("3 · la Solicitud sencilla llega a «Postulantes» de Talentia en menos de 30 s, con el mismo PDF, y el candidato ve «CV descargado»", async ({ page }) => {
  correoCandidato = correoUnico("tres");
  await postular(page, { codigo: titulo, apellido: `Integra ${sufijo}`, correo: correoCandidato });
  await expect(page.getByRole("heading", { name: "¡Tu solicitud fue enviada!" })).toBeVisible();
  jobApplicationId = await referencia(page);
  const enviadaEn = Date.now();

  const candidato = page; // conserva la sesión del candidato en Vínculo; Talentia usa su propia cookie
  await iniciarSesionTalentia(candidato, "reclutador");
  await expect(async () => {
    await candidato.goto(`${TAL}/seleccion/procesos/${procesoId}`);
    await expect(candidato.locator('[data-etapa="Postulantes"]').getByTestId("tarjeta-postulante").filter({ hasText: `Integra ${sufijo}` })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 30_000 });
  expect(Date.now() - enviadaEn).toBeLessThan(30_000);

  await candidato.getByRole("link", { name: new RegExp(`Integra ${sufijo}`) }).click();
  const [descarga] = await Promise.all([candidato.waitForEvent("download"), candidato.getByTestId("descargar-cv").click()]);
  expect(sha256Archivo((await descarga.path())!)).toBe(sha256Archivo(CV));

  await expect(async () => {
    await candidato.goto(`${VIN}/mis-postulaciones`);
    await expect(candidato.locator("main")).toContainText(titulo, { timeout: 1000 });
    await expect(candidato.locator("main")).toContainText("CV descargado", { timeout: 1000 });
  }).toPass({ timeout: 30_000 });

  await iniciarSesionPuente(candidato, "operador");
  await candidato.goto(`${PUE}/operaciones`);
  await candidato.locator(`[data-testid="fila-operacion"][data-job-application-id="${jobApplicationId}"]`).getByRole("link").click();
  await expect(candidato.getByTestId("estado-operacion")).toHaveText("Completado");
  await expect(candidato.getByTestId("estado-aviso")).toContainText("Enviado", { timeout: 30_000 });
});

test("4 · con la API Key revocada la transferencia se detiene con un mensaje claro; con una llave nueva y «Reintentar» completa", async ({ page }) => {
  test.setTimeout(120_000);
  await iniciarSesionTalentia(page, "admin");
  await page.goto(`${TAL}/admin/api-keys`);
  await page.getByRole("button", { name: `Revocar la llave Puente E2E ${sufijo}` }).click();
  await expect(page.locator(`[data-testid="fila-llave"]`).filter({ hasText: `Puente E2E ${sufijo}` })).toContainText("Revocada");

  await postular(page, { codigo: titulo, apellido: `Revocada ${sufijo}`, correo: correoUnico("revocada") });
  const ref = await referencia(page);
  await iniciarSesionPuente(page, "admin");
  await expect(async () => {
    await page.goto(`${PUE}/operaciones`);
    await page.locator(`[data-testid="fila-operacion"][data-job-application-id="${ref}"]`).getByRole("link").click({ timeout: 1000 });
    await expect(page.getByTestId("estado-operacion")).toHaveText("Fallido (reintentable)", { timeout: 1000 });
  }).toPass({ timeout: 30_000 });
  await expect(page.locator("main")).toContainText("La API Key de Talentia fue revocada o no es válida.");
  const urlOperacion = page.url();

  const nueva = await crearLlave(page, `Puente E2E nueva ${sufijo}`);
  await guardarTalentia(page, nueva);
  await page.goto(urlOperacion);
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(page.getByTestId("estado-operacion")).toHaveText("Completado", { timeout: 30_000 });
});

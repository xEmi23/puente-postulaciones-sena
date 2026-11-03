import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { PUE, TAL } from "./procesos";
import { CV, iniciarSesionPuente, iniciarSesionTalentia, sufijoUnico } from "./utilidades";

// V4 F2 por las pantallas: Fuentes → token (una vez) → Correspondencias (fuente, vacante) → entrada genérica con el
// token → «Requiere revisión» (sin correo) → completar y aprobar → Postulantes del Simulador BUK.
test.describe.configure({ mode: "serial" });

const sufijo = sufijoUnico();
const fuente = `e2e-${sufijo}`;
const vacante = `VAC-${sufijo.toUpperCase()}`;
const apellido = `Generica ${sufijo}`;
let token = "";

test("1 · el admin crea una fuente y ve su token una sola vez", async ({ page }) => {
  await iniciarSesionPuente(page, "admin");
  await page.goto(`${PUE}/fuentes`);
  await page.getByLabel("Nombre corto").fill(fuente);
  await page.getByLabel("Descripción (opcional)").fill("Fuente de la prueba E2E");
  await page.getByRole("button", { name: "Crear fuente" }).click();
  await expect(page.getByTestId("resultado-crear-fuente")).toContainText(`Fuente «${fuente}» creada`);
  const fila = page.locator(`[data-testid="fila-fuente"][data-fuente="${fuente}"]`);
  await fila.getByRole("button", { name: `Generar el token de ${fuente}` }).click();
  token = (await fila.getByTestId("valor-token").textContent())!.trim();
  expect(token).toMatch(/^pf_[0-9a-f]{10}\./);
  await page.reload();
  await expect(page.locator("body")).not.toContainText(token);
  await expect(page.locator(`[data-testid="fila-fuente"][data-fuente="${fuente}"]`)).toContainText("Activa");
});

test("2 · un operador no ve ni abre Fuentes", async ({ page }) => {
  await iniciarSesionPuente(page, "operador");
  await page.goto(`${PUE}/operaciones`);
  await expect(page.getByRole("navigation", { name: "Menú del panel" }).getByRole("link", { name: "Fuentes" })).toHaveCount(0);
  await page.goto(`${PUE}/fuentes`);
  await expect(page).not.toHaveURL(/\/fuentes$/);
});

test("3 · la vacante de la fuente se vincula a un proceso en Correspondencias", async ({ page }) => {
  await iniciarSesionPuente(page, "admin");
  await page.goto(`${PUE}/correspondencias`);
  await page.getByLabel("Fuente", { exact: true }).selectOption(fuente);
  await page.getByLabel("Código de la vacante en el Simulador LinkedIn").fill(vacante);
  await page.getByLabel("Proceso del Simulador BUK").selectOption("9002");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.locator(".alerta-exito")).toContainText(`Vacante ${vacante} vinculada al proceso 9002 (fuente ${fuente})`);
});

test("4 · sin correo llega a «Requiere revisión»; completar y aprobar la lleva a Postulantes de Talentia", async ({ page }) => {
  test.setTimeout(120_000);
  const api = page.request;
  const vac = await api.get(`${PUE}/api/entradas/v1/vacantes`, { headers: { authorization: `Bearer ${token}` } });
  expect(await vac.json()).toMatchObject({ fuente, vacantes: [{ vacanteExterna: vacante, idProceso: "9002" }] });

  const r = await api.post(`${PUE}/api/entradas/v1/postulaciones`, {
    headers: { authorization: `Bearer ${token}` },
    multipart: {
      datos: JSON.stringify({ version: "1", idExterno: `e2e-${sufijo}-1`, vacanteExterna: vacante, candidato: { nombres: "Mariana", apellidos: apellido } }),
      cv: { name: "cv-ficticio.pdf", mimeType: "application/pdf", buffer: readFileSync(CV) },
    },
  });
  expect(r.status()).toBe(202);
  const cuerpo = await r.json();
  expect(cuerpo).toMatchObject({ estado: "REQUIERE_REVISION", motivos: ["sin_correo"] });

  // Repetir la misma postulación: 200 DUPLICADA.
  const otra = await api.post(`${PUE}/api/entradas/v1/postulaciones`, {
    headers: { authorization: `Bearer ${token}` },
    multipart: {
      datos: JSON.stringify({ version: "1", idExterno: `e2e-${sufijo}-1`, vacanteExterna: vacante, candidato: { nombres: "Mariana", apellidos: apellido } }),
      cv: { name: "cv-ficticio.pdf", mimeType: "application/pdf", buffer: readFileSync(CV) },
    },
  });
  expect(otra.status()).toBe(200);
  expect((await otra.json()).estado).toBe("DUPLICADA");

  await iniciarSesionPuente(page, "operador");
  await page.goto(`${PUE}/operaciones/${cuerpo.idRecepcion}`);
  await expect(page.getByTestId("estado-operacion")).toHaveText("Requiere revisión");
  await expect(page.getByTestId("motivos-revision")).toContainText("Falta el correo");
  await expect(page.getByTestId("fuente-operacion")).toContainText(fuente);
  await page.getByLabel("Correo del candidato").fill(`mariana.${sufijo}@demo.test`);
  await page.getByRole("button", { name: "Guardar datos" }).click();
  await expect(page.locator(".alerta-exito")).toContainText("Datos guardados");
  await page.getByRole("button", { name: "Aprobar y enviar al ATS" }).click();
  await expect(page.locator(".alerta-exito")).toContainText("Aprobada");
  await expect(page.getByTestId("estado-operacion")).toHaveText("Completado", { timeout: 30_000 });
  await expect(page.getByTestId("auditoria")).toContainText("revision.aprobada");

  await iniciarSesionTalentia(page, "reclutador");
  await page.goto(`${TAL}/seleccion/procesos/9002`);
  await expect(page.locator('[data-etapa="Postulantes"]').getByTestId("tarjeta-postulante").filter({ hasText: apellido })).toBeVisible();
});

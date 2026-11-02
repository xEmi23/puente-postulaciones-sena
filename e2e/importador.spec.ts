import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { PUE, TAL } from "./procesos";
import { iniciarSesionPuente, iniciarSesionTalentia, sufijoUnico } from "./utilidades";

// V4 F3 (I-7): importador de punta a punta por las pantallas. PDF ficticios generados en la prueba (sin datos reales).
// Con CAPTURAS_MANUAL=1 guarda las capturas del manual en docs/manuales/img/.
test.describe.configure({ mode: "serial" });

const sufijo = sufijoUnico();
const PROCESO = "9004";
const personas = [
  { archivo: `cv-andrea-${sufijo}.pdf`, nombre: "Andrea", lineas: [`Andrea ${sufijo} Ficticia`, `andrea.${sufijo}@demo.test · 300 444 5566`] },
  { archivo: `cv-bernardo-${sufijo}.pdf`, nombre: "Bernardo", lineas: [`Bernardo ${sufijo} Ficticio`, `bernardo.${sufijo}@demo.test`, "Tel: +57 301 555 6677"] },
  { archivo: `cv-celia-${sufijo}.pdf`, nombre: "Celia", lineas: [`Celia ${sufijo} Ficticia`, `celia.${sufijo}@demo.test · 3026667788`] },
];
const pdfs = new Map<string, Buffer>();
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

async function pdf(lineas: string[]) {
  const doc = await PDFDocument.create();
  const p = doc.addPage([595, 842]);
  const f = await doc.embedFont(StandardFonts.Helvetica);
  lineas.forEach((l, i) => p.drawText(l, { x: 40, y: 780 - i * 18, size: 11, font: f }));
  p.drawText("Documento ficticio para pruebas", { x: 40, y: 60, size: 8, font: f });
  return Buffer.from(await doc.save());
}

async function captura(page: Page, nombre: string) {
  if (!process.env.CAPTURAS_MANUAL) return;
  const dir = path.resolve(__dirname, "../docs/manuales/img");
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${nombre}.png`), fullPage: true });
}

test.beforeAll(async () => {
  for (const p of personas) pdfs.set(p.archivo, await pdf(p.lineas));
});

test("I-7 · subir 3 PDF, revisar la tabla y confirmar: llegan a Postulantes de Talentia con el mismo SHA-256", async ({ page }) => {
  test.setTimeout(150_000);
  await iniciarSesionPuente(page, "operador");
  await page.goto(`${PUE}/importar`);
  await page.getByLabel("Proceso del ATS").selectOption(PROCESO);
  await page.getByLabel(/^Hojas de vida/).setInputFiles(personas.map((p) => ({ name: p.archivo, mimeType: "application/pdf", buffer: pdfs.get(p.archivo)! })));
  await captura(page, "importador-1-subir");
  await page.getByRole("button", { name: "Leer y sugerir datos" }).click();
  await expect(page).toHaveURL(/\/importar\/[0-9a-f-]{36}$/);
  const tabla = page.getByTestId("tabla-importacion");
  await expect(tabla.getByTestId("fila-importacion")).toHaveCount(3);
  // Sugerencias sin IA: correo y teléfono del texto, nombre del archivo.
  await expect(page.getByLabel(`Correo de ${personas[0].archivo}`)).toHaveValue(`andrea.${sufijo}@demo.test`);
  await expect(page.getByLabel(`Teléfono de ${personas[1].archivo}`)).toHaveValue("+573015556677");
  await expect(page.getByLabel(`Nombres de ${personas[2].archivo}`)).toHaveValue("Celia");
  // La persona corrige un apellido antes de confirmar.
  await page.getByLabel(`Apellidos de ${personas[0].archivo}`).fill(`Importada ${sufijo}`);
  await captura(page, "importador-2-revisar");
  await page.getByRole("button", { name: "Confirmar e importar" }).click();
  await expect(page.locator(".alerta-exito")).toContainText("3 enviada(s) al ATS");
  await expect(tabla.getByTestId("resultado-fila")).toHaveText(["Enviada al ATS", "Enviada al ATS", "Enviada al ATS"]);
  await captura(page, "importador-3-resultado");

  // En Talentia: las tres tarjetas en «Postulantes» del proceso elegido.
  await iniciarSesionTalentia(page, "reclutador");
  const columna = page.locator('[data-etapa="Postulantes"]');
  await expect(async () => {
    await page.goto(`${TAL}/seleccion/procesos/${PROCESO}`);
    for (const p of personas) await expect(columna.getByTestId("tarjeta-postulante").filter({ hasText: p.nombre }).first()).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 60_000 });
  await captura(page, "importador-4-talentia");
  await columna.getByTestId("tarjeta-postulante").filter({ hasText: `Importada ${sufijo}` }).getByRole("link").first().click();
  const [descarga] = await Promise.all([page.waitForEvent("download"), page.getByTestId("descargar-cv").first().click()]);
  expect(sha(readFileSync((await descarga.path())!))).toBe(sha(pdfs.get(personas[0].archivo)!));
});

test("I-2 en pantalla · reimportar el mismo PDF en el mismo proceso da «Duplicada»", async ({ page }) => {
  await iniciarSesionPuente(page, "operador");
  await page.goto(`${PUE}/importar`);
  await page.getByLabel("Proceso del ATS").selectOption(PROCESO);
  await page.getByLabel(/^Hojas de vida/).setInputFiles({ name: personas[1].archivo, mimeType: "application/pdf", buffer: pdfs.get(personas[1].archivo)! });
  await page.getByRole("button", { name: "Leer y sugerir datos" }).click();
  await page.getByRole("button", { name: "Confirmar e importar" }).click();
  await expect(page.locator(".alerta-exito")).toContainText("1 duplicada(s)");
  await expect(page.getByTestId("resultado-fila")).toHaveText("Duplicada (ya estaba)");
});

test("I-5 en pantalla · un archivo que no es PDF se rechaza con un mensaje claro", async ({ page }) => {
  await iniciarSesionPuente(page, "operador");
  await page.goto(`${PUE}/importar`);
  await page.getByLabel("Proceso del ATS").selectOption(PROCESO);
  await page.getByLabel(/^Hojas de vida/).setInputFiles({ name: "notas.pdf", mimeType: "application/pdf", buffer: Buffer.from("esto no es un PDF") });
  await page.getByRole("button", { name: "Leer y sugerir datos" }).click();
  await expect(page.getByTestId("error-archivo")).toContainText("«notas.pdf» no es un PDF (solo se aceptan PDF).");
  await expect(page.getByRole("button", { name: "Confirmar e importar" })).toHaveCount(0);
});

test("I-6 en pantalla · sin sesión no se puede importar", async ({ page, request }) => {
  await page.goto(`${PUE}/importar`);
  await expect(page).toHaveURL(/\/ingresar/);
  const r = await request.post(`${PUE}/api/importador/lotes`, { multipart: { procesoAtsId: PROCESO }, maxRedirects: 0 });
  expect(r.status()).toBe(401);
});

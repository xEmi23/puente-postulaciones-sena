import { expect, test, type Browser } from "@playwright/test";
import { PUE, TAL } from "./procesos";
import { CV, iniciarSesionPuente, iniciarSesionTalentia, sha256Archivo, sufijoUnico } from "./utilidades";

// V4 F6 (D-75): oferta con enlace externo → formulario público del Puente → ConectorATS → Postulantes del Simulador BUK.
// Cada prueba usa su propia IP simulada (x-forwarded-for, sin proxy en local) para que el límite por IP no se mezcle.
test.describe.configure({ mode: "serial" });

const sufijo = sufijoUnico();
const apellido = `Formulario ${sufijo}`;
const correo = `formulario.${sufijo}@demo.test`;
// Una IP distinta por contexto (contador, nunca al azar: dos pruebas con la misma IP compartirían el límite).
const BASE_IP = Math.floor(Math.random() * 200) + 1;
let siguienteIp = 1;
const ip = () => `198.51.${BASE_IP}.${siguienteIp++}`;
let enlace = "";

async function anonimo(browser: Browser) {
  const contexto = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": ip() } });
  return { contexto, page: await contexto.newPage() };
}

test("1 · el panel exige sesión; el admin crea el enlace público del proceso 9006 y lo ve completo con «Copiar»", async ({ page, browser }) => {
  const { contexto, page: sinSesion } = await anonimo(browser);
  await sinSesion.goto(`${PUE}/formulario`);
  await expect(sinSesion).toHaveURL(/\/ingresar\?siguiente=%2Fformulario/);
  await contexto.close();

  await iniciarSesionPuente(page, "admin");
  await page.goto(`${PUE}/formulario`);
  const fila = page.locator('[data-testid="fila-formulario"][data-proceso="9006"]');
  const crear = fila.getByRole("button", { name: /enlace público del proceso 9006/ });
  await expect(fila).toBeVisible();
  if (await crear.count()) {
    // Un clic antes de que la página termine de cargar puede perderse: se reintenta hasta ver la confirmación.
    await expect(async () => {
      if (await crear.count()) await crear.click();
      await expect(page.locator(".alerta-exito")).toContainText("Enlace público listo para el proceso 9006", { timeout: 5_000 });
    }).toPass({ timeout: 30_000 });
  }
  enlace = await fila.getByTestId("enlace-publico").inputValue();
  expect(enlace).toMatch(new RegExp(`^${PUE}/postular/[a-z0-9]{12}$`));
  await expect(fila.getByRole("button", { name: "Copiar" })).toBeVisible();
});

test("2 · sin sesión: el formulario carga, el envío llega a Postulantes del Simulador BUK con el mismo SHA-256", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const { contexto, page: p } = await anonimo(browser);
  await p.goto(enlace);
  await expect(p.getByTestId("titulo-vacante")).toHaveText("Diseñador/a UX/UI");
  await expect(p.getByText("Entorno de simulación")).toBeVisible();
  await p.getByLabel("Nombres").fill("Daniela");
  await p.getByLabel("Apellidos").fill(apellido);
  await p.getByLabel("Correo").fill(correo);
  await p.getByLabel("Teléfono").fill("300 555 0142");
  await p.getByLabel("Hoja de vida (PDF, máximo 5 MB)").setInputFiles(CV);
  await p.getByLabel(/Autorizo el tratamiento de mis datos/).check();
  await expect(p.getByRole("link", { name: "aviso de privacidad" })).toHaveAttribute("href", "/privacidad");
  await p.waitForTimeout(3100); // tiempo mínimo de llenado
  await p.getByRole("button", { name: "Enviar postulación" }).click();
  await expect(p.getByRole("heading", { name: "Recibimos tu postulación" })).toBeVisible();
  await contexto.close();

  await iniciarSesionPuente(page, "operador");
  await page.goto(`${PUE}/operaciones`);
  const fila = page.getByRole("row").filter({ hasText: "Formulario público" }).filter({ hasText: "fo•••@demo.test" }).first();
  await expect(fila).toContainText("Completado", { timeout: 60_000 });

  await iniciarSesionTalentia(page, "reclutador");
  await page.goto(`${TAL}/seleccion/procesos/9006`);
  const tarjeta = page.locator('[data-etapa="Postulantes"]').getByTestId("tarjeta-postulante").filter({ hasText: apellido });
  await expect(tarjeta).toContainText("Formulario público");
  await page.getByRole("link", { name: new RegExp(apellido) }).click();
  await expect(page.getByTestId("sha256-documento")).toHaveText(sha256Archivo(CV));
});

test("3 · segundo envío con el mismo correo: la misma confirmación (no revela que existía) y queda como duplicado", async ({ page, browser }) => {
  const { contexto, page: p } = await anonimo(browser);
  await p.goto(enlace);
  await p.getByLabel("Nombres").fill("Daniela");
  await p.getByLabel("Apellidos").fill(apellido);
  await p.getByLabel("Correo").fill(correo.toUpperCase());
  await p.getByLabel("Teléfono").fill("3005550142");
  await p.getByLabel("Hoja de vida (PDF, máximo 5 MB)").setInputFiles(CV);
  await p.getByLabel(/Autorizo el tratamiento de mis datos/).check();
  await p.waitForTimeout(3100);
  await p.getByRole("button", { name: "Enviar postulación" }).click();
  await expect(p.getByRole("heading", { name: "Recibimos tu postulación" })).toBeVisible();
  await contexto.close();

  await iniciarSesionTalentia(page, "reclutador");
  await page.goto(`${TAL}/seleccion/procesos/9006`);
  await expect(page.locator('[data-etapa="Postulantes"]').getByTestId("tarjeta-postulante").filter({ hasText: apellido })).toHaveCount(1);
  await iniciarSesionPuente(page, "operador");
  await page.goto(`${PUE}/operaciones?fuente=formulario-publico`);
  await page.getByRole("row").filter({ hasText: "fo•••@demo.test" }).first().getByRole("link").first().click();
  await expect(page.locator("main")).toContainText("envió de nuevo el formulario de esta vacante; no se creó nada");
});

test("4 · PDF falso y sin consentimiento: se rechazan con un mensaje claro y no se registra nada", async ({ browser }) => {
  const { contexto, page: p } = await anonimo(browser);
  await p.goto(enlace);
  await p.getByLabel("Nombres").fill("Falso");
  await p.getByLabel("Apellidos").fill(`Pdf ${sufijo}`);
  await p.getByLabel("Correo").fill(`falso.${sufijo}@demo.test`);
  await p.getByLabel("Teléfono").fill("3005550143");
  await p.getByLabel("Hoja de vida (PDF, máximo 5 MB)").setInputFiles({ name: "cv.pdf", mimeType: "application/pdf", buffer: Buffer.from("<html>no soy un pdf</html>") });
  await p.getByLabel(/Autorizo el tratamiento de mis datos/).check();
  await p.waitForTimeout(3100);
  await p.getByRole("button", { name: "Enviar postulación" }).click();
  await expect(p.getByTestId("error-formulario")).toHaveText(/no es un PDF válido/);

  // Sin la casilla el navegador no envía (required) y el servidor también lo exige.
  const casilla = p.getByLabel(/Autorizo el tratamiento de mis datos/);
  expect(await casilla.evaluate((el: HTMLInputElement) => el.required)).toBe(true);
  const t = await p.locator('input[name="t"]').inputValue();
  await p.waitForTimeout(3100); // pasa el tiempo mínimo: así lo que se prueba es la falta de consentimiento
  const r = await p.request.post(`${enlace.replace("/postular/", "/api/postular/")}`, {
    maxRedirects: 0,
    multipart: { nombres: "Sin", apellidos: "Consentimiento", correo: `sin.${sufijo}@demo.test`, telefono: "3005550144", t, cv: { name: "cv.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF") } },
  });
  expect(r.status()).toBe(303);
  expect(r.headers()["location"]).toMatch(/\?error=consentimiento$/);
  await contexto.close();
});

test("5 · límite por IP: el sexto envío en 10 minutos se frena", async ({ browser }) => {
  const { contexto, page: p } = await anonimo(browser);
  await p.goto(enlace);
  const url = enlace.replace("/postular/", "/api/postular/");
  const destinos: string[] = [];
  for (let i = 0; i < 6; i++) {
    const r = await p.request.post(url, { maxRedirects: 0, multipart: { nombres: "Robot", sitio_web: "relleno" } });
    destinos.push(r.headers()["location"]);
  }
  expect(destinos.slice(0, 5), destinos.join(" ")).toEqual(Array(5).fill(expect.stringMatching(/\/enviado$/))); // campo trampa: parece aceptado
  expect(destinos[5]).toMatch(/\?error=limite$/);
  await contexto.close();
});

test("6 · código inexistente: 404; /privacidad carga con el rótulo de borrador @movil", async ({ page }) => {
  const r = await page.goto(`${PUE}/postular/noexiste2345`);
  expect(r?.status()).toBe(404);
  await expect(page.getByText("No encontramos esta página")).toBeVisible();
  await page.goto(`${PUE}/privacidad`);
  await expect(page.getByTestId("rotulo-borrador")).toContainText("Borrador pendiente de validación legal (Ley 1581 de 2012)");
  await expect(page.getByRole("heading", { name: "Tus derechos" })).toBeVisible();
  await expect(page).not.toHaveURL(/ingresar/);
});

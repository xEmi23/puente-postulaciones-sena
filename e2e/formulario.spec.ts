import { expect, test, type Browser, type Page } from "@playwright/test";
import { PUE, TAL } from "./procesos";
import { CV, iniciarSesionPuente, iniciarSesionTalentia, sha256Archivo, sufijoUnico } from "./utilidades";

// V4 F6 (D-75): oferta con enlace externo → formulario público del Puente → ConectorATS → Postulantes del Simulador BUK.
// Cada contexto usa su propia IP simulada (x-forwarded-for, sin proxy en local) para que el límite por IP no se mezcle.
test.describe.configure({ mode: "serial" });

const sufijo = sufijoUnico();
const apellido = `Formulario ${sufijo}`;
const correo = `formulario.${sufijo}@demo.test`;
const titulo = `Gerente Administrativo ${sufijo}`;
// Una IP distinta por contexto (contador, nunca al azar: dos pruebas con la misma IP compartirían el límite).
const BASE_IP = Math.floor(Math.random() * 200) + 1;
let siguienteIp = 1;
const ip = () => `198.51.${BASE_IP}.${siguienteIp++}`;
let enlace = "";

async function anonimo(browser: Browser) {
  const contexto = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": ip() } });
  return { contexto, page: await contexto.newPage() };
}

/** Enlace público del proceso 9006 desde el panel (lo crea si no existe). */
async function obtenerEnlace(page: Page): Promise<string> {
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
  return fila.getByTestId("enlace-publico").inputValue();
}

async function llenar(p: Page, datos: { correo: string; apellido?: string }) {
  await p.getByLabel("Nombres").fill("Daniela");
  await p.getByLabel("Apellidos").fill(datos.apellido ?? apellido);
  await p.getByLabel("Correo").fill(datos.correo);
  await p.getByLabel("Indicativo del país").selectOption("+57");
  await p.getByLabel("Teléfono").fill("300 555 0142");
  await p.getByLabel("Ciudad de residencia").fill("Itagüí");
  await p.getByLabel("Perfil de LinkedIn (opcional)").fill("https://www.linkedin.com/in/daniela-ficticia");
  await p.getByLabel("Hoja de vida en PDF").setInputFiles(CV);
  await p.getByLabel(/Autorizo el tratamiento de mis datos/).check();
}

test("1 · el panel exige sesión; el admin crea el enlace público del proceso 9006 y lo ve completo con «Copiar»", async ({ page, browser }) => {
  const { contexto, page: sinSesion } = await anonimo(browser);
  await sinSesion.goto(`${PUE}/formulario`);
  await expect(sinSesion).toHaveURL(/\/ingresar\?siguiente=%2Fformulario/);
  await contexto.close();

  enlace = await obtenerEnlace(page);
  expect(enlace).toMatch(new RegExp(`^${PUE}/postular/[a-z0-9]{12}$`));
  await expect(page.locator('[data-testid="fila-formulario"][data-proceso="9006"]').getByRole("button", { name: "Copiar" })).toBeVisible();
});

test("2 · el admin edita lo que ve el candidato (título, ciudad, modalidad, tipo, descripción); el proceso del ATS no cambia", async ({ page, browser }) => {
  await iniciarSesionPuente(page, "admin");
  await page.goto(`${PUE}/formulario`);
  const ficha = page.locator('[data-testid="ficha-vacante"][data-proceso="9006"]');
  await ficha.getByLabel("Título público").fill(titulo);
  await ficha.getByLabel("Ciudad").fill("Itagüí, Antioquia");
  await ficha.getByLabel("Modalidad").selectOption("Presencial");
  await ficha.getByLabel("Tipo de empleo").selectOption("Tiempo completo");
  await ficha.getByLabel("Descripción corta").fill("Lidera el área administrativa de la sede.\n\n- Presupuesto y proveedores\n- Equipo de cuatro personas");
  await expect(async () => {
    await ficha.getByRole("button", { name: "Guardar datos de la vacante 9006" }).click();
    await expect(page.locator(".alerta-exito")).toContainText("Datos de la vacante guardados", { timeout: 5_000 });
  }).toPass({ timeout: 30_000 });

  const { contexto, page: p } = await anonimo(browser);
  await p.goto(enlace);
  await expect(p.getByTestId("titulo-vacante")).toHaveText(titulo);
  await expect(p.getByTestId("datos-vacante")).toHaveText(/Itagüí, Antioquia\s*Presencial\s*Tiempo completo/);
  await expect(p.getByRole("listitem").filter({ hasText: "Presupuesto y proveedores" })).toBeVisible();
  await expect(p).toHaveTitle(new RegExp(titulo));
  await contexto.close();

  await iniciarSesionTalentia(page, "reclutador");
  await page.goto(`${TAL}/seleccion/procesos/9006`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Diseñador/a UX/UI");
});

test("3 · validación en línea: mensajes claros junto a cada campo, sin perder lo escrito", async ({ browser }) => {
  const { contexto, page: p } = await anonimo(browser);
  await p.goto(enlace);
  await p.getByLabel("Nombres").fill("Daniela");
  await p.getByLabel("Perfil de LinkedIn (opcional)").fill("perfiles.example.test/daniela");
  await p.getByLabel("Ciudad de residencia").focus();
  await p.getByLabel("Ciudad de residencia").blur();
  await expect(p.locator("#ciudad-error")).toHaveText("Escribe tu ciudad de residencia.");
  await expect(p.getByLabel("Ciudad de residencia")).toHaveAttribute("aria-invalid", "true");
  await p.getByRole("button", { name: "Enviar postulación" }).click();
  await expect(p.getByTestId("error-formulario")).toContainText("Revisa los campos marcados");
  await expect(p.getByTestId("error-formulario")).toBeFocused();
  await expect(p.locator("#perfil-error")).toContainText("https://www.linkedin.com/in/");
  await expect(p.locator("#telefono-error")).toHaveText("Escribe tu teléfono.");
  await expect(p.locator("#autorizacion-error")).toContainText("autorizar el tratamiento");
  await expect(p.getByLabel("Nombres")).toHaveValue("Daniela");
  // Corregir quita el mensaje.
  await p.getByLabel("Ciudad de residencia").fill("Itagüí");
  await expect(p.locator("#ciudad-error")).toHaveCount(0);
  await contexto.close();
});

test("4 · sin sesión: el envío llega a Postulantes del Simulador BUK con el mismo SHA-256, ciudad y perfil; confirmación con referencia", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const { contexto, page: p } = await anonimo(browser);
  await p.goto(enlace);
  await expect(p.getByRole("note", { name: "Aviso de entorno" })).toContainText("Ejercicio académico (proyecto SENA)");
  await expect(p.getByRole("link", { name: "aviso de privacidad" }).first()).toHaveAttribute("href", "/privacidad");
  await llenar(p, { correo });
  await p.waitForTimeout(3100); // tiempo mínimo de llenado
  await p.getByRole("button", { name: "Enviar postulación" }).click();
  await expect(p.getByRole("heading", { name: "Recibimos tu postulación" })).toBeVisible();
  const referencia = (await p.getByTestId("referencia").textContent())!.trim();
  expect(referencia).toMatch(/^[A-Z0-9]{8}$/);
  await expect(p.getByRole("heading", { name: "Qué pasa después" })).toBeVisible();
  await contexto.close();

  await iniciarSesionPuente(page, "operador");
  await page.goto(`${PUE}/operaciones?fuente=formulario-publico`);
  const fila = page.getByRole("row").filter({ hasText: referencia });
  await expect(fila).toContainText("Formulario público");
  await expect(fila).toContainText("Completado", { timeout: 60_000 });

  await iniciarSesionTalentia(page, "reclutador");
  await page.goto(`${TAL}/seleccion/procesos/9006`);
  const tarjeta = page.locator('[data-etapa="Postulantes"]').getByTestId("tarjeta-postulante").filter({ hasText: apellido });
  await expect(tarjeta).toContainText("Formulario público");
  await page.getByRole("link", { name: new RegExp(apellido) }).click();
  await expect(page.getByTestId("sha256-documento")).toHaveText(sha256Archivo(CV));
  await expect(page.locator("main")).toContainText("Itagüí");
  await expect(page.locator("main")).toContainText("+573005550142");
  await expect(page.locator("main")).toContainText("https://www.linkedin.com/in/daniela-ficticia");
});

test("5 · segundo envío con el mismo correo: la misma confirmación (no revela que existía) y queda como duplicado", async ({ page, browser }) => {
  const { contexto, page: p } = await anonimo(browser);
  await p.goto(enlace);
  await llenar(p, { correo: correo.toUpperCase() });
  await p.waitForTimeout(3100);
  await p.getByRole("button", { name: "Enviar postulación" }).click();
  await expect(p.getByRole("heading", { name: "Recibimos tu postulación" })).toBeVisible();
  const referencia = (await p.getByTestId("referencia").textContent())!.trim();
  await contexto.close();

  await iniciarSesionTalentia(page, "reclutador");
  await page.goto(`${TAL}/seleccion/procesos/9006`);
  await expect(page.locator('[data-etapa="Postulantes"]').getByTestId("tarjeta-postulante").filter({ hasText: apellido })).toHaveCount(1);
  await iniciarSesionPuente(page, "operador");
  await page.goto(`${PUE}/operaciones?fuente=formulario-publico`);
  await page.getByRole("row").filter({ hasText: referencia }).getByRole("link").first().click();
  await expect(page.locator("main")).toContainText("envió de nuevo el formulario de esta vacante; no se creó nada");
});

test("6 · PDF falso y sin consentimiento: se rechazan con un mensaje claro y no se registra nada", async ({ browser }) => {
  const { contexto, page: p } = await anonimo(browser);
  await p.goto(enlace);
  await llenar(p, { correo: `falso.${sufijo}@demo.test`, apellido: `Pdf ${sufijo}` });
  await p.getByLabel("Hoja de vida en PDF").setInputFiles({ name: "cv.pdf", mimeType: "application/pdf", buffer: Buffer.from("<html>no soy un pdf</html>") });
  await p.waitForTimeout(3100);
  await p.getByRole("button", { name: "Enviar postulación" }).click();
  await expect(p.getByTestId("error-formulario")).toHaveText(/no es un PDF válido/);
  await expect(p.locator("#cv-error")).toHaveText(/no es un PDF válido/);
  await expect(p.getByLabel("Correo")).toHaveValue(`falso.${sufijo}@demo.test`);

  // Sin la casilla: el servidor también lo exige (aunque la página ya no deje enviar).
  const t = await p.locator('input[name="t"]').inputValue();
  const r = await p.request.post(enlace.replace("/postular/", "/api/postular/"), {
    maxRedirects: 0,
    multipart: {
      nombres: "Sin",
      apellidos: "Consentimiento",
      correo: `sin.${sufijo}@demo.test`,
      indicativo: "+57",
      telefono: "3005550144",
      ciudad: "Itagüí",
      t,
      cv: { name: "cv.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF") },
    },
  });
  expect(r.status()).toBe(303);
  expect(r.headers()["location"]).toMatch(/\?error=consentimiento$/);
  await contexto.close();
});

test("7 · límite por IP: el sexto envío en 10 minutos se frena; la trampa renombrada parece aceptada", async ({ browser }) => {
  const { contexto, page: p } = await anonimo(browser);
  await p.goto(enlace);
  // Oculto a las personas (fuera de la ventana) y a los lectores de pantalla (aria-hidden), sin tabulación.
  const trampa = p.locator('input[name="campo_auxiliar"]');
  await expect(trampa).not.toBeInViewport();
  await expect(p.locator('[aria-hidden="true"]:has(input[name="campo_auxiliar"])')).toHaveCount(1);
  await expect(trampa).toHaveAttribute("tabindex", "-1");
  await expect(p.locator('input[name="sitio_web"]')).toHaveCount(0);
  const url = enlace.replace("/postular/", "/api/postular/");
  const destinos: string[] = [];
  for (let i = 0; i < 6; i++) {
    const r = await p.request.post(url, { maxRedirects: 0, multipart: { nombres: "Robot", campo_auxiliar: "relleno" } });
    destinos.push(r.headers()["location"]);
  }
  expect(destinos.slice(0, 5), destinos.join(" ")).toEqual(Array(5).fill(expect.stringMatching(/\/enviado\?ref=[A-Z0-9]{8}$/)));
  expect(destinos[5]).toMatch(/\?error=limite$/);
  await contexto.close();
});

test("8 · código inexistente: 404; /privacidad carga con el rótulo de borrador @movil", async ({ page }) => {
  const r = await page.goto(`${PUE}/postular/noexiste2345`);
  expect(r?.status()).toBe(404);
  await expect(page.getByText("No encontramos esta página")).toBeVisible();
  await page.goto(`${PUE}/privacidad`);
  await expect(page.getByTestId("rotulo-borrador")).toContainText("Borrador pendiente de validación legal (Ley 1581 de 2012)");
  await expect(page.getByRole("heading", { name: "Tus derechos" })).toBeVisible();
  await expect(page).not.toHaveURL(/ingresar/);
});

test("9 · en el teléfono: la vacante y el formulario caben sin desplazamiento horizontal @movil", async ({ page }) => {
  const url = await obtenerEnlace(page);
  await page.context().clearCookies();
  await page.goto(url);
  await expect(page.getByTestId("titulo-vacante")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar postulación" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole("note", { name: "Aviso de entorno" })).toContainText("No es LinkedIn ni BUK");
});

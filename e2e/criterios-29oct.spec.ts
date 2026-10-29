import { expect, test } from "@playwright/test";
import { PUE, TAL, VIN } from "./procesos";
import { CV, correoUnico, iniciarSesionDemo, iniciarSesionVinculo, postular, referencia, sha256Archivo, sufijoUnico } from "./utilidades";
import { iniciarApp, iniciarWorker, matarApp, matarWorker } from "./procesos";

// Criterios del control del 29/10 (v1), en el orden de la demostración, sobre los tres sistemas de la v2.
test.describe.configure({ mode: "serial" });

let codigoVacante = "";
let tituloVacante = "";
let procesoId = "";
let jobApplicationId = "";
const apellido = `Criterios ${sufijoUnico()}`;

/** Página de la aplicación del puente en el portal de desarrolladores de Vínculo (la reclutadora la registró en la siembra). */
async function abrirAplicacionPuente(page: import("@playwright/test").Page) {
  await iniciarSesionVinculo(page, "reclutadora");
  await page.goto(`${VIN}/developers`);
  await page.getByTestId("mi-aplicacion").getByRole("link", { name: /Puente de postulaciones/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Puente de postulaciones");
}

test("C1 · preparar una vacante en Vínculo y un proceso en Talentia, y vincularlos", async ({ page }) => {
  await iniciarSesionVinculo(page, "reclutadora");
  tituloVacante = `Desarrollador/a Frontend ${sufijoUnico()}`;
  await page.goto(`${VIN}/reclutador/vacantes/nueva`);
  await page.getByLabel("Título del cargo").fill(tituloVacante);
  await page.getByLabel("Descripción").fill("Construirás interfaces accesibles con React y Next.js junto a un equipo ágil. Vacante ficticia de la demostración.");
  await page.getByLabel("Ciudad").fill("Medellín");
  await page.getByLabel("Modalidad").selectOption("REMOTO");
  await page.getByLabel("Entregar las solicitudes a un ATS conectado").selectOption({ label: "Puente de postulaciones (desarrollo local)" });
  await page.getByRole("button", { name: "Publicar vacante" }).click();
  const aviso = page.locator(".alerta-exito");
  await expect(aviso).toContainText(/Vacante VIN-\d{4}-\d{4} publicada\.$/); // sin aviso: el webhook del puente pasó el desafío
  codigoVacante = (await aviso.textContent())!.match(/VIN-\d{4}-\d{4}/)![0];

  await iniciarSesionDemo(page);
  await page.goto(`${TAL}/seleccion/procesos/nuevo`);
  await page.getByLabel("Título del proceso").fill("Desarrollador/a Frontend");
  await page.getByLabel("Área").fill("Ingeniería");
  await page.getByLabel("Ciudad").fill("Remoto");
  await page.getByRole("button", { name: "Crear proceso" }).click();
  await expect(page.getByText(/Proceso \d+ creado/)).toBeVisible();
  procesoId = page.url().match(/procesos\/(\d+)/)![1];
  await expect(page.locator('[data-etapa="Postulantes"]')).toBeVisible();

  await page.goto(`${PUE}/correspondencias`);
  await page.getByLabel("Código de la vacante en el origen").fill(codigoVacante);
  await page.getByLabel("Proceso del ATS").selectOption(procesoId);
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.locator(".alerta-exito")).toContainText(`Vacante ${codigoVacante} vinculada al proceso ${procesoId}`);
});

test("C2 · una persona ficticia se postula con «Solicitud sencilla» y un PDF", async ({ page }) => {
  await page.goto(`${VIN}/empleos`);
  await expect(page.getByRole("link", { name: tituloVacante })).toBeVisible();
  await postular(page, { codigo: tituloVacante, apellido, correo: correoUnico("criterios"), telefono: "3000000009" });
  await expect(page.getByRole("heading", { name: "¡Tu solicitud fue enviada!" })).toBeVisible();
  jobApplicationId = await referencia(page);
});

test("C3 · ver la transferencia sin copiar nada manualmente", async ({ page }) => {
  await iniciarSesionDemo(page);
  await page.goto(`${PUE}/`);
  const fila = page.locator(`[data-testid="fila-operacion"][data-job-application-id="${jobApplicationId}"]`);
  await expect(fila).toContainText("Completado", { timeout: 30_000 }); // la lista se actualiza sola
  await fila.getByRole("link").click();
  for (const paso of ["CV descargado", "Candidato creado", "Documento subido", "Postulación creada"]) {
    await expect(page.locator('.p-pasos li[data-hecho="true"]', { hasText: paso })).toBeVisible();
  }
});

test("C4 · la postulación aparece en la columna Postulantes del proceso correcto", async ({ page }) => {
  await iniciarSesionDemo(page);
  await page.goto(`${TAL}/seleccion/procesos/${procesoId}`);
  const tarjeta = page.locator('[data-etapa="Postulantes"]').getByTestId("tarjeta-postulante").filter({ hasText: apellido });
  await expect(tarjeta).toBeVisible();
  await expect(tarjeta).toContainText("Sin calificar");
  await expect(tarjeta).toContainText("Portal simulado (tipo LinkedIn)");
  await expect(page.getByTestId("aviso-nuevos")).toHaveText(/1 postulante nuevo fue agregado al proceso/);
  for (const otro of ["9001", "9002"]) {
    await page.goto(`${TAL}/seleccion/procesos/${otro}`);
    await expect(page.getByText(apellido)).toHaveCount(0);
  }
});

test("C5 · descargar el CV y comprobar que el hash coincide con el original", async ({ page }) => {
  await iniciarSesionDemo(page);
  await page.goto(`${TAL}/seleccion/procesos/${procesoId}`);
  await page.getByRole("link", { name: new RegExp(apellido) }).click();
  const [descarga] = await Promise.all([page.waitForEvent("download"), page.getByTestId("descargar-cv").click()]);
  expect(sha256Archivo((await descarga.path())!)).toBe(sha256Archivo(CV));
});

test("C6 · reenviar el evento sin duplicar", async ({ page }) => {
  await abrirAplicacionPuente(page);
  const fila = page.locator(`[data-testid="fila-entrega"][data-job-application-id="${jobApplicationId}"]`);
  await fila.getByRole("button", { name: "Reenviar evento" }).click();
  await expect(fila.getByTestId("resultado-reenvio")).toContainText("HTTP 200");
  await expect(fila.getByTestId("resultado-reenvio")).toContainText("DUPLICADO");

  await iniciarSesionDemo(page);
  await page.goto(`${TAL}/seleccion/procesos/${procesoId}`);
  await expect(page.getByTestId("tarjeta-postulante").filter({ hasText: apellido })).toHaveCount(1);
  await page.goto(`${PUE}/`);
  await page.locator(`[data-testid="fila-operacion"][data-job-application-id="${jobApplicationId}"]`).getByRole("link").click();
  await expect(page.getByTestId("linea-tiempo")).toContainText("Se recibió de nuevo el mismo jobApplicationId; no se creó nada.");
});

test("C7 · rechazo controlado de entradas inválidas", async ({ page }) => {
  // Formulario de Vínculo: un archivo que no es PDF.
  await postular(page, { codigo: tituloVacante, apellido: `Invalido ${sufijoUnico()}`, correo: correoUnico("invalido"), cv: "fixtures/cv/no-es-pdf.pdf" });
  await expect(page.getByText(/no es un PDF válido/)).toBeVisible();

  // Webhook del puente con la consola de pruebas del portal de desarrolladores (equivale a Postman).
  await abrirAplicacionPuente(page);
  const casos: [string, string, string][] = [
    ["firma_invalida", "HTTP 401", "SIGNATURE_MISMATCH"],
    ["falta_correo", "HTTP 400", "MISSING_REQUIRED_RESPONSE"],
    ["correo_invalido", "HTTP 400", "INPUT_VALIDATION_FAILED"],
    ["sin_vincular", "HTTP 422", "JOB_POSTING_CLOSED"],
    ["host_no_autorizado", "HTTP 400", "INPUT_VALIDATION_FAILED"],
    ["json_ilegible", "HTTP 400", "INPUT_VALIDATION_FAILED"],
  ];
  for (const [caso, status, codigo] of casos) {
    await page.getByLabel("Caso").selectOption(caso);
    await page.getByRole("button", { name: "Enviar al webhook" }).click();
    await expect(page.getByTestId("consola-status")).toHaveText(status);
    await expect(page.getByTestId("consola-cuerpo")).toContainText(codigo);
  }
  await iniciarSesionDemo(page);
  await page.goto(`${PUE}/rechazos`);
  await expect(page.getByTestId("fila-rechazo").first()).toBeVisible();
});

test("C8 · reiniciar app y worker sin perder datos ni operaciones pendientes", async ({ page }) => {
  test.setTimeout(150_000);
  await iniciarSesionDemo(page);

  // a) Con el worker detenido, la postulación queda guardada en la outbox (pendiente).
  await matarWorker();
  const apellido8 = `Reinicio ${sufijoUnico()}`;
  await postular(page, { codigo: tituloVacante, apellido: apellido8, correo: correoUnico("reinicio") });
  await expect(page.locator("[data-estado-entrega]")).toHaveText("Enviando a la empresa…");
  const ref = await referencia(page);
  const urlConfirmacion = page.url();

  // b) Se cae la app también. Al volver, la postulación pendiente sigue ahí.
  await matarApp();
  await iniciarApp();
  await page.goto(urlConfirmacion);
  await expect(page.getByTestId("job-application-id")).toHaveText(ref);
  await expect(page.locator("[data-estado-entrega]")).toHaveText("Enviando a la empresa…");

  // c) Vuelve el worker: entrega y procesa sin intervención.
  await iniciarWorker();
  await expect(page.locator("[data-estado-entrega]")).toHaveText("Entregada a la empresa", { timeout: 30_000 });
  await iniciarSesionDemo(page);
  await page.goto(`${TAL}/seleccion/procesos/${procesoId}`);
  await expect(page.getByTestId("tarjeta-postulante").filter({ hasText: apellido8 })).toBeVisible({ timeout: 30_000 });

  // d) Caída a mitad de una llamada al ATS: el ATS ya guardó el documento pero tarda en responder,
  //    y en ese momento mueren app y worker. Al volver, la Idempotency-Key evita el documento duplicado.
  await page.goto(`${PUE}/pruebas`);
  await page.getByLabel("Operación del ATS").selectOption("documentos");
  await page.getByLabel("Tipo de fallo").selectOption("LENTO");
  await page.getByLabel(/Solicitudes afectadas/).fill("1");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page.getByText("Fallo configurado")).toBeVisible();
  const apellido9 = `Mitad ${sufijoUnico()}`;
  await postular(page, { codigo: tituloVacante, apellido: apellido9, correo: correoUnico("mitad") });
  const ref9 = await referencia(page);
  await iniciarSesionDemo(page);
  await page.goto(`${PUE}/`);
  const fila9 = page.locator(`[data-testid="fila-operacion"][data-job-application-id="${ref9}"]`);
  await expect(fila9).toContainText("Procesando", { timeout: 30_000 });
  await expect(fila9).toContainText("Candidato creado");

  await matarWorker();
  await matarApp();
  await iniciarApp();
  await iniciarWorker();
  await iniciarSesionDemo(page);
  await page.goto(`${PUE}/`);
  await expect(page.locator(`[data-testid="fila-operacion"][data-job-application-id="${ref9}"]`)).toContainText("Completado", { timeout: 60_000 });
  await page.goto(`${TAL}/seleccion/procesos/${procesoId}`);
  await expect(page.getByTestId("tarjeta-postulante").filter({ hasText: apellido9 })).toHaveCount(1);
  await page.getByRole("link", { name: new RegExp(apellido9) }).click();
  await expect(page.getByTestId("descargar-cv")).toHaveCount(1); // un solo documento
});

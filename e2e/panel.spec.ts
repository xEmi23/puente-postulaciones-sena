import { expect, test, type Page } from "@playwright/test";
import { PUE, TAL, VIN } from "./procesos";
import { abrirVacante, correoUnico, iniciarSesionDemo, iniciarSesionPuente, postular, quitarFallos, sufijoUnico } from "./utilidades";

/** Lee la referencia de la confirmación del origen (el panel enmascara el nombre y el correo a propósito). */
async function referenciaDeConfirmacion(page: Page): Promise<string> {
  const ref = page.getByTestId("job-application-id");
  await expect(ref).toBeVisible();
  return (await ref.textContent())!.trim();
}

async function abrirOperacion(page: Page, jobApplicationId: string) {
  await page.goto(`${PUE}/`);
  const fila = page.locator(`[data-testid="fila-operacion"][data-job-application-id="${jobApplicationId}"]`);
  await expect(fila).toBeVisible({ timeout: 30_000 });
  await fila.getByRole("link").click();
}

test.describe("Panel del puente", () => {
  test.afterEach(async ({ page }, info) => {
    info.setTimeout(info.timeout + 30_000); // la limpieza no compite con el tiempo de la prueba
    await quitarFallos(page);
  });
  test("sin sesión no se entra al panel ni al ATS; con credenciales erróneas se informa", async ({ page }) => {
    await page.goto(`${PUE}/`);
    await expect(page).toHaveURL(new RegExp(`^${PUE}/ingresar\\?siguiente=%2F`));
    await page.goto(`${TAL}/seleccion/procesos/9001`);
    await expect(page).toHaveURL(/\/ingresar/);
    const r = await page.request.get(`${TAL}/documentos/00000000-0000-4000-8000-000000000000/descargar`, { maxRedirects: 0 });
    expect([307, 308, 401]).toContain(r.status());

    await page.goto(`${PUE}/ingresar`);
    await page.getByLabel("Correo").fill("admin@puente.demo.test");
    await page.getByLabel("Contraseña").fill("incorrecta");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page.getByText("Correo o contraseña incorrectos.")).toBeVisible();

    // Criterio 1: con sesión en el puente, Talentia y Vínculo siguen pidiendo su propio ingreso (cookies separadas).
    await iniciarSesionPuente(page, "operador");
    await expect(page).toHaveURL(new RegExp(`^${PUE}/operaciones`));
    await page.goto(`${TAL}/seleccion/procesos`);
    await expect(page).toHaveURL(/\/ingresar/);
    await page.goto(`${VIN}/reclutador`);
    await expect(page).toHaveURL(/\/ingresar/);
    expect((await page.context().cookies()).map((c) => c.name).filter((n) => /^(tal|vin)_/.test(n))).toEqual([]);
  });

  test("muestra la operación completada con su línea de tiempo y las métricas medidas", async ({ page }) => {
    const apellido = `Panel ${sufijoUnico()}`;
    const correo = correoUnico("panel");
    await postular(page, { apellido, correo });
    await expect(page.locator("[data-estado-entrega]")).toHaveText("Entregada a la empresa", { timeout: 30_000 });
    const ref = await referenciaDeConfirmacion(page);

    await iniciarSesionDemo(page);
    await abrirOperacion(page, ref);
    await expect(page.getByTestId("estado-operacion")).toHaveText("Completado", { timeout: 30_000 });
    const linea = page.getByTestId("linea-tiempo");
    await expect(linea).toContainText("Postulación recibida y firma verificada.");
    await expect(linea).toContainText("CV descargado");
    await expect(linea).toContainText("Postulación creada en la etapa Postulantes del Simulador BUK.");
    // El correo completo nunca aparece en el panel (solo enmascarado).
    await expect(page.locator("body")).not.toContainText(correo);
    await expect(page.locator("body")).toContainText("pa•••@demo.test");

    await page.goto(`${PUE}/`);
    const metricas = page.getByTestId("metricas");
    await expect(metricas).toContainText("Recibidas");
    await expect(metricas.locator('[data-metrica="tiempos"]')).toContainText(/n = [1-9]/);
  });

  test("«Cerrar en Vínculo» deja la vacante sin recibir postulaciones; «Publicar de nuevo» la reabre", async ({ page }) => {
    await iniciarSesionDemo(page);
    await page.goto(`${PUE}/procesos`);
    const fila = page.locator('[data-testid="fila-proceso"][data-proceso="9002"]');
    const urlVacante = (await fila.getByRole("link", { name: /Ver en el Simulador LinkedIn/ }).getAttribute("href"))!;
    await fila.getByRole("button", { name: "Cerrar en el Simulador LinkedIn" }).click();
    await expect(page.locator(".alerta-exito")).toContainText("cerrada en el Simulador LinkedIn");
    try {
      await expect(page.locator('[data-testid="fila-proceso"][data-proceso="9002"]').getByTestId("estado-publicacion")).toContainText("Cerrada");
      await page.goto(urlVacante); // el buscador ya no la lista
      await expect(page.getByTestId("accion-postular")).toContainText("Esta vacante ya no recibe postulaciones.");
    } finally {
      await page.goto(`${PUE}/procesos`);
      await page.locator('[data-testid="fila-proceso"][data-proceso="9002"]').getByRole("button", { name: "Publicar de nuevo" }).click();
      await expect(page.locator(".alerta-exito")).toContainText("publicado en el Simulador LinkedIn con «Solicitud sencilla»");
    }
    await abrirVacante(page, "9002");
    await expect(page.getByRole("link", { name: "Solicitud sencilla" })).toBeVisible();
  });

  test("ATS caído: reintenta solo y completa; la línea de tiempo muestra el intento fallido", async ({ page }) => {
    await iniciarSesionDemo(page);
    await page.goto(`${PUE}/pruebas`);
    await page.getByLabel("Operación del ATS").selectOption("documentos");
    await page.getByLabel("Tipo de fallo").selectOption("NO_DISPONIBLE");
    await page.getByLabel(/Solicitudes afectadas/).fill("1");
    await page.getByRole("button", { name: "Aplicar" }).click();
    await expect(page.getByText("Fallo configurado")).toBeVisible();

    const apellido = `Caido ${sufijoUnico()}`;
    await postular(page, { apellido, correo: correoUnico("caido") });
    await abrirOperacion(page, await referenciaDeConfirmacion(page));
    await expect(page.getByTestId("estado-operacion")).toHaveText("Completado", { timeout: 30_000 });
    await expect(page.getByTestId("linea-tiempo")).toContainText("ATS_NO_DISPONIBLE");
  });

  test("respuesta perdida sin forma de saber → Requiere verificación → «Reconciliar con Talentia» la completa", async ({ page }) => {
    await iniciarSesionDemo(page);
    await page.goto(`${PUE}/pruebas`);
    for (const [ruta, modo, n] of [
      ["postulaciones", "PERDER_RESPUESTA", "1"],
      ["consulta", "NO_DISPONIBLE", "-1"],
    ]) {
      await page.getByLabel("Operación del ATS").selectOption(ruta);
      await page.getByLabel("Tipo de fallo").selectOption(modo);
      await page.getByLabel(/Solicitudes afectadas/).fill(n);
      await page.getByRole("button", { name: "Aplicar" }).click();
      await expect(page.getByText("Fallo configurado")).toBeVisible();
    }

    const apellido = `Verificar ${sufijoUnico()}`;
    await postular(page, { apellido, correo: correoUnico("verificar") });
    await abrirOperacion(page, await referenciaDeConfirmacion(page));
    await expect(page.getByTestId("estado-operacion")).toHaveText("Requiere verificación", { timeout: 40_000 });
    await expect(page.getByText(/no se sabe si quedó creada/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Reintentar" })).toHaveCount(0);

    const url = page.url();
    await page.goto(`${PUE}/pruebas`);
    await page.getByRole("button", { name: "Quitar todos los fallos" }).click();
    await page.goto(url);
    await page.getByRole("button", { name: "Reconciliar con el Simulador BUK" }).click();
    await expect(page.locator(".alerta-exito")).toContainText("Simulador BUK ya tenía la postulación");
    await expect(page.getByTestId("linea-tiempo")).toContainText("Reconciliado desde el panel");
    await expect(page.getByTestId("estado-operacion")).toHaveText("Completado");
  });
});

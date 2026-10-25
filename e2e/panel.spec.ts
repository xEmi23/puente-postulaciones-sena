import { expect, test, type Page } from "@playwright/test";
import { correoUnico, iniciarSesionDemo, postular, sufijoUnico } from "./utilidades";

/** Lee la referencia de la confirmación del origen (el panel enmascara el nombre y el correo a propósito). */
async function referenciaDeConfirmacion(page: Page): Promise<string> {
  const ref = page.getByTestId("job-application-id");
  await expect(ref).toBeVisible();
  return (await ref.textContent())!.trim();
}

async function abrirOperacion(page: Page, jobApplicationId: string) {
  await page.goto("/puente");
  const fila = page.locator(`[data-testid="fila-operacion"][data-job-application-id="${jobApplicationId}"]`);
  await expect(fila).toBeVisible({ timeout: 30_000 });
  await fila.getByRole("link").click();
}

test.describe("Panel del puente", () => {
  test("sin sesión no se entra al panel ni al ATS; con credenciales erróneas se informa", async ({ page }) => {
    await page.goto("/puente");
    await expect(page).toHaveURL(/\/ingresar\?siguiente=%2Fpuente/);
    await page.goto("/ats/procesos/9001");
    await expect(page).toHaveURL(/\/ingresar/);
    const r = await page.request.get("/ats/documentos/00000000-0000-4000-8000-000000000000/descargar", { maxRedirects: 0 });
    expect([307, 308, 401]).toContain(r.status());

    await page.goto("/ingresar");
    await page.getByLabel("Usuario").fill("demo-e2e");
    await page.getByLabel("Contraseña").fill("incorrecta");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page.getByText("Usuario o contraseña incorrectos.")).toBeVisible();
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
    await expect(linea).toContainText("Postulación creada en la etapa Postulantes.");
    // El correo completo nunca aparece en el panel (solo enmascarado).
    await expect(page.locator("body")).not.toContainText(correo);
    await expect(page.locator("body")).toContainText("pa•••@demo.test");

    await page.goto("/puente");
    const metricas = page.getByTestId("metricas");
    await expect(metricas).toContainText("Recibidas");
    await expect(metricas.locator('[data-metrica="tiempos"]')).toContainText(/n = [1-9]/);
  });

  test("vacante desvinculada → el origen no puede entregar (JOB_POSTING_CLOSED) y aparece en rechazos", async ({ page }) => {
    await iniciarSesionDemo(page);
    await page.goto("/puente/correspondencias");
    const fila = page.getByTestId("fila-correspondencia").filter({ hasText: "RT-2026-102" });
    await fila.getByRole("button", { name: "Desvincular" }).click();
    await expect(page.getByText(/RT-2026-102 desvinculada/)).toBeVisible();

    try {
      await postular(page, { codigo: "RT-2026-102", apellido: `Cerrada ${sufijoUnico()}`, correo: correoUnico("cerrada") });
      await expect(page.locator("[data-estado-entrega]")).toHaveText("No se pudo entregar", { timeout: 30_000 });
      await page.goto("/puente/rechazos");
      await expect(page.getByTestId("fila-rechazo").filter({ hasText: "RT-2026-102" }).first()).toContainText("JOB_POSTING_CLOSED");
    } finally {
      await page.goto("/puente/correspondencias");
      await page.getByTestId("fila-correspondencia").filter({ hasText: "RT-2026-102" }).getByRole("button", { name: "Activar" }).click();
      await expect(page.getByText(/RT-2026-102 vinculada de nuevo/)).toBeVisible();
    }
  });

  test("ATS caído: reintenta solo y completa; la línea de tiempo muestra el intento fallido", async ({ page }) => {
    await iniciarSesionDemo(page);
    await page.goto("/puente/pruebas");
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

  test("respuesta perdida sin forma de saber → Requiere verificación → «Reconciliar con el ATS» la completa", async ({ page }) => {
    await iniciarSesionDemo(page);
    await page.goto("/puente/pruebas");
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
    await page.goto("/puente/pruebas");
    await page.getByRole("button", { name: "Quitar todos los fallos" }).click();
    await page.goto(url);
    await page.getByRole("button", { name: "Reconciliar con el ATS" }).click();
    await expect(page.locator(".alerta-exito")).toContainText("El ATS ya tenía la postulación");
    await expect(page.getByTestId("linea-tiempo")).toContainText("Reconciliado desde el panel");
    await expect(page.getByTestId("estado-operacion")).toHaveText("Completado");
  });
});

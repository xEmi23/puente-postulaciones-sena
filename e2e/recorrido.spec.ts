import { expect, test } from "@playwright/test";
import { TAL, VIN } from "./procesos";
import { CV, correoUnico, iniciarSesionDemo, postular, sha256Archivo, sufijoUnico } from "./utilidades";

test.describe("Recorrido principal", () => {
  test("postular con PDF → aparece en Postulantes del proceso 9001 → el CV descargado tiene el mismo hash", async ({ page }) => {
    const apellido = `Recorrido ${sufijoUnico()}`;
    const correo = correoUnico("camila.recorrido");

    // Portal de origen: catálogo y detalle.
    await page.goto(`${VIN}/`);
    await expect(page.getByText("Entorno de simulación").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Desarrollador/a Backend Java" })).toBeVisible();

    await postular(page, { apellido, correo, telefono: "300 000 0001" });
    await expect(page.getByRole("heading", { name: "¡Tu postulación fue enviada!" })).toBeVisible();
    // Sin copiar nada: el despachador entrega y la pantalla se actualiza sola.
    await expect(page.locator("[data-estado-entrega]")).toHaveText("Entregada a la empresa", { timeout: 30_000 });

    // ATS: el tablero del proceso correcto muestra la tarjeta en la columna Postulantes.
    await iniciarSesionDemo(page);
    await page.goto(`${TAL}/seleccion/procesos/9001`);
    const columna = page.locator('[data-etapa="Postulantes"]');
    const tarjeta = columna.getByTestId("tarjeta-postulante").filter({ hasText: apellido });
    await expect(tarjeta).toBeVisible({ timeout: 30_000 });
    await expect(tarjeta).toContainText("Sin calificar");
    await expect(tarjeta).toContainText("Portal simulado (tipo LinkedIn)");
    await expect(page.getByTestId("aviso-nuevos")).toContainText(/postulantes? nuevos? fue(ron)? agregados? al proceso/);

    // No aparece en el otro proceso.
    await page.goto(`${TAL}/seleccion/procesos/9002`);
    await expect(page.getByText(apellido)).toHaveCount(0);

    // Detalle del candidato y descarga del CV: el hash coincide con el archivo original.
    await page.goto(`${TAL}/seleccion/procesos/9001`);
    await page.getByRole("link", { name: new RegExp(apellido) }).click();
    await expect(page.getByRole("heading", { name: new RegExp(apellido) })).toBeVisible();
    const [descarga] = await Promise.all([page.waitForEvent("download"), page.getByTestId("descargar-cv").click()]);
    const ruta = await descarga.path();
    expect(sha256Archivo(ruta!)).toBe(sha256Archivo(CV));
    await expect(page.getByTestId("sha256-documento")).toHaveText(sha256Archivo(CV));
  });

  test("el formulario rechaza con mensajes claros datos inválidos y archivos que no son PDF", async ({ page }) => {
    await page.goto(`${VIN}/vacantes/RT-2026-101`);
    await page.getByLabel("Nombre").fill("C");
    await page.getByLabel("Apellido").fill("Prueba");
    await page.getByLabel("Correo electrónico").fill("no-es-correo");
    await page.getByLabel("Ciudad").fill("Medellín");
    await page.getByLabel("Hoja de vida (PDF)").setInputFiles("fixtures/cv/no-es-pdf.pdf");
    await page.getByRole("button", { name: "Enviar postulación" }).click();
    await expect(page.getByText("Revisa los campos marcados para continuar.")).toBeVisible();
    await expect(page.getByText("Debe tener al menos 2 caracteres.")).toBeVisible();
    await expect(page.getByText(/Escribe un correo válido/)).toBeVisible();
    await expect(page.getByText(/no es un PDF válido/)).toBeVisible();
    await expect(page.getByLabel("Nombre")).toHaveAttribute("aria-invalid", "true");
  });
});

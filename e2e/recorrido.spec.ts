import { expect, test } from "@playwright/test";
import { TAL, VIN } from "./procesos";
import { CV, abrirVacante, correoUnico, iniciarSesionDemo, postular, registrarCandidato, sha256Archivo, sufijoUnico } from "./utilidades";

test.describe("Recorrido principal", () => {
  test("postular con PDF → aparece en Postulantes del proceso 9001 → el CV descargado tiene el mismo hash", async ({ page }) => {
    const apellido = `Recorrido ${sufijoUnico()}`;
    const correo = correoUnico("camila.recorrido");

    // Portal de origen: catálogo y detalle.
    await page.goto(`${VIN}/`);
    await expect(page.getByText("Entorno de simulación").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Desarrollador/a Backend Java" })).toBeVisible();

    await postular(page, { apellido, correo, telefono: "300 000 0001" });
    await expect(page.getByRole("heading", { name: "¡Tu solicitud fue enviada!" })).toBeVisible();
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

  test("la Solicitud sencilla rechaza con mensajes claros datos inválidos y archivos que no son PDF", async ({ page }) => {
    await registrarCandidato(page, "Carla", `Validacion ${sufijoUnico()}`, correoUnico("validacion"));
    await abrirVacante(page, "RT-2026-101");
    await page.getByRole("link", { name: "Solicitud sencilla" }).click();
    // Paso 1: los obligatorios vacíos se marcan y el foco va al primero.
    await page.getByLabel("Ciudad").fill("");
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByLabel("Ciudad")).toBeFocused();
    await expect(page.getByText("Este campo es obligatorio.")).toBeVisible();
    // Formato inválido: lo valida el servidor al enviar y la persona vuelve al paso 1 con los errores.
    await page.getByLabel("Nombre", { exact: true }).fill("C");
    await page.getByLabel("Correo electrónico").fill("no-es-correo");
    await page.getByLabel("Ciudad").fill("Medellín");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Hoja de vida (PDF)").setInputFiles("fixtures/cv/no-es-pdf.pdf");
    await page.getByRole("button", { name: "Enviar solicitud" }).click();
    await expect(page.getByText("Revisa los campos marcados para continuar.")).toBeVisible();
    await expect(page.getByText("Debe tener al menos 2 caracteres.")).toBeVisible();
    await expect(page.getByText(/Escribe un correo válido/)).toBeVisible();
    await expect(page.getByLabel("Nombre", { exact: true })).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Nombre", { exact: true })).toBeFocused();
    // Con el contacto corregido, el PDF inválido se rechaza en el paso 2.
    await page.getByLabel("Nombre", { exact: true }).fill("Carla");
    await page.getByLabel("Correo electrónico").fill(correoUnico("carla"));
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Hoja de vida (PDF)").setInputFiles("fixtures/cv/no-es-pdf.pdf");
    await page.getByRole("button", { name: "Enviar solicitud" }).click();
    await expect(page.getByText(/no es un PDF válido/)).toBeVisible();
    await expect(page.getByText(/Ya enviaste/)).toHaveCount(0);
  });
});

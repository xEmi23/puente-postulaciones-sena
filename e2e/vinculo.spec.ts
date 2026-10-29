import { expect, test } from "@playwright/test";
import { VIN } from "./procesos";
import { abrirVacante, correoUnico, iniciarSesionVinculo, postular, registrarCandidato, sufijoUnico } from "./utilidades";

test.describe("Vínculo", () => {
  test("criterio 4 · un desarrollador registra una aplicación, ve el Client Secret una sola vez y obtiene un token", async ({ page, request }) => {
    await registrarCandidato(page, "Diego", `Desarrollador ${sufijoUnico()}`, correoUnico("dev"));
    await page.goto(`${VIN}/developers`);
    await page.getByLabel("Nombre de la aplicación").fill(`ATS de prueba ${sufijoUnico()}`);
    await page.getByRole("button", { name: "Crear aplicación" }).click();
    const clientId = (await page.getByTestId("client-id").textContent())!.trim();
    const secreto = (await page.getByTestId("client-secret").textContent())!.trim();
    expect(clientId).toMatch(/^vin_[0-9a-f]{16}$/);
    expect(secreto.length).toBeGreaterThan(30);

    // Una sola vez: en la página de la aplicación ya no aparece.
    await page.getByRole("link", { name: "Ir a la aplicación" }).click();
    await expect(page.getByTestId("client-id-app")).toHaveText(clientId);
    await expect(page.locator("body")).not.toContainText(secreto);

    const ok = await request.post(`${VIN}/oauth/v2/accessToken`, { form: { grant_type: "client_credentials", client_id: clientId, client_secret: secreto } });
    expect(ok.status()).toBe(200);
    expect((await ok.json()).expires_in).toBe(3600);
    const malo = await request.post(`${VIN}/oauth/v2/accessToken`, { form: { grant_type: "client_credentials", client_id: clientId, client_secret: "otro" } });
    expect(malo.status()).toBe(401);
  });

  test("/developers/docs carga la documentación con los webhooks de la entrega", async ({ page }) => {
    await page.goto(`${VIN}/developers/docs`);
    await expect(page.getByRole("heading", { name: "Documentación de la API de Vínculo" })).toBeVisible();
    await expect(page.locator("#swagger")).toContainText("/api/v1/jobPostings", { timeout: 20_000 });
    await expect(page.locator("#swagger")).toContainText("entregaPostulacion");
  });

  test("el reclutador descarga el CV a mano y la persona ve «CV descargado» en Mis postulaciones", async ({ page }) => {
    const apellido = `Manual ${sufijoUnico()}`;
    const correo = correoUnico("manual");
    // Una vacante de Andina con Solicitud sencilla SIN ATS conectado (lo que hoy se descarga a mano).
    await registrarCandidato(page, "Paula", apellido, correo);
    await abrirVacante(page, "Scrum Master");
    await page.getByRole("link", { name: "Solicitud sencilla" }).click();
    await page.getByLabel("Ciudad").fill("Bello");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Hoja de vida (PDF)").setInputFiles("fixtures/cv/cv-sofia-demo.pdf");
    await page.getByRole("button", { name: "Enviar solicitud" }).click();
    await expect(page.getByText("La empresa revisará tu solicitud directamente en Vínculo.")).toBeVisible();
    const ref = (await page.getByTestId("job-application-id").textContent())!.trim();

    await iniciarSesionVinculo(page, "reclutadora");
    await page.goto(`${VIN}/reclutador`);
    await page.getByTestId("fila-vacante").getByRole("link", { name: "Scrum Master" }).click();
    const fila = page.getByTestId("fila-postulante").filter({ hasText: apellido });
    await expect(fila).toContainText("Enviada");
    await Promise.all([page.waitForEvent("download"), fila.getByTestId("descargar-cv-manual").click()]);
    await page.reload();
    await expect(page.getByTestId("fila-postulante").filter({ hasText: apellido })).toContainText("CV descargado");

    await page.context().clearCookies({ name: /^vin_/ });
    await page.goto(`${VIN}/ingresar`);
    await page.getByLabel("Correo").fill(correo);
    await page.getByLabel("Contraseña").fill("ClaveDePrueba123");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).not.toHaveURL(/ingresar/);
    await page.goto(`${VIN}/mis-postulaciones`);
    await expect(page.locator(`[data-testid="mi-postulacion"][data-job-application-id="${ref}"]`).getByTestId("estado-postulacion")).toHaveText("CV descargado");
  });

  test("un candidato ya postulado no puede repetir y un reclutador no ve el portal de candidato", async ({ page }) => {
    const correo = correoUnico("repite");
    await postular(page, { apellido: `Repite ${sufijoUnico()}`, correo });
    await expect(page.getByRole("heading", { name: "¡Tu solicitud fue enviada!" })).toBeVisible();
    await abrirVacante(page, "9001");
    await expect(page.getByTestId("accion-postular")).toContainText("Ya enviaste tu solicitud");
    await iniciarSesionVinculo(page, "reclutadora");
    await page.goto(`${VIN}/mis-postulaciones`);
    await expect(page.getByText("Esa sección es solo para cuentas de candidato.")).toBeVisible();
  });
});

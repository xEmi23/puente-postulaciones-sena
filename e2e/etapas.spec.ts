import { expect, test } from "@playwright/test";
import { TAL } from "./procesos";
import { correoUnico, iniciarSesionDemo, postular, sufijoUnico } from "./utilidades";

test("el tablero muestra las etapas de la referencia con su tipo y permite descartar y restaurar sin perder la tarjeta", async ({ page }) => {
  const apellido = `Etapas ${sufijoUnico()}`;
  await postular(page, { codigo: "9002", apellido, correo: correoUnico("etapas") });
  await expect(page.locator("[data-estado-entrega]")).toHaveText("Entregada a la empresa", { timeout: 30_000 });

  await iniciarSesionDemo(page);
  await page.goto(`${TAL}/seleccion/procesos/9002`);
  const columnas = page.locator("[data-etapa]");
  await expect(columnas).toHaveCount(9);
  await expect(columnas.first()).toHaveAttribute("data-etapa", "Postulantes");
  await expect(columnas.last()).toHaveAttribute("data-etapa", "Contratados");
  await expect(page.locator('[data-etapa="Postulantes"] [data-tipo-etapa]')).toHaveText("Entrada");
  await expect(page.locator('[data-etapa="Referidos"] [data-tipo-etapa]')).toHaveText("Validaciones");
  await expect(page.locator('[data-etapa="Prueba técnica"] [data-tipo-etapa]')).toHaveText("Filtro");
  await expect(page.locator('[data-etapa="Valoración psicológica"] [data-tipo-etapa]')).toHaveText("Entrevistas");
  await expect(page.locator('[data-etapa="Contratados"] [data-tipo-etapa]')).toHaveText("Etapa final");

  const postulantes = page.locator('[data-etapa="Postulantes"]');
  const tarjeta = postulantes.getByTestId("tarjeta-postulante").filter({ hasText: apellido });
  await expect(tarjeta).toBeVisible({ timeout: 30_000 });
  const descartados = postulantes.getByTestId("descartados");
  const antes = Number((await descartados.locator("summary").textContent())!.match(/\((\d+)\)/)![1]);

  await tarjeta.getByRole("button", { name: /Descartar/ }).click();
  await expect(postulantes.getByTestId("tarjeta-postulante").filter({ hasText: apellido })).toHaveCount(0);
  await expect(descartados.locator("summary")).toHaveText(`Descartados (${antes + 1})`);
  await descartados.locator("summary").click();
  const descartada = descartados.getByTestId("tarjeta-descartada").filter({ hasText: apellido });
  await expect(descartada).toBeVisible();

  await descartada.getByRole("button", { name: /Restaurar/ }).click();
  await expect(postulantes.getByTestId("tarjeta-postulante").filter({ hasText: apellido })).toBeVisible();
  await expect(descartados.locator("summary")).toHaveText(`Descartados (${antes})`);
});

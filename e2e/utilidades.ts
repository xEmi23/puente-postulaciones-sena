import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

export const CV = path.resolve("fixtures/cv/cv-camila-ejemplo.pdf");
export const sha256Archivo = (ruta: string) => createHash("sha256").update(readFileSync(ruta)).digest("hex");

/** Correo único por ejecución para no chocar con datos de pruebas anteriores. */
export const correoUnico = (prefijo: string) => `${prefijo}.${Date.now()}.${Math.floor(Math.random() * 1e4)}@demo.test`;

export async function iniciarSesionDemo(page: Page) {
  await page.goto("/ingresar");
  await page.getByLabel("Usuario").fill("demo-e2e");
  await page.getByLabel("Contraseña").fill("clave-e2e-solo-local");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).not.toHaveURL(/ingresar/);
}

export async function postular(
  page: Page,
  opciones: { codigo?: string; nombre?: string; apellido: string; correo: string; cv?: string; telefono?: string },
) {
  await page.goto(`/origen/vacantes/${opciones.codigo ?? "RT-2026-101"}`);
  await page.getByLabel("Nombre").fill(opciones.nombre ?? "Camila");
  await page.getByLabel("Apellido").fill(opciones.apellido);
  await page.getByLabel("Correo electrónico").fill(opciones.correo);
  if (opciones.telefono) await page.getByLabel("Teléfono").fill(opciones.telefono);
  await page.getByLabel("Ciudad").fill("Medellín");
  await page.getByLabel("Hoja de vida (PDF)").setInputFiles(opciones.cv ?? CV);
  await page.getByRole("button", { name: "Enviar postulación" }).click();
}

/** Sufijo único solo con letras (los nombres solo admiten letras): dígitos del timestamp → a–j. */
export const sufijoUnico = () =>
  String(Date.now() + Math.floor(Math.random() * 1000))
    .split("")
    .map((d) => "abcdefghij"[Number(d)])
    .join("");

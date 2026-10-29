import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { DEMO_CLAVE, DEMO_USUARIO, PUE, TAL, VIN } from "./procesos";

export { PUE, TAL, VIN };

export const CV = path.resolve(__dirname, "../fixtures/cv/cv-camila-ejemplo.pdf");
export const sha256Archivo = (ruta: string) => createHash("sha256").update(readFileSync(ruta)).digest("hex");

/** Correo único por ejecución para no chocar con datos de pruebas anteriores. */
export const correoUnico = (prefijo: string) => `${prefijo}.${Date.now()}.${Math.floor(Math.random() * 1e4)}@demo.test`;

/** Cuentas de demostración de Talentia (se muestran en su pantalla de ingreso). */
export const TALENTIA = { admin: "admin@andina.demo.test", reclutador: "reclutador@andina.demo.test", clave: "Demo2026!" };

/** Inicia sesión en Talentia con una cuenta de demostración (Better Auth, cookie tal_sesion). */
export async function iniciarSesionTalentia(page: Page, cuenta: "admin" | "reclutador" = "admin") {
  // Con sesión vigente no hace falta volver a ingresar (la pantalla de ingreso redirigiría).
  if ((await page.context().cookies(TAL)).some((c) => c.name === "tal_sesion")) return;
  await page.goto(`${TAL}/ingresar`);
  await page.getByLabel("Correo").fill(TALENTIA[cuenta]);
  await page.getByLabel("Contraseña").fill(TALENTIA.clave);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).not.toHaveURL(/ingresar/);
}

/** Inicia sesión de demostración en un sistema (cada uno tiene su propio inicio de sesión y su cookie). */
export async function iniciarSesionEn(page: Page, base: string) {
  if (base === TAL) return iniciarSesionTalentia(page);
  await page.goto(`${base}/ingresar`);
  await page.getByLabel("Usuario").fill(DEMO_USUARIO);
  await page.getByLabel("Contraseña").fill(DEMO_CLAVE);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).not.toHaveURL(/ingresar/);
}

/** Sesión en los tres sistemas (administración de Vínculo, Talentia y el panel del puente). */
export async function iniciarSesionDemo(page: Page) {
  for (const base of [VIN, TAL, PUE]) await iniciarSesionEn(page, base);
}

export async function postular(
  page: Page,
  opciones: { codigo?: string; nombre?: string; apellido: string; correo: string; cv?: string; telefono?: string },
) {
  await page.goto(`${VIN}/vacantes/${opciones.codigo ?? "RT-2026-101"}`);
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

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

/** Cuentas de demostración (se muestran en las pantallas de ingreso). */
export const CLAVE_DEMO = "Demo2026!";
export const TALENTIA = { admin: "admin@andina.demo.test", reclutador: "reclutador@andina.demo.test", clave: CLAVE_DEMO };
export const VINCULO = { reclutadora: "reclutadora@andina.demo.test", candidata: "valentina.rios@demo.test", candidato: "santiago.mejia@demo.test" };

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

/** Cierra la sesión de Vínculo del navegador (en Vínculo cada persona tiene su cuenta). */
export async function salirDeVinculo(page: Page) {
  await page.context().clearCookies({ name: /^vin_/ });
}

/** Inicia sesión en Vínculo con una cuenta de demostración, reemplazando la sesión que hubiera. */
export async function iniciarSesionVinculo(page: Page, cuenta: keyof typeof VINCULO = "reclutadora") {
  await salirDeVinculo(page);
  await page.goto(`${VIN}/ingresar`);
  await page.getByLabel("Correo").fill(VINCULO[cuenta]);
  await page.getByLabel("Contraseña").fill(CLAVE_DEMO);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).not.toHaveURL(/ingresar/);
}

/** Inicia sesión de demostración en un sistema (cada uno tiene su propio inicio de sesión y su cookie). */
export async function iniciarSesionEn(page: Page, base: string) {
  if (base === TAL) return iniciarSesionTalentia(page);
  if (base === VIN) return iniciarSesionVinculo(page, "reclutadora");
  await page.goto(`${base}/ingresar`);
  await page.getByLabel("Usuario").fill(DEMO_USUARIO);
  await page.getByLabel("Contraseña").fill(DEMO_CLAVE);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).not.toHaveURL(/ingresar/);
}

/** Sesión en Talentia y en el panel del puente (Vínculo se maneja aparte: cada persona tiene su cuenta). */
export async function iniciarSesionDemo(page: Page) {
  for (const base of [TAL, PUE]) await iniciarSesionEn(page, base);
}

/** Títulos de las vacantes de Andina publicadas para el puente en la siembra transitoria (D-25). */
export const TITULOS: Record<string, string> = {
  "RT-2026-101": "Desarrollador/a Backend Java",
  "RT-2026-102": "Analista de Calidad de Software (QA)",
  "RT-2026-103": "Diseñador/a UX (sin correspondencia)",
};

/** Abre una vacante de Andina por su título (o por el código de las vacantes transitorias). */
export async function abrirVacante(page: Page, codigoOTitulo: string) {
  const titulo = TITULOS[codigoOTitulo] ?? codigoOTitulo;
  await page.goto(`${VIN}/empleos?${new URLSearchParams({ q: titulo, empresa: "andina-software" })}`);
  await page.getByTestId("tarjeta-vacante").getByRole("link", { name: titulo, exact: true }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(titulo);
}

/** Crea una cuenta de candidato nueva (con datos ficticios) y deja la sesión abierta. */
export async function registrarCandidato(page: Page, nombre: string, apellido: string, correo: string) {
  await salirDeVinculo(page);
  await page.goto(`${VIN}/registro`);
  await page.getByLabel("Nombre y apellido").fill(`${nombre} ${apellido}`);
  await page.getByLabel("Correo").fill(correo);
  await page.getByLabel("Contraseña").fill("ClaveDePrueba123");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/mi-perfil/);
}

/** Una persona nueva se registra y envía una «Solicitud sencilla» con un CV en PDF. */
export async function postular(
  page: Page,
  opciones: { codigo?: string; nombre?: string; apellido: string; correo: string; cv?: string; telefono?: string; ciudad?: string },
) {
  const nombre = opciones.nombre ?? "Camila";
  await registrarCandidato(page, nombre, opciones.apellido, opciones.correo);
  await abrirVacante(page, opciones.codigo ?? "RT-2026-101");
  await page.getByRole("link", { name: "Solicitud sencilla" }).click();
  await page.getByLabel("Nombre", { exact: true }).fill(nombre);
  await page.getByLabel("Apellido").fill(opciones.apellido);
  if (opciones.telefono) await page.getByLabel(/^Teléfono/).fill(opciones.telefono);
  await page.getByLabel("Ciudad").fill(opciones.ciudad ?? "Medellín");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Hoja de vida (PDF)").setInputFiles(opciones.cv ?? CV);
  await page.getByRole("button", { name: "Enviar solicitud" }).click();
}

/** Referencia (jobApplicationId) de la confirmación de la solicitud. */
export async function referencia(page: Page) {
  const ref = page.getByTestId("job-application-id");
  await expect(ref).toBeVisible();
  return (await ref.textContent())!.trim();
}

/** Sufijo único solo con letras (los nombres solo admiten letras): dígitos del timestamp → a–j. */
export const sufijoUnico = () =>
  String(Date.now() + Math.floor(Math.random() * 1000))
    .split("")
    .map((d) => "abcdefghij"[Number(d)])
    .join("");

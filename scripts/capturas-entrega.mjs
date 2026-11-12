#!/usr/bin/env node
// Capturas para los manuales de la entrega (docs/manuales/img/entrega-*.png), tomadas con Playwright contra
// `npm run dev` (Puente :3003 y Simulador BUK :3002). Solo datos ficticios (@demo.test). Sin la franja «Modo prueba
// activo» (el .env de desarrollo tiene PUENTE_MODO_PRUEBAS=0; el script se detiene si la ve).
// Requisitos: `npm run dev`, Puente conectado con el Simulador BUK y un enlace público del proceso 9003 (lo crea
// `node scripts/medir-criterios.mjs`, o Panel → Formulario público → «Crear enlace»).
// Uso: node scripts/capturas-entrega.mjs

import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(RAIZ, "docs", "manuales", "img");
const PUE = "http://localhost:3003";
const TAL = "http://localhost:3002";
const PROCESO = "9003";
const CLAVE = "Demo2026!";
mkdirSync(DIR, { recursive: true });

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function foto(page, nombre, { completa = true } = {}) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  if (await page.getByText("Modo prueba activo").count()) throw new Error("La franja «Modo prueba activo» está visible: usa el .env de desarrollo.");
  await page.screenshot({ path: path.join(DIR, `entrega-${nombre}.png`), fullPage: completa });
  console.log(`  entrega-${nombre}.png`);
}

async function ingresar(page, base, correo) {
  await page.goto(`${base}/ingresar`);
  await page.getByLabel("Correo").fill(correo);
  await page.getByLabel("Contraseña").fill(CLAVE);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/ingresar"));
}

const navegador = await chromium.launch({ args: ["--lang=es-CO"] });
const opciones = { viewport: { width: 1280, height: 800 }, locale: "es-CO", timezoneId: "America/Bogota" };
// El indicador de desarrollo de Next («N», «Compiling…») no es parte de la interfaz: se oculta en las capturas.
async function nuevaPagina(opc) {
  const ctx = await navegador.newContext(opc);
  await ctx.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const e = document.createElement("style");
      e.textContent = "nextjs-portal{display:none!important}";
      document.head.appendChild(e);
    });
  });
  return ctx.newPage();
}
try {
  // 1. Panel del Puente: Formulario público (enlace con «Copiar»).
  const admin = await nuevaPagina(opciones);
  await ingresar(admin, PUE, "admin@puente.demo.test");
  await admin.goto(`${PUE}/formulario`);
  const fila = admin.locator(`[data-testid="fila-formulario"][data-proceso="${PROCESO}"]`);
  if (!(await fila.getByTestId("enlace-publico").count())) {
    await fila.getByRole("button", { name: new RegExp(`enlace público del proceso ${PROCESO}`) }).click();
    await admin.locator(".alerta-exito").waitFor();
  }
  const enlace = await fila.getByTestId("enlace-publico").inputValue();
  await foto(admin, "01-panel-formulario-publico");

  // 2. Formulario público (sin sesión, en móvil y escritorio), confirmación y aviso de privacidad.
  const cand = await nuevaPagina({ ...opciones, extraHTTPHeaders: { "x-forwarded-for": "198.51.100.250" } });
  await cand.goto(enlace);
  await foto(cand, "02-formulario-vacio");
  const sufijo = Date.now();
  await cand.getByLabel("Nombres").fill("Daniela");
  await cand.getByLabel("Apellidos").fill("Captura Ficticia");
  await cand.getByLabel("Correo").fill(`captura.${sufijo}@demo.test`);
  await cand.getByLabel("Indicativo del país").selectOption("+57");
  await cand.getByLabel("Teléfono").fill("300 555 0142");
  await cand.getByLabel("Ciudad de residencia").fill("Itagüí");
  await cand.getByLabel("Perfil de LinkedIn (opcional)").fill("https://www.linkedin.com/in/daniela-ficticia");
  await cand.getByLabel("Hoja de vida en PDF").setInputFiles(path.join(RAIZ, "fixtures", "cv", "cv-sofia-demo.pdf"));
  await cand.getByLabel(/Autorizo el tratamiento de mis datos/).check();
  await foto(cand, "03-formulario-lleno");
  await esperar(3500);
  await cand.getByRole("button", { name: "Enviar postulación" }).click();
  await cand.waitForURL(/\/enviado/);
  await foto(cand, "04-confirmacion");
  await cand.goto(`${PUE}/privacidad`);
  await foto(cand, "05-aviso-privacidad");
  const movil = await nuevaPagina({ viewport: { width: 390, height: 844 }, isMobile: true, locale: "es-CO", extraHTTPHeaders: { "x-forwarded-for": "198.51.100.251" } });
  await movil.goto(enlace);
  await foto(movil, "06-formulario-movil", { completa: false });

  // 3. Operaciones del Puente (la postulación recién enviada pasa a Completado).
  await esperar(6000);
  await admin.goto(`${PUE}/operaciones`);
  await foto(admin, "07-operaciones", { completa: false });
  // La primera fila es la postulación recién enviada: su referencia abre el detalle.
  await admin.locator("table tbody tr").first().getByRole("link").first().click();
  await admin.waitForURL(/\/operaciones\/[0-9a-f-]{36}/);
  await foto(admin, "08-operacion-detalle");

  // 4. Otras pantallas del Puente: Fuentes, Correspondencias, Importar.
  for (const [ruta, nombre] of [
    ["/fuentes", "09-fuentes"],
    ["/correspondencias", "10-correspondencias"],
    ["/importar", "11-importar"],
    ["/conexiones", "12-conexiones"],
    ["/metricas", "13-metricas"],
  ]) {
    await admin.goto(`${PUE}${ruta}`);
    await foto(admin, nombre);
  }

  // 5. Simulador BUK: Postulantes del proceso y documentación de la API.
  const tal = await nuevaPagina(opciones);
  await ingresar(tal, TAL, "reclutador@andina.demo.test");
  await tal.goto(`${TAL}/seleccion/procesos/${PROCESO}`);
  await foto(tal, "14-buk-postulantes", { completa: false });
  await tal.getByRole("link", { name: /Daniela Captura Ficticia/ }).first().click();
  await tal.waitForURL((u) => !u.pathname.endsWith(`/procesos/${PROCESO}`));
  await foto(tal, "15-buk-ficha-postulante", { completa: false });
  await tal.goto(`${TAL}/apidocs`);
  await tal.locator(".swagger-ui .opblock").first().waitFor({ timeout: 30000 });
  await foto(tal, "16-buk-apidocs", { completa: false });
} finally {
  await navegador.close();
}
console.log(`Capturas en ${path.relative(RAIZ, DIR)}`);

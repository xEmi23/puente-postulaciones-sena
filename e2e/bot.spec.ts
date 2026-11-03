import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { chromium, expect, test, type Page } from "@playwright/test";
import { envApp, PUE, TAL, VIN } from "./procesos";
import { iniciarSesionTalentia, iniciarSesionVinculo } from "./utilidades";
import { prepararDemoBot } from "../scripts/demo-bot-lib.mjs";

// V4 F4-V: el bot asistido (perfil de sitio «vinculo») de punta a punta con las tres apps reales:
// Vínculo (panel del reclutador) → bot → entrada genérica del Puente → Talentia (Postulantes, mismo SHA-256).
// BV-3 recorrido completo · BV-4 segunda corrida = DUPLICADA · BV-5 --seco no envía.
test.describe.configure({ mode: "serial" });

const RAIZ = path.resolve(__dirname, "..");
const PROCESO = "9005";
const PERSONAS = ["Mariana Quintero Ficticia", "Julián Restrepo Ficticio", "Sofía Cardona Ficticia"];
const DIR_PERFIL = path.join(RAIZ, "test-results", "bot-perfil-e2e");
let token = "";
let vacante = "";

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

interface Resumen {
  vistas: number;
  enviadas: number;
  recibidas: number;
  duplicadas: number;
  revision: number;
  errores: number;
  seco: boolean;
}

/** Ejecuta el bot como lo haría una persona (`npm run bot`), sin ventana y con pausas cortas. */
function correrBot(...args: string[]): { codigo: number | null; salida: string; resumen: Resumen } {
  const r = spawnSync(process.execPath, ["--import", "tsx", "src/cli.ts", ...args], {
    cwd: path.join(RAIZ, "apps", "bot-linkedin"),
    encoding: "utf8",
    timeout: 180_000,
    env: {
      ...process.env,
      BOT_SITIO: "vinculo",
      BOT_URL_SITIO: VIN,
      PUENTE_URL: PUE,
      PUENTE_BOT_TOKEN: token,
      BOT_HEADLESS: "true",
      BOT_PERFIL_DIR: DIR_PERFIL,
      BOT_PAUSA_MIN_MS: "100",
      BOT_PAUSA_MAX_MS: "200",
      BOT_HORARIO: "00-24",
    },
  });
  const salida = `${r.stdout}\n${r.stderr}`;
  const linea = salida.split(/\r?\n/).find((l) => l.startsWith("RESUMEN "));
  if (!linea) throw new Error(`El bot no terminó (código ${r.status}):\n${salida}`);
  return { codigo: r.status, salida, resumen: JSON.parse(linea.slice(8)) };
}

async function tarjetas(page: Page) {
  await page.goto(`${TAL}/seleccion/procesos/${PROCESO}`);
  return page.locator('[data-etapa="Postulantes"]').getByTestId("tarjeta-postulante");
}

test.beforeAll(async () => {
  // Como `npm run demo:bot`, pero contra las bases E2E.
  const r = prepararDemoBot({ raiz: RAIZ, entorno: (app: string) => envApp(app as "vinculo" | "talentia" | "puente"), proceso: Number(PROCESO), reiniciar: true, urlTalentia: TAL });
  token = r.token;
  vacante = r.vacante;
  // La persona inicia sesión UNA vez en el perfil del navegador del bot (aquí lo hace la prueba sobre Vínculo, simulado).
  rmSync(DIR_PERFIL, { recursive: true, force: true });
  mkdirSync(DIR_PERFIL, { recursive: true });
  const ctx = await chromium.launchPersistentContext(DIR_PERFIL, { headless: true });
  const p = ctx.pages()[0] ?? (await ctx.newPage());
  await p.goto(`${VIN}/ingresar?siguiente=%2Freclutador`);
  await p.getByLabel("Correo").fill("reclutadora@andina.demo.test");
  await p.getByLabel("Contraseña").fill("Demo2026!");
  await p.getByRole("button", { name: "Ingresar" }).click();
  await p.waitForURL(/\/reclutador/);
  await ctx.close();
});

test("el panel del reclutador de Vínculo muestra la vacante, sus 3 postulantes y la ficha con contacto y CV", async ({ page }) => {
  await iniciarSesionVinculo(page, "reclutadora");
  await page.goto(`${VIN}/reclutador`);
  await page.locator(`[data-testid="fila-vacante"][data-external-job-id="${vacante}"]`).getByRole("link").first().click();
  await expect(page.getByTestId("fila-postulante")).toHaveCount(3);
  await page.getByTestId("enlace-ficha").first().click();
  const ficha = page.getByTestId("ficha-postulante");
  await expect(ficha).toHaveAttribute("data-vacante", vacante);
  await expect(ficha.locator('[data-campo="correo"]')).toContainText("@demo.test");
  await expect(ficha.getByTestId("descargar-cv-ficha")).toBeVisible();
  await expect(ficha).toContainText("Vista por la empresa");
});

test("BV-3 · el bot recorre la vacante en Vínculo, envía al Puente y los postulantes llegan a Talentia con el mismo SHA-256", async ({ page }) => {
  test.setTimeout(240_000);
  const r = correrBot();
  expect(r.codigo).toBe(0);
  expect(r.resumen).toMatchObject({ vistas: 3, enviadas: 3, recibidas: 3, duplicadas: 0, errores: 0, seco: false });

  await iniciarSesionTalentia(page, "reclutador");
  await expect(async () => {
    const t = await tarjetas(page);
    for (const nombre of PERSONAS) await expect(t.filter({ hasText: nombre }).first()).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 90_000 });
  await expect((await tarjetas(page)).filter({ hasText: "Bot experimental (LinkedIn)" })).toHaveCount(0); // fuente propia, no LinkedIn

  // El CV que guardó Talentia es byte a byte el de Vínculo.
  await (await tarjetas(page)).filter({ hasText: PERSONAS[0] }).getByRole("link").first().click();
  const [enTalentia] = await Promise.all([page.waitForEvent("download"), page.getByTestId("descargar-cv").first().click()]);
  const bytesTalentia = readFileSync((await enTalentia.path())!);

  await iniciarSesionVinculo(page, "reclutadora");
  await page.goto(`${VIN}/reclutador`);
  await page.locator(`[data-testid="fila-vacante"][data-external-job-id="${vacante}"]`).getByRole("link").first().click();
  const fila = page.getByTestId("fila-postulante").filter({ hasText: PERSONAS[0] });
  const [enVinculo] = await Promise.all([page.waitForEvent("download"), fila.getByTestId("descargar-cv-manual").click()]);
  expect(sha(bytesTalentia)).toBe(sha(readFileSync((await enVinculo.path())!)));
});

test("BV-4 · una segunda corrida no crea nada: las 3 son DUPLICADA", async ({ page }) => {
  test.setTimeout(240_000);
  const r = correrBot();
  expect(r.resumen).toMatchObject({ vistas: 3, enviadas: 3, recibidas: 0, duplicadas: 3, errores: 0 });
  await iniciarSesionTalentia(page, "reclutador");
  const t = await tarjetas(page);
  for (const nombre of PERSONAS) await expect(t.filter({ hasText: nombre })).toHaveCount(1);
});

test("BV-5 · --seco recorre y no envía nada", async () => {
  test.setTimeout(240_000);
  const r = correrBot("--seco", "--vacante", vacante);
  expect(r.resumen).toMatchObject({ vistas: 3, enviadas: 0, recibidas: 0, duplicadas: 0, seco: true });
  expect(r.salida).toContain("[seco]");
});

test("BV-6 · BOT_SITIO=linkedin se niega a correr", async () => {
  const r = spawnSync(process.execPath, ["--import", "tsx", "src/cli.ts"], {
    cwd: path.join(RAIZ, "apps", "bot-linkedin"),
    encoding: "utf8",
    env: { ...process.env, BOT_SITIO: "linkedin", PUENTE_BOT_TOKEN: token },
  });
  expect(r.status).toBe(1);
  expect(r.stderr).toContain("perfil LinkedIn pendiente de la Puerta 0");
});

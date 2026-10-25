import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, openSync } from "node:fs";
import path from "node:path";
import { config as cargarEnv } from "dotenv";

// Arranque y parada de la app (next start) y del worker para las pruebas E2E, a través de e2e/supervisor.mjs.

export const PUERTO = 3200;
export const BASE = `http://localhost:${PUERTO}`;
const PUERTO_CONTROL = 3299;
const CONTROL = `http://127.0.0.1:${PUERTO_CONTROL}`;

export function entornoE2E(): NodeJS.ProcessEnv {
  const leido = cargarEnv({ quiet: true, processEnv: {} }).parsed ?? {};
  if (!leido.DATABASE_URL_E2E) throw new Error("Falta DATABASE_URL_E2E en .env");
  return {
    ...process.env,
    ...leido,
    DATABASE_URL: leido.DATABASE_URL_E2E,
    APP_BASE_URL: BASE,
    ORIGEN_BASE_URL: BASE,
    PUENTE_WEBHOOK_URL: `${BASE}/api/puente/webhook`,
    ATS_BASE_URL: `${BASE}/api/ats/v1`,
    SIMULADOR_MODO_PRUEBA: "true",
    DEMO_AUTH_ENABLED: "true",
    DEMO_ADMIN_USER: "demo-e2e",
    DEMO_ADMIN_PASSWORD: "clave-e2e-solo-local",
    WORKER_INTERVALO_MS: "300",
    PUENTE_MAX_INTENTOS: "3",
    PUENTE_BACKOFF_BASE_MS: "300",
    PUENTE_LEASE_S: "12",
    SIMULADOR_DEMORA_LENTO_MS: "8000",
    E2E_PUERTO_CONTROL: String(PUERTO_CONTROL),
    E2E_PUERTO_APP: String(PUERTO),
  };
}

async function control(accion: string, intentos = 1) {
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await fetch(`${CONTROL}${accion}`, { method: "POST" });
      if (r.ok) return;
      throw new Error(`El supervisor respondió ${r.status} a ${accion}`);
    } catch (e) {
      if (i === intentos - 1) throw e;
      await new Promise((ok) => setTimeout(ok, 300));
    }
  }
}

export async function iniciarSupervisor() {
  await control("/todo/stop").catch(() => undefined); // restos de una ejecución anterior
  await new Promise((ok) => setTimeout(ok, 300));
  mkdirSync("test-results", { recursive: true });
  const log = openSync(path.resolve("test-results", "supervisor.log"), "a");
  const s = spawn(process.execPath, [path.resolve("e2e/supervisor.mjs")], { env: entornoE2E(), stdio: ["ignore", log, log], detached: true, windowsHide: true });
  s.unref();
}

export const iniciarApp = () => control("/app/start", 20);
export const iniciarWorker = () => control("/worker/start", 20);
/** Mata el proceso sin darle tiempo a terminar (simula una caída). */
export const matarApp = () => control("/app/stop");
export const matarWorker = () => control("/worker/stop");
export const detenerTodo = () => control("/todo/stop").catch(() => undefined);

export function prepararBase() {
  const opciones = { env: entornoE2E(), stdio: "pipe" as const, shell: true };
  let r = spawnSync("npx", ["prisma", "migrate", "deploy"], opciones);
  if (r.status !== 0) throw new Error(`migrate deploy falló: ${r.stderr}`);
  r = spawnSync("npx", ["tsx", "scripts/demo-reset.ts"], opciones);
  if (r.status !== 0) throw new Error(`demo-reset falló: ${r.stderr}${r.stdout}`);
}

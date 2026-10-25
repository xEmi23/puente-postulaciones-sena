import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync, openSync } from "node:fs";
import path from "node:path";
import { config as cargarEnv } from "dotenv";

// Arranque y parada de la app (next start) y del worker para las pruebas E2E.

export const PUERTO = 3200;
export const BASE = `http://localhost:${PUERTO}`;
const ESTADO = path.resolve("test-results", ".procesos-e2e.json");

export function entornoE2E(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  const leido = cargarEnv({ quiet: true, processEnv: {} }).parsed ?? {};
  Object.assign(env, leido);
  if (!leido.DATABASE_URL_E2E) throw new Error("Falta DATABASE_URL_E2E en .env");
  return {
    ...env,
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
  };
}

type Pids = { app?: number; worker?: number };
const leerPids = (): Pids => (existsSync(ESTADO) ? JSON.parse(readFileSync(ESTADO, "utf8")) : {});
const guardarPids = (p: Pids) => {
  mkdirSync(path.dirname(ESTADO), { recursive: true });
  writeFileSync(ESTADO, JSON.stringify(p));
};

function matarArbol(pid: number | undefined) {
  if (!pid) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
  else {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      /* ya terminó */
    }
  }
}

function lanzar(nombre: string, args: string[]): ChildProcess {
  mkdirSync("test-results", { recursive: true });
  const log = openSync(path.resolve("test-results", `${nombre}.log`), "a");
  const hijo = spawn(process.execPath, args, { env: entornoE2E(), stdio: ["ignore", log, log], detached: process.platform !== "win32", windowsHide: true });
  hijo.unref();
  return hijo;
}

export async function esperarUrl(url: string, ms = 60_000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return;
    } catch {
      /* aún no responde */
    }
    await new Promise((ok) => setTimeout(ok, 300));
  }
  throw new Error(`No respondió a tiempo: ${url}`);
}

export async function iniciarApp() {
  const app = lanzar("app", [path.resolve("node_modules/next/dist/bin/next"), "start", "-p", String(PUERTO)]);
  guardarPids({ ...leerPids(), app: app.pid });
  await esperarUrl(`${BASE}/origen`);
}

export function iniciarWorker() {
  const w = lanzar("worker", ["--import", "tsx", path.resolve("worker/index.ts")]);
  guardarPids({ ...leerPids(), worker: w.pid });
}

/** Mata el proceso sin darle tiempo a terminar (simula una caída). */
export function matarApp() {
  matarArbol(leerPids().app);
  guardarPids({ ...leerPids(), app: undefined });
}
export function matarWorker() {
  matarArbol(leerPids().worker);
  guardarPids({ ...leerPids(), worker: undefined });
}

export function matarTodo() {
  matarApp();
  matarWorker();
  rmSync(ESTADO, { force: true });
}

export function prepararBase() {
  const env = entornoE2E();
  const opciones = { env, stdio: "pipe" as const, shell: true };
  let r = spawnSync("npx", ["prisma", "migrate", "deploy"], opciones);
  if (r.status !== 0) throw new Error(`migrate deploy falló: ${r.stderr}`);
  r = spawnSync("npx", ["tsx", "scripts/demo-reset.ts"], opciones);
  if (r.status !== 0) throw new Error(`demo-reset falló: ${r.stderr}${r.stdout}`);
}

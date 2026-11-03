import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, openSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "dotenv";

// Arranque y parada de los tres sistemas (next start) y de sus workers para las pruebas E2E, a través de e2e/supervisor.mjs.
// Cada sistema usa su .env con la base tb2_e2e y puertos propios (no chocan con `npm run dev` ni con la v1).

const RAIZ = path.resolve(__dirname, "..");
export const PUERTOS = { vinculo: 3211, talentia: 3212, puente: 3213 } as const;
export const VIN = `http://localhost:${PUERTOS.vinculo}`;
export const TAL = `http://localhost:${PUERTOS.talentia}`;
export const PUE = `http://localhost:${PUERTOS.puente}`;
const PUERTO_CONTROL = 3219;
const CONTROL = `http://127.0.0.1:${PUERTO_CONTROL}`;

type App = keyof typeof PUERTOS;

export function envApp(app: App): NodeJS.ProcessEnv {
  const leido = parse(readFileSync(path.join(RAIZ, "apps", app, ".env")));
  if (!leido.DATABASE_URL_E2E) throw new Error(`Falta DATABASE_URL_E2E en apps/${app}/.env`);
  const comunes = {
    DATABASE_URL: leido.DATABASE_URL_E2E,
    APP_BASE_URL: `http://localhost:${PUERTOS[app]}`,
    WORKER_EN_PROCESO: "0",
    WORKER_INTERVALO_MS: "300",
  };
  const propios: Record<App, Record<string, string>> = {
    // Las pruebas E2E ejercitan la API tipo Apply Connect de Vínculo: se prende explícitamente (D-68).
    vinculo: { VINCULO_API_HABILITADA: "true" },
    talentia: {},
    puente: {
      PUENTE_MODO_PRUEBAS: "1",
      PUENTE_MAX_INTENTOS: "3",
      PUENTE_BACKOFF_BASE_MS: "300",
      PUENTE_LEASE_S: "12",
      PUENTE_DEMORA_LENTO_MS: "8000",
    },
  };
  return { ...process.env, ...leido, ...comunes, ...propios[app] };
}

function definiciones() {
  const next = path.join(RAIZ, "node_modules/next/dist/bin/next");
  const def: Record<string, { cwd: string; args: string[]; env: NodeJS.ProcessEnv; salud?: string }> = {};
  for (const app of Object.keys(PUERTOS) as App[]) {
    def[app] = { cwd: `apps/${app}`, args: [next, "start", "-p", String(PUERTOS[app])], env: envApp(app), salud: `http://localhost:${PUERTOS[app]}/ingresar` };
  }
  for (const app of ["vinculo", "puente"] as const) {
    def[`worker-${app}`] = { cwd: `apps/${app}`, args: ["--import", "tsx", "worker/index.ts"], env: envApp(app) };
  }
  return def;
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
  mkdirSync(path.join(RAIZ, "test-results"), { recursive: true });
  const log = openSync(path.join(RAIZ, "test-results", "supervisor.log"), "a");
  const s = spawn(process.execPath, [path.join(RAIZ, "e2e/supervisor.mjs")], {
    env: { ...process.env, E2E_PUERTO_CONTROL: String(PUERTO_CONTROL), E2E_PROCESOS: JSON.stringify(definiciones()) },
    stdio: ["ignore", log, log],
    detached: true,
    windowsHide: true,
  });
  s.unref();
}

/** Arranca (o reinicia) las tres apps. */
export const iniciarApp = async () => {
  for (const app of Object.keys(PUERTOS)) await control(`/${app}/start`, 20);
};
/** Arranca (o reinicia) el despachador de Vínculo y el procesador del puente. */
export const iniciarWorker = async () => {
  await control("/worker-vinculo/start", 20);
  await control("/worker-puente/start", 20);
};
/** Mata los procesos sin darles tiempo a terminar (simula una caída). */
export const matarApp = async () => {
  for (const app of Object.keys(PUERTOS)) await control(`/${app}/stop`);
};
export const matarWorker = async () => {
  await control("/worker-vinculo/stop");
  await control("/worker-puente/stop");
};
export const matarSistema = (app: App) => control(`/${app}/stop`);
export const iniciarSistema = (app: App) => control(`/${app}/start`, 20);
export const detenerTodo = () => control("/todo/stop").catch(() => undefined);

export function prepararBase() {
  for (const app of Object.keys(PUERTOS) as App[]) {
    const opciones = { cwd: path.join(RAIZ, "apps", app), env: envApp(app), stdio: "pipe" as const, shell: true };
    let r = spawnSync("npx prisma migrate deploy", opciones);
    if (r.status !== 0) throw new Error(`${app}: migrate deploy falló: ${r.stderr}`);
    r = spawnSync("npx tsx scripts/demo-reset.ts", opciones);
    if (r.status !== 0) throw new Error(`${app}: demo-reset falló: ${r.stderr}${r.stdout}`);
  }
}

/**
 * Conecta los tres sistemas como lo haría el equipo con `npm run demo:conectar` (cada app ejecuta su parte con su
 * propio .env): API Key de Talentia, aplicación autorizada en Vínculo, conexiones del puente y publicación de 9001/9002.
 */
export async function conectarSistemas() {
  const { conectar } = await import("../scripts/conectar-lib.mjs");
  conectar({ raiz: RAIZ, entorno: (app: string) => envApp(app as App), urls: { vinculo: VIN, talentia: TAL, puente: PUE }, publicar: [9001, 9002], registro: () => undefined });
}

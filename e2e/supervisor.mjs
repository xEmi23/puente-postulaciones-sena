// Supervisor de procesos para las pruebas E2E. Lo arranca globalSetup y vive toda la ejecución,
// así la app (next start) y el worker no dependen del proceso de Playwright que pidió reiniciarlos.
// Control por HTTP en 127.0.0.1:PUERTO_CONTROL: POST /app/start|stop, /worker/start|stop, /todo/stop.
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { openSync, mkdirSync } from "node:fs";
import path from "node:path";

const PUERTO_CONTROL = Number(process.env.E2E_PUERTO_CONTROL ?? 3299);
const PUERTO_APP = Number(process.env.E2E_PUERTO_APP ?? 3200);
const procesos = { app: null, worker: null };

function matar(nombre) {
  const p = procesos[nombre];
  if (!p) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(p.pid), "/T", "/F"], { stdio: "ignore" });
  else {
    try {
      process.kill(-p.pid, "SIGKILL");
    } catch {
      /* ya terminó */
    }
  }
  procesos[nombre] = null;
}

function lanzar(nombre, args) {
  mkdirSync("test-results", { recursive: true });
  const log = openSync(path.resolve("test-results", `${nombre}.log`), "a");
  procesos[nombre] = spawn(process.execPath, args, {
    env: process.env,
    stdio: ["ignore", log, log],
    detached: process.platform !== "win32",
    windowsHide: true,
  });
  procesos[nombre].on("exit", () => {
    if (procesos[nombre]?.exitCode !== null) procesos[nombre] = null;
  });
}

async function esperarApp(ms = 60_000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    try {
      const r = await fetch(`http://localhost:${PUERTO_APP}/origen`);
      if (r.status < 500) return true;
    } catch {
      /* aún no responde */
    }
    await new Promise((ok) => setTimeout(ok, 300));
  }
  return false;
}

const acciones = {
  "/app/start": async () => {
    matar("app");
    lanzar("app", [path.resolve("node_modules/next/dist/bin/next"), "start", "-p", String(PUERTO_APP)]);
    return esperarApp();
  },
  "/app/stop": async () => (matar("app"), true),
  "/worker/start": async () => (matar("worker"), lanzar("worker", ["--import", "tsx", path.resolve("worker/index.ts")]), true),
  "/worker/stop": async () => (matar("worker"), true),
  "/todo/stop": async () => {
    matar("app");
    matar("worker");
    setTimeout(() => process.exit(0), 100);
    return true;
  },
};

createServer(async (req, res) => {
  const accion = req.method === "POST" ? acciones[req.url ?? ""] : undefined;
  if (!accion) {
    res.writeHead(404).end();
    return;
  }
  const ok = await accion();
  res.writeHead(ok ? 200 : 500, { "Content-Type": "application/json" }).end(JSON.stringify({ ok }));
}).listen(PUERTO_CONTROL, "127.0.0.1", () => console.log(`[supervisor] escuchando en ${PUERTO_CONTROL}`));

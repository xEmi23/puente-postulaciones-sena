// Supervisor de procesos para las pruebas E2E. Lo arranca globalSetup y vive toda la ejecución,
// así las apps (next start) y los workers no dependen del proceso de Playwright que pidió reiniciarlos.
// Control por HTTP en 127.0.0.1:E2E_PUERTO_CONTROL: POST /<proceso>/start|stop y /todo/stop.
// Procesos: vinculo, talentia, puente (apps) y worker-vinculo, worker-puente.
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { openSync, mkdirSync } from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(import.meta.dirname, "..");
const PUERTO_CONTROL = Number(process.env.E2E_PUERTO_CONTROL ?? 3219);
/** { nombre: { cwd, args, env, salud? } } preparado por e2e/procesos.ts */
const DEFINICIONES = JSON.parse(process.env.E2E_PROCESOS ?? "{}");
const vivos = {};

function matar(nombre) {
  const p = vivos[nombre];
  if (!p) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(p.pid), "/T", "/F"], { stdio: "ignore" });
  else {
    try {
      process.kill(-p.pid, "SIGKILL");
    } catch {
      /* ya terminó */
    }
  }
  vivos[nombre] = null;
}

function lanzar(nombre) {
  const d = DEFINICIONES[nombre];
  mkdirSync(path.join(RAIZ, "test-results"), { recursive: true });
  const log = openSync(path.join(RAIZ, "test-results", `${nombre}.log`), "a");
  const hijo = spawn(process.execPath, d.args, {
    cwd: path.join(RAIZ, d.cwd),
    env: d.env,
    stdio: ["ignore", log, log],
    detached: process.platform !== "win32",
    windowsHide: true,
  });
  vivos[nombre] = hijo;
  hijo.on("exit", () => {
    if (vivos[nombre] === hijo) vivos[nombre] = null;
  });
}

async function esperar(url, ms = 90_000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    try {
      const r = await fetch(url, { redirect: "manual" });
      if (r.status < 500) return true;
    } catch {
      /* aún no responde */
    }
    await new Promise((ok) => setTimeout(ok, 300));
  }
  return false;
}

async function accion(ruta) {
  if (ruta === "/todo/stop") {
    for (const n of Object.keys(vivos)) matar(n);
    setTimeout(() => process.exit(0), 100);
    return true;
  }
  const m = ruta.match(/^\/([a-z-]+)\/(start|stop)$/);
  if (!m || !DEFINICIONES[m[1]]) return false;
  const [, nombre, verbo] = m;
  matar(nombre);
  if (verbo === "stop") return true;
  lanzar(nombre);
  return DEFINICIONES[nombre].salud ? esperar(DEFINICIONES[nombre].salud) : true;
}

createServer(async (req, res) => {
  const ok = req.method === "POST" ? await accion(req.url ?? "") : false;
  res.writeHead(ok ? 200 : 500, { "Content-Type": "application/json" }).end(JSON.stringify({ ok }));
}).listen(PUERTO_CONTROL, "127.0.0.1", () => console.log(`[supervisor] escuchando en ${PUERTO_CONTROL}`));

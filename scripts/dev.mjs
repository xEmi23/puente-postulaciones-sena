// Arranca las tres apps a la vez (cada una en su puerto, con su worker dentro del proceso si WORKER_EN_PROCESO=1).
// Uso: node scripts/dev.mjs dev|start
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";

const RAIZ = path.resolve(import.meta.dirname, "..");
const modo = process.argv[2] === "start" ? "start" : "dev";
const APPS = [
  { nombre: "vinculo", color: 36, puerto: 3001 },
  { nombre: "talentia", color: 35, puerto: 3002 },
  { nombre: "puente", color: 33, puerto: 3003 },
];

// PostgreSQL local primero (no hace nada si ya corre).
const pg = spawnSync(process.execPath, [path.join(RAIZ, "scripts/pg-local.mjs"), "start"], { stdio: "inherit" });
if (pg.status !== 0) process.exit(pg.status ?? 1);

const hijos = APPS.map(({ nombre, color }) => {
  const prefijo = `\x1b[${color}m[${nombre}]\x1b[0m `;
  const hijo = spawn("npm", ["run", modo, "-w", `apps/${nombre}`], { cwd: RAIZ, shell: true, env: process.env });
  const reenviar = (flujo, destino) => {
    let resto = "";
    flujo.on("data", (d) => {
      const lineas = (resto + d.toString()).split(/\r?\n/);
      resto = lineas.pop() ?? "";
      for (const l of lineas) destino.write(prefijo + l + "\n");
    });
  };
  reenviar(hijo.stdout, process.stdout);
  reenviar(hijo.stderr, process.stderr);
  hijo.on("exit", (c) => console.log(`${prefijo}terminó (código ${c})`));
  return hijo;
});

console.log(APPS.map((a) => `${a.nombre}: http://localhost:${a.puerto}`).join(" · "));

const terminar = () => {
  for (const h of hijos) {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(h.pid), "/T", "/F"], { stdio: "ignore" });
    else h.kill("SIGTERM");
  }
  process.exit(0);
};
process.on("SIGINT", terminar);
process.on("SIGTERM", terminar);

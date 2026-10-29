// Clúster PostgreSQL propio del proyecto (.pgdata, puerto 5435 por defecto), alternativa a Docker.
// La v1 usa su propio clúster en el 5433: este script nunca lo toca.
// Uso: node scripts/pg-local.mjs init|start|stop|status
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { config as cargarEnv } from "dotenv";

const RAIZ = path.resolve(import.meta.dirname, "..");
cargarEnv({ path: path.join(RAIZ, ".env"), quiet: true });

const DATA = path.join(RAIZ, ".pgdata");
const LOG = path.join(RAIZ, ".pglog", "postgres.log");
const PORT = process.env.PG_PORT || "5435";
const BASES = ["tb2_dev", "tb2_test", "tb2_e2e"];

function binDir() {
  if (process.env.PG_BIN) return process.env.PG_BIN;
  const candidatos = [
    "C:/Program Files/PostgreSQL/17/bin",
    "C:/Program Files/PostgreSQL/16/bin",
    "/usr/lib/postgresql/17/bin",
    "/usr/lib/postgresql/16/bin",
    "/opt/homebrew/bin",
    "/usr/local/bin",
  ];
  return candidatos.find((d) => existsSync(path.join(d, process.platform === "win32" ? "pg_ctl.exe" : "pg_ctl"))) ?? "";
}
const bin = (n) => (binDir() ? path.join(binDir(), n) : n);

function credenciales() {
  const user = process.env.PG_USER;
  const password = process.env.PG_PASSWORD;
  if (!user || !password) throw new Error("Faltan PG_USER y PG_PASSWORD en .env (ejecuta npm run setup).");
  return { user, password };
}

function estaCorriendo() {
  if (!existsSync(DATA)) return false;
  const r = spawnSync(bin("pg_ctl"), ["status", "-D", DATA], { encoding: "utf8" });
  return r.status === 0;
}

function start() {
  if (estaCorriendo()) return console.log(`PostgreSQL local ya está corriendo en ${PORT}.`);
  if (!existsSync(path.join(DATA, "PG_VERSION"))) throw new Error("No hay clúster en .pgdata: ejecuta npm run setup.");
  mkdirSync(path.dirname(LOG), { recursive: true });
  // En Windows, postgres hereda los descriptores de pg_ctl; con stdio "ignore" y detached el script no queda colgado.
  const hijo = spawn(bin("pg_ctl"), ["start", "-D", DATA, "-l", LOG, "-o", `-p ${PORT} -c listen_addresses=localhost`], {
    stdio: "ignore",
    detached: true,
    windowsHide: true,
  });
  hijo.unref();
  for (let i = 0; i < 60; i++) {
    const r = spawnSync(bin("pg_isready"), ["-h", "localhost", "-p", PORT], { encoding: "utf8" });
    if (r.status === 0) return console.log(`PostgreSQL local listo en localhost:${PORT}.`);
    spawnSync(process.execPath, ["-e", "setTimeout(()=>{},500)"]);
  }
  throw new Error(`PostgreSQL no respondió; revisa ${LOG}`);
}

function crearBases(user, password) {
  const env = { ...process.env, PGPASSWORD: password };
  for (const db of BASES) {
    const existe = spawnSync(bin("psql"), ["-h", "localhost", "-p", PORT, "-U", user, "-d", "postgres", "-tAc", `SELECT 1 FROM pg_database WHERE datname='${db}'`], {
      env,
      encoding: "utf8",
    });
    if (existe.stdout.trim() === "1") continue;
    execFileSync(bin("createdb"), ["-h", "localhost", "-p", PORT, "-U", user, db], { env, stdio: "inherit" });
    console.log(`Base ${db} creada.`);
  }
}

const cmd = process.argv[2];
if (cmd === "init") {
  const { user, password } = credenciales();
  if (!existsSync(path.join(DATA, "PG_VERSION"))) {
    const pwfile = path.join(RAIZ, ".pgpw.tmp");
    writeFileSync(pwfile, password);
    try {
      execFileSync(bin("initdb"), ["-D", DATA, "-U", user, "--pwfile", pwfile, "--auth=scram-sha-256", "-E", "UTF8", "--locale=C"], { stdio: "inherit" });
    } finally {
      rmSync(pwfile, { force: true });
    }
  }
  start();
  crearBases(user, password);
} else if (cmd === "start") {
  start();
} else if (cmd === "stop") {
  if (estaCorriendo()) execFileSync(bin("pg_ctl"), ["stop", "-D", DATA, "-m", "fast"], { stdio: "inherit" });
  else console.log("PostgreSQL local no está corriendo.");
} else if (cmd === "status") {
  console.log(estaCorriendo() ? `Corriendo en localhost:${PORT}` : "Detenido");
  if (existsSync(LOG)) console.log(readFileSync(LOG, "utf8").split("\n").slice(-5).join("\n"));
} else {
  console.log("Uso: node scripts/pg-local.mjs init|start|stop|status");
  process.exit(1);
}

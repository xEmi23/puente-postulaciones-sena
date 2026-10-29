// Deja el proyecto listo desde cero:
//   1. .env de la raíz (PostgreSQL local y secretos compartidos de la demo) y un .env por app, con secretos aleatorios.
//      Nunca sobrescribe un .env existente.
//   2. Clúster PostgreSQL local del proyecto (puerto 5435) con las bases tb2_dev, tb2_test y tb2_e2e.
//   3. Migraciones y datos de demostración de cada app (cada una en su esquema).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { execSync } from "node:child_process";
import path from "node:path";
import { parse } from "dotenv";

const RAIZ = path.resolve(import.meta.dirname, "..");
const secreto = (bytes = 24) => randomBytes(bytes).toString("hex");
const APPS = ["vinculo", "talentia", "puente"];

const libre = (puerto) =>
  new Promise((ok) => {
    const s = createServer()
      .once("error", () => ok(false))
      .once("listening", () => s.close(() => ok(true)))
      .listen(puerto, "127.0.0.1");
  });

async function envRaiz() {
  const ruta = path.join(RAIZ, ".env");
  if (existsSync(ruta)) {
    console.log(".env de la raíz ya existe; no se modifica.");
    return parse(readFileSync(ruta));
  }
  let puerto = 5435;
  if (!existsSync(path.join(RAIZ, ".pgdata"))) {
    while (!(await libre(puerto)) && puerto < 5450) puerto++;
    if (puerto !== 5435) console.warn(`⚠ El puerto 5435 está ocupado; se usará ${puerto} para el PostgreSQL local.`);
  }
  const valores = {
    PG_PORT: String(puerto),
    PG_USER: "tb2",
    PG_PASSWORD: secreto(),
    // Secretos compartidos entre sistemas mientras las conexiones se configuran por variables de entorno.
    SIM_CLIENT_SECRET: secreto(),
    ORIGEN_MEDIA_ACCESS_TOKEN: secreto(),
    ATS_API_KEY: secreto(),
    DEMO_ADMIN_PASSWORD: secreto(8),
  };
  writeFileSync(
    ruta,
    "# Generado por npm run setup. No se versiona.\n" + Object.entries(valores).map(([k, v]) => `${k}="${v}"`).join("\n") + "\n",
  );
  console.log(`.env de la raíz creado (PostgreSQL local en el puerto ${puerto}).`);
  return valores;
}

function bd(r, nombre) {
  return `postgresql://${r.PG_USER}:${r.PG_PASSWORD}@localhost:${r.PG_PORT}/${nombre}`;
}

function plantilla(app, r) {
  const comun = {
    DATABASE_URL: bd(r, "tb2_dev"),
    DATABASE_URL_TEST: bd(r, "tb2_test"),
    DATABASE_URL_E2E: bd(r, "tb2_e2e"),
    CV_MAX_BYTES: "5242880",
    DEMO_AUTH_ENABLED: "true",
    DEMO_ADMIN_USER: "demo",
    DEMO_ADMIN_PASSWORD: r.DEMO_ADMIN_PASSWORD,
    SESSION_SECRET: secreto(32),
  };
  if (app === "vinculo") {
    return {
      ...comun,
      APP_BASE_URL: "http://localhost:3001",
      PUENTE_WEBHOOK_URL: "http://localhost:3003/api/puente/webhook",
      SIM_CLIENT_SECRET: r.SIM_CLIENT_SECRET,
      ORIGEN_MEDIA_ACCESS_TOKEN: r.ORIGEN_MEDIA_ACCESS_TOKEN,
      MEDIA_TTL_DAYS: "30",
      WORKER_EN_PROCESO: "1",
    };
  }
  if (app === "talentia") {
    return { ...comun, APP_BASE_URL: "http://localhost:3002", ATS_API_KEY: r.ATS_API_KEY };
  }
  return {
    ...comun,
    APP_BASE_URL: "http://localhost:3003",
    ORIGEN_BASE_URL: "http://localhost:3001",
    ATS_BASE_URL: "http://localhost:3002/api/ats/v1",
    SIM_CLIENT_SECRET: r.SIM_CLIENT_SECRET,
    ORIGEN_MEDIA_ACCESS_TOKEN: r.ORIGEN_MEDIA_ACCESS_TOKEN,
    ATS_API_KEY: r.ATS_API_KEY,
    PUENTE_MODO_PRUEBAS: "0",
    WORKER_EN_PROCESO: "1",
  };
}

function envApp(app, r) {
  const ruta = path.join(RAIZ, "apps", app, ".env");
  if (existsSync(ruta)) return console.log(`apps/${app}/.env ya existe; no se modifica.`);
  const valores = plantilla(app, r);
  writeFileSync(ruta, "# Generado por npm run setup. No se versiona.\n" + Object.entries(valores).map(([k, v]) => `${k}="${v}"`).join("\n") + "\n");
  console.log(`apps/${app}/.env creado con secretos aleatorios.`);
}

const correr = (cmd) => execSync(cmd, { cwd: RAIZ, stdio: "inherit" });

const r = await envRaiz();
for (const app of APPS) envApp(app, r);
correr("node scripts/pg-local.mjs init");
for (const app of APPS) {
  correr(`npm run db:migrate -w apps/${app}`);
  correr(`npm run db:seed -w apps/${app}`);
}
console.log("\n✔ Listo. Ejecuta `npm run dev` y abre http://localhost:3001 (Vínculo), :3002 (Talentia) y :3003 (Puente).");

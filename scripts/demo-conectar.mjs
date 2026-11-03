// `npm run demo:conectar`: configura solo las conexiones del puente (plan B de la demo y apoyo a las pruebas).
// Requiere las tres apps corriendo (`npm run dev`): Vínculo valida el webhook del puente por HTTP.
// Uso: node scripts/demo-conectar.mjs [--publicar 9001,9002]
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "dotenv";
import { conectar } from "./conectar-lib.mjs";

const RAIZ = path.resolve(import.meta.dirname, "..");
const envDe = (app) => ({ ...process.env, ...parse(readFileSync(path.join(RAIZ, "apps", app, ".env"))) });
const url = (app, porDefecto) => envDe(app).APP_BASE_URL || porDefecto;
const i = process.argv.indexOf("--publicar");
const publicar = (i > 0 ? process.argv[i + 1] : "9001,9002").split(",").map(Number).filter(Boolean);

const urls = { vinculo: url("vinculo", "http://localhost:3001"), talentia: url("talentia", "http://localhost:3002"), puente: url("puente", "http://localhost:3003") };
for (const [nombre, u] of Object.entries(urls)) {
  try {
    await fetch(`${u}/api/salud`, { signal: AbortSignal.timeout(90_000) });
  } catch {
    console.error(`✖ ${nombre} no responde en ${u}. Arranca las apps con «npm run dev» y vuelve a intentar.`);
    process.exit(2);
  }
}
// D-68: la API tipo Apply Connect de Vínculo está apagada por defecto (como el LinkedIn real para la empresa).
const openapi = await fetch(`${urls.vinculo}/api/openapi.json`, { signal: AbortSignal.timeout(30_000) }).catch(() => null);
if (openapi?.status === 404) {
  console.error("✖ La API de Vínculo está apagada (VINCULO_API_HABILITADA=false, D-68). Para mostrar la vía oficial futura:");
  console.error("  npm run vinculo:api -- on   y reinicia las apps (Ctrl+C y npm run dev); luego vuelve a ejecutar demo:conectar.");
  process.exit(3);
}
try {
  conectar({ raiz: RAIZ, entorno: envDe, urls, publicar });
  console.log("\n✔ Conexiones configuradas. Abre el puente → Conexiones para verlas.");
} catch (e) {
  console.error(`✖ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}

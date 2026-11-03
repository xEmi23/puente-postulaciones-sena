// Prepara la demo del bot sin que ninguna app toque el esquema de otra: cada paso lo ejecuta la propia app con su
// script y su .env (como demo:conectar).
//   1. Vínculo: vacante VIN-DEMO-BOT de Andina (Solicitud sencilla sin ATS) con 3 postulaciones ficticias con CV.
//   2. Puente: fuente «vinculo-bot» con token nuevo y correspondencia (vinculo-bot, VIN-DEMO-BOT) → proceso de Talentia.
//   3. Con urlTalentia: Talentia crea una API Key y el Puente guarda y prueba SOLO la conexión con Talentia
//      (la API de Vínculo puede estar apagada: el bot no la usa, D-68).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function correr(raiz, app, args, env) {
  const r = spawnSync(`npx tsx ${args.join(" ")}`, { cwd: path.join(raiz, "apps", app), env, encoding: "utf8", shell: true });
  if (r.status !== 0) throw new Error(`${app} (${args.join(" ")}) falló:\n${r.stderr}${r.stdout}`);
  return r.stdout;
}

/**
 * @param {{ raiz: string, entorno: (app: string) => NodeJS.ProcessEnv, proceso?: number, reiniciar?: boolean, urlTalentia?: string }} o
 * @returns {{ token: string, vacante: string, titulo: string, proceso: number }}
 */
export function prepararDemoBot(o) {
  const proceso = o.proceso ?? 9005;
  const v = JSON.parse(correr(o.raiz, "vinculo", ["scripts/demo-bot.ts", ...(o.reiniciar ? ["--reiniciar"] : [])], o.entorno("vinculo")));
  const p = JSON.parse(
    correr(o.raiz, "puente", ["scripts/demo-bot.ts"], { ...o.entorno("puente"), CONECTAR_VACANTE: v.externalJobId, CONECTAR_PROCESO: String(proceso) }),
  );
  if (o.urlTalentia) {
    const { apiKey } = JSON.parse(correr(o.raiz, "talentia", ["scripts/crear-llave.ts"], o.entorno("talentia")));
    correr(o.raiz, "puente", ["scripts/conectar.ts"], { ...o.entorno("puente"), CONECTAR_VINCULO_URL: "", CONECTAR_TALENTIA_URL: o.urlTalentia, CONECTAR_API_KEY: apiKey });
  }
  return { token: p.token, vacante: v.externalJobId, titulo: v.titulo, proceso };
}

/**
 * Fija VINCULO_API_HABILITADA en apps/vinculo/.env (D-68). Devuelve el valor anterior. Vínculo lo lee al arrancar:
 * hay que reiniciarlo (npm run dev) para que tome efecto.
 * @param {string} raiz @param {boolean} habilitada @returns {boolean}
 */
export function fijarApiVinculo(raiz, habilitada) {
  const archivo = path.join(raiz, "apps", "vinculo", ".env");
  const texto = existsSync(archivo) ? readFileSync(archivo, "utf8") : "";
  const antes = /^VINCULO_API_HABILITADA="?(true|1)"?\s*$/m.test(texto);
  const linea = `VINCULO_API_HABILITADA="${habilitada}"`;
  const nuevo = /^VINCULO_API_HABILITADA=.*$/m.test(texto)
    ? texto.replace(/^VINCULO_API_HABILITADA=.*$/m, linea)
    : `${texto.replace(/\n?$/, "\n")}# API tipo Apply Connect del Simulador LinkedIn (D-68): false = como el LinkedIn real para la empresa, sin API.\n${linea}\n`;
  writeFileSync(archivo, nuevo);
  return antes;
}

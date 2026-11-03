// Orquesta `demo:conectar` sin que ninguna app toque el esquema de otra: cada paso lo ejecuta la propia app con su
// script y su .env, y los valores viajan por la salida estándar entre procesos (como copiarlos a mano en las pantallas).
//   1. Talentia crea una API Key para el puente.
//   2. Vínculo registra la aplicación del puente y Andina la autoriza.
//   3. El puente guarda y prueba ambas conexiones, y publica en Vínculo los procesos pedidos (Vínculo valida el webhook
//      del puente por desafío antes de publicar).
//   4. Vínculo registra el webhook en la aplicación y lo valida otra vez (estado visible en el portal).
import { spawnSync } from "node:child_process";
import path from "node:path";

function correr(raiz, app, args, env) {
  // Una sola cadena con shell (necesario para npx en Windows): los argumentos son fijos de este archivo, sin datos externos.
  const r = spawnSync(`npx tsx ${args.join(" ")}`, { cwd: path.join(raiz, "apps", app), env, encoding: "utf8", shell: true });
  if (r.status !== 0) throw new Error(`${app} (${args.join(" ")}) falló:\n${r.stderr}${r.stdout}`);
  return r.stdout;
}

/**
 * @param {{ raiz: string, entorno: (app: string) => NodeJS.ProcessEnv, urls: { vinculo: string, talentia: string, puente: string }, publicar?: number[], registro?: (t: string) => void }} o
 */
export function conectar(o) {
  const log = o.registro ?? console.log;
  const { apiKey } = JSON.parse(correr(o.raiz, "talentia", ["scripts/crear-llave.ts"], o.entorno("talentia")));
  log("✔ Simulador BUK: API Key creada para el puente (Lectura y Modificación).");
  const app = JSON.parse(correr(o.raiz, "vinculo", ["scripts/crear-aplicacion.ts", "crear"], o.entorno("vinculo")));
  log(`✔ Simulador LinkedIn: aplicación ${app.clientId} registrada y autorizada por Andina Software S.A.S.`);
  log(
    correr(o.raiz, "puente", ["scripts/conectar.ts"], {
      ...o.entorno("puente"),
      CONECTAR_VINCULO_URL: o.urls.vinculo,
      CONECTAR_CLIENT_ID: app.clientId,
      CONECTAR_CLIENT_SECRET: app.clientSecret,
      CONECTAR_TALENTIA_URL: o.urls.talentia,
      CONECTAR_API_KEY: apiKey,
      CONECTAR_PUBLICAR: (o.publicar ?? []).join(","),
    }).trim(),
  );
  log(
    correr(o.raiz, "vinculo", ["scripts/crear-aplicacion.ts", "webhook"], {
      ...o.entorno("vinculo"),
      CONECTAR_APP_ID: app.appId,
      CONECTAR_WEBHOOK_URL: `${o.urls.puente}/api/webhooks/vinculo`,
    }).trim(),
  );
  return { clientId: app.clientId };
}

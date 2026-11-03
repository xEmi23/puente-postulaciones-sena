// `npm run demo:bot`: deja lista la demo del bot asistido sobre Vínculo (red simulada).
//   - Vínculo: vacante VIN-DEMO-BOT de Andina Software S.A.S. (ficticia) con 3 postulaciones nuevas y su CV.
//   - Puente: fuente «vinculo-bot» con token nuevo y correspondencia VIN-DEMO-BOT → proceso de Talentia (9005 por defecto).
//   - Talentia: API Key nueva; el Puente guarda y prueba SOLO su conexión con Talentia.
//   - apps/bot-linkedin/.env (ignorado por git) con la URL del Puente y el token.
//   - apps/vinculo/.env: VINCULO_API_HABILITADA=false (D-68). En la demo Vínculo se comporta como el LinkedIn real
//     para la empresa (sin API): los candidatos solo llegan al ATS por el bot o por el importador.
// El token se muestra UNA vez en la consola. Requiere las tres apps corriendo (npm run dev): el Puente prueba Talentia.
// Uso: node scripts/demo-bot.mjs [--proceso 9005] [--reiniciar]
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parse } from "dotenv";
import { bandera, valor } from "./argumentos.mjs";
import { fijarApiVinculo, prepararDemoBot } from "./demo-bot-lib.mjs";

const RAIZ = path.resolve(import.meta.dirname, "..");
const envDe = (app) => ({ ...process.env, ...parse(readFileSync(path.join(RAIZ, "apps", app, ".env"))) });
const proceso = Number(valor("proceso") ?? 9005);
const reiniciar = bandera("reiniciar");
if (!Number.isInteger(proceso) || proceso <= 0) {
  console.error("✖ --proceso debe ser el número de un proceso de Talentia (por ejemplo 9005).");
  process.exit(2);
}
if (reiniciar) console.log("Se reinician las postulaciones de la vacante de la demo (--reiniciar).");

const urlVinculo = envDe("vinculo").APP_BASE_URL || "http://localhost:3001";
const urlTalentia = envDe("talentia").APP_BASE_URL || "http://localhost:3002";
const urlPuente = envDe("puente").APP_BASE_URL || "http://localhost:3003";
for (const [nombre, u] of Object.entries({ Vínculo: urlVinculo, Talentia: urlTalentia, Puente: urlPuente })) {
  try {
    await fetch(`${u}/api/salud`, { signal: AbortSignal.timeout(90_000) });
  } catch {
    console.error(`✖ ${nombre} no responde en ${u}. Arranca las apps con «npm run dev» y vuelve a intentar.`);
    process.exit(2);
  }
}

try {
  const r = prepararDemoBot({ raiz: RAIZ, entorno: envDe, proceso, reiniciar, urlTalentia });
  fijarApiVinculo(RAIZ, false);
  // ¿El Vínculo que está corriendo arrancó con la API prendida? Entonces hay que reiniciarlo para que se apague.
  const apiViva = await fetch(`${urlVinculo}/api/openapi.json`, { signal: AbortSignal.timeout(30_000) }).then((x) => x.ok).catch(() => false);
  writeFileSync(
    path.join(RAIZ, "apps", "bot-linkedin", ".env"),
    [
      "# Generado por npm run demo:bot. No se versiona. Sin contraseñas: la sesión de Vínculo se inicia a mano (bot:login).",
      'BOT_SITIO="vinculo"',
      `BOT_URL_SITIO="${urlVinculo}"`,
      `PUENTE_URL="${urlPuente}"`,
      `PUENTE_BOT_TOKEN="${r.token}"`,
      'BOT_MAX_POR_EJECUCION="25"',
      'BOT_HEADLESS="false"',
      "",
    ].join("\n"),
  );
  console.log(`✔ Vínculo: vacante ${r.vacante} «${r.titulo}» de Andina Software S.A.S. con 3 postulaciones ficticias (con CV).`);
  console.log(`✔ Puente: fuente «vinculo-bot» y correspondencia ${r.vacante} → proceso ${r.proceso} de Talentia.`);
  console.log("✔ Talentia: API Key nueva; conexión del Puente con Talentia guardada y probada.");
  console.log("✔ Vínculo: VINCULO_API_HABILITADA=false en apps/vinculo/.env (sin API ni webhooks, como el LinkedIn real para la empresa).");
  if (apiViva) console.log("  ⚠ El Vínculo que está corriendo aún tiene la API prendida: reinicia las apps (Ctrl+C y npm run dev).");
  console.log("");
  console.log("Token de la fuente «vinculo-bot» (se muestra UNA vez; ya quedó en apps/bot-linkedin/.env):");
  console.log(`  ${r.token}`);
  console.log("");
  console.log("Siguientes pasos:");
  console.log("  npm run bot:login -w apps/bot-linkedin   (inicia sesión A MANO como reclutadora@andina.demo.test y cierra la ventana)");
  console.log("  npm run bot -w apps/bot-linkedin");
} catch (e) {
  console.error(`✖ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}

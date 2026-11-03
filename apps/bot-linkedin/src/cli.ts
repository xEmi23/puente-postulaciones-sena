import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { cargarPerfil } from "./sitios";
import { dentroDelHorario, leerConfig } from "./config";
import { ErrorNavegador, abrirNavegador } from "./navegacion/navegador";
import { recorrer } from "./navegacion/recorrido";
import { crearPausa } from "./navegacion/pausas";
import { enviarPostulacion, vacantesPermitidas } from "./envio";
import { ErrorIntervencionHumana } from "./guardias";

// Bot asistido del Puente (ESPECIFICACION_V4 §8.3), EXPERIMENTAL, por perfiles de sitio (D-65).
//   npm run bot:login -w apps/bot-linkedin            → abre el navegador del bot para iniciar sesión A MANO
//   npm run bot -w apps/bot-linkedin                  → recorre las vacantes vinculadas y envía al Puente
//   npm run bot -w apps/bot-linkedin -- --vacante <id> → solo esa vacante
//   npm run bot -w apps/bot-linkedin -- --seco        → no envía nada (muestra lo que enviaría)
// Sin modo programado: lo ejecuta una persona, con la ventana visible.

function argumentos(argv: string[]) {
  const o: { login: boolean; seco: boolean; vacante?: string } = { login: false, seco: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "login") o.login = true;
    else if (argv[i] === "--seco") o.seco = true;
    else if (argv[i] === "--vacante") o.vacante = argv[++i];
  }
  return o;
}

async function login(dirPerfil: string, url: string) {
  mkdirSync(dirPerfil, { recursive: true });
  const contexto = await chromium.launchPersistentContext(dirPerfil, { headless: false, viewport: { width: 1280, height: 860 }, locale: "es-CO" }).catch((e) => {
    throw new ErrorNavegador(e);
  });
  const pagina = contexto.pages()[0] ?? (await contexto.newPage());
  await pagina.goto(url).catch(async (e) => {
    await contexto.close().catch(() => undefined);
    throw new ErrorNavegador(e, url);
  });
  console.log("Inicia sesión A MANO en la ventana que se abrió (el bot no guarda contraseñas).");
  console.log("Cuando veas el panel del reclutador, CIERRA la ventana: la sesión queda en el perfil del bot.");
  await new Promise<void>((ok) => contexto.on("close", () => ok()));
  console.log("Sesión guardada en", dirPerfil);
}

async function main() {
  const args = argumentos(process.argv.slice(2));
  const perfil = cargarPerfil(process.env.BOT_SITIO || "vinculo");
  const cfg = leerConfig(perfil);
  console.log(`Bot del Puente · sitio «${perfil.nombre}» (${perfil.nombre === "vinculo" ? "red simulada" : "experimental"}) · ${cfg.urlSitio}`);

  if (args.login) return login(cfg.dirPerfil, perfil.urlLogin(cfg.urlSitio));

  if (!cfg.token) throw new Error("Falta PUENTE_BOT_TOKEN (ejecuta `npm run demo:bot` o pega el token de Puente → Fuentes en apps/bot-linkedin/.env).");
  if (!dentroDelHorario(cfg.horario)) {
    throw new Error(`Fuera del horario permitido (${String(cfg.horario.desde).padStart(2, "0")}-${String(cfg.horario.hasta).padStart(2, "0")}). No se ejecuta.`);
  }
  const nav = await abrirNavegador(cfg.dirPerfil, cfg.headless);
  try {
    const envio = {
      puenteUrl: cfg.puenteUrl,
      token: cfg.token,
      alReintentar: (motivo: string, ms: number) => console.log(`  … ${motivo}; reintento en ${Math.round(ms / 1000)} s (Ctrl+C para cancelar).`),
    };
    const resumen = await recorrer(
      perfil,
      nav,
      {
        vacantesPermitidas: () => vacantesPermitidas(envio),
        enviar: (d, cv) => enviarPostulacion(envio, d, cv),
        pausa: crearPausa(cfg.pausaMin, cfg.pausaMax),
        log: (m) => console.log(m),
      },
      { urlSitio: cfg.urlSitio, maxPorEjecucion: cfg.maxPorEjecucion, vacante: args.vacante, seco: args.seco },
    );
    console.log(
      `Listo: ${resumen.vistas} vista(s), ${resumen.enviadas} enviada(s) → ${resumen.recibidas} recibida(s), ${resumen.duplicadas} duplicada(s), ${resumen.revision} en revisión, ${resumen.rechazadas} rechazada(s), ${resumen.errores} con error${resumen.seco ? " (modo seco: no se envió nada)" : ""}.`,
    );
    // Línea legible por máquinas (pruebas E2E).
    console.log(`RESUMEN ${JSON.stringify(resumen)}`);
  } finally {
    await nav.cerrar();
  }
}

main().catch((e) => {
  if (e instanceof ErrorIntervencionHumana) {
    console.error(`⚠ ${e.message}`);
    process.exit(3);
  }
  console.error(`✖ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});

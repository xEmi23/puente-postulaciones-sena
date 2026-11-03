import { mkdirSync } from "node:fs";
import { chromium, type BrowserContext } from "playwright";
import type { Navegador } from "./recorrido";

// Navegador real (Playwright, Chromium) con un perfil PROPIO del bot (.bot-perfil-<sitio>/), donde la persona inicia
// sesión a mano con `bot:login`. Ventana visible por defecto. Sin evasión de ningún tipo: user agent, huella y
// comportamiento son los de un Chromium normal; no se tocan captchas ni verificaciones (las guardias detienen el bot).

/** Traduce los errores de Playwright a un mensaje claro en español que dice qué hacer. */
export function mensajeErrorNavegador(e: unknown, url?: string): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/has been closed|Target closed|browser has disconnected/i.test(m)) {
    return "Se cerró la ventana del bot antes de terminar. Vuelve a ejecutar el bot: lo ya enviado sale como «duplicada» y no se repite.";
  }
  if (/ProcessSingleton|user data directory is already in use|SingletonLock|lock file/i.test(m)) {
    return "El perfil del bot ya está abierto en otra ventana (¿quedó abierta la de bot:login u otra corrida?). Ciérrala y vuelve a ejecutar.";
  }
  if (/ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_ADDRESS_UNREACHABLE|ECONNREFUSED/i.test(m)) {
    return `El sitio no responde${url ? ` (${new URL(url).origin})` : ""}. ¿Están encendidas las apps (npm run dev) y hay red? Vuelve a ejecutar cuando respondan.`;
  }
  if (/Timeout .*exceeded|ERR_TIMED_OUT/i.test(m)) {
    return `El sitio tardó demasiado en responder${url ? ` (${new URL(url).origin})` : ""}. Revisa que las apps estén encendidas y vuelve a ejecutar.`;
  }
  if (/Executable doesn't exist|npx playwright install/i.test(m)) {
    return "Falta el navegador Chromium de Playwright: ejecuta «npx playwright install chromium» y vuelve a intentar.";
  }
  return m;
}

export class ErrorNavegador extends Error {
  constructor(e: unknown, url?: string) {
    super(mensajeErrorNavegador(e, url));
    this.name = "ErrorNavegador";
  }
}

export interface NavegadorAbierto extends Navegador {
  contexto: BrowserContext;
  cerrar(): Promise<void>;
}

export async function abrirNavegador(dirPerfil: string, headless: boolean): Promise<NavegadorAbierto> {
  mkdirSync(dirPerfil, { recursive: true });
  const contexto = await chromium.launchPersistentContext(dirPerfil, { headless, viewport: { width: 1280, height: 860 }, locale: "es-CO" }).catch((e) => {
    throw new ErrorNavegador(e);
  });
  const pagina = contexto.pages()[0] ?? (await contexto.newPage());
  return {
    contexto,
    async ir(url) {
      await pagina.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 }).catch((e) => {
        throw new ErrorNavegador(e, url);
      });
      await pagina.waitForLoadState("load").catch(() => undefined);
      // Las páginas se envían en streaming y una sesión vencida redirige desde el cliente: se espera a que la red
      // quede quieta (como esperaría una persona) para leer la página final. Con tope, para no colgarse.
      await pagina.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
      const html = await pagina.content().catch((e) => {
        throw new ErrorNavegador(e, url);
      });
      return { html, url: pagina.url() };
    },
    async descargar(url) {
      // La descarga usa la misma sesión del navegador (sus cookies): nada de credenciales aparte.
      const r = await contexto.request.get(url, { timeout: 120_000, maxRedirects: 0 }).catch((e) => {
        throw new ErrorNavegador(e, url);
      });
      const disposicion = r.headers()["content-disposition"] ?? "";
      const nombre = decodeURIComponent(/filename="?([^";]+)"?/i.exec(disposicion)?.[1] ?? "cv.pdf");
      return { status: r.status(), bytes: new Uint8Array(await r.body()), nombreArchivo: nombre };
    },
    async cerrar() {
      await contexto.close();
    },
  };
}

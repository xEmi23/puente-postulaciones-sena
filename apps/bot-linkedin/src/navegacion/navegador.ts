import { mkdirSync } from "node:fs";
import { chromium, type BrowserContext } from "playwright";
import type { Navegador } from "./recorrido";

// Navegador real (Playwright, Chromium) con un perfil PROPIO del bot (.bot-perfil-<sitio>/), donde la persona inicia
// sesión a mano con `bot:login`. Ventana visible por defecto. Sin evasión de ningún tipo: user agent, huella y
// comportamiento son los de un Chromium normal; no se tocan captchas ni verificaciones (las guardias detienen el bot).

export interface NavegadorAbierto extends Navegador {
  contexto: BrowserContext;
  cerrar(): Promise<void>;
}

export async function abrirNavegador(dirPerfil: string, headless: boolean): Promise<NavegadorAbierto> {
  mkdirSync(dirPerfil, { recursive: true });
  const contexto = await chromium.launchPersistentContext(dirPerfil, { headless, viewport: { width: 1280, height: 860 }, locale: "es-CO" });
  const pagina = contexto.pages()[0] ?? (await contexto.newPage());
  return {
    contexto,
    async ir(url) {
      await pagina.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await pagina.waitForLoadState("load").catch(() => undefined);
      // Las páginas se envían en streaming y una sesión vencida redirige desde el cliente: se espera a que la red
      // quede quieta (como esperaría una persona) para leer la página final. Con tope, para no colgarse.
      await pagina.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
      return { html: await pagina.content(), url: pagina.url() };
    },
    async descargar(url) {
      // La descarga usa la misma sesión del navegador (sus cookies): nada de credenciales aparte.
      const r = await contexto.request.get(url, { timeout: 120_000, maxRedirects: 0 });
      const disposicion = r.headers()["content-disposition"] ?? "";
      const nombre = decodeURIComponent(/filename="?([^";]+)"?/i.exec(disposicion)?.[1] ?? "cv.pdf");
      return { status: r.status(), bytes: new Uint8Array(await r.body()), nombreArchivo: nombre };
    },
    async cerrar() {
      await contexto.close();
    },
  };
}

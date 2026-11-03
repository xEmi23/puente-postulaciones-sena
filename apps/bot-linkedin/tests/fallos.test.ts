import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { perfilVinculo } from "../src/sitios/vinculo";
import { aCanonica } from "../src/mapeo";
import { enviarPostulacion, vacantesPermitidas } from "../src/envio";
import { recorrer, type Navegador } from "../src/navegacion/recorrido";
import { mensajeErrorNavegador } from "../src/navegacion/navegador";

// Auditoría F4-V: cada fallo termina con un mensaje claro en español, dice qué hacer y no envía datos a medias.

const BASE = "http://localhost:3001";
const PDF = new Uint8Array(Buffer.from("%PDF-1.4\n% CV ficticio de prueba\n%%EOF"));
const fixture = (...p: string[]) => readFileSync(path.resolve(__dirname, "../fixtures", ...p), "utf8");
const relojInstantaneo = { dormir: async () => undefined, azar: () => 0 };
const respuesta = (status: number, cuerpo: unknown, h: Record<string, string> = {}) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json", ...h } });
const canonica = () => aCanonica(perfilVinculo.extraerDetalle(fixture("vinculo", "ficha-postulante.html"), BASE), null);

describe("envío: Puente apagado, 429 y rechazos", () => {
  it("Puente apagado o sin red: avisa en cada reintento y al final dice qué hacer", async () => {
    const avisos: string[] = [];
    const caido = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const o = { puenteUrl: "http://localhost:3003", token: "t", fetchImpl: caido, reloj: relojInstantaneo, esperas: [1, 1], alReintentar: (m: string) => avisos.push(m) };
    await expect(vacantesPermitidas(o)).rejects.toThrow(/No se pudo contactar al Puente \(http:\/\/localhost:3003\).*¿Está encendido\? \(npm run dev\)/);
    expect(avisos).toEqual(["el Puente no responde", "el Puente no responde"]);
  });

  it("429: espera lo que dice Retry-After y lo avisa", async () => {
    const esperas: number[] = [];
    const avisos: string[] = [];
    let n = 0;
    const f = (async () => (++n === 1 ? respuesta(429, { estado: "DEMASIADAS_PETICIONES" }, { "retry-after": "7" }) : respuesta(202, { estado: "RECIBIDA" }))) as unknown as typeof fetch;
    const reloj = { dormir: async (ms: number) => void esperas.push(ms), azar: () => 0 };
    const r = await enviarPostulacion({ puenteUrl: "http://p", token: "t", fetchImpl: f, reloj, alReintentar: (m) => avisos.push(m) }, canonica(), null);
    expect(r.estado).toBe("RECIBIDA");
    expect(esperas).toEqual([7000]);
    expect(avisos[0]).toContain("429");
  });

  it("vacante sin correspondencia (422): se informa como rechazada con el motivo del Puente", async () => {
    const f = (async () => respuesta(422, { estado: "VACANTE_SIN_CORRESPONDENCIA", mensaje: "La vacante no tiene correspondencia." })) as unknown as typeof fetch;
    expect(await enviarPostulacion({ puenteUrl: "http://p", token: "t", fetchImpl: f }, canonica(), null)).toMatchObject({
      estado: "RECHAZADA",
      detalle: "La vacante no tiene correspondencia.",
    });
  });

  it("postulante sin correo: se envía sin correo (el Puente lo deja en revisión); no se inventa uno", () => {
    const d = { ...perfilVinculo.extraerDetalle(fixture("vinculo", "ficha-postulante.html"), BASE), correo: "  " };
    expect(aCanonica(d, null).candidato.correo).toBeUndefined();
  });
});

describe("recorrido: casos de la página", () => {
  const menu = `<nav aria-label="Secciones del panel"></nav>`;
  /** Sitio doble: panel con las vacantes pedidas; cada ficha con un CV que responde según `cv`. */
  function sitio(o: { vacantes?: string[]; postulantes?: number; cv?: { status: number; bytes: Uint8Array }; fichaIngreso?: boolean }): Navegador {
    const vacantes = o.vacantes ?? ["VAC-1"];
    const filas = Array.from(
      { length: o.postulantes ?? 1 },
      (_, i) => `<tr data-testid="fila-postulante" data-postulacion="p${i}"><td><a data-testid="enlace-ficha" href="/reclutador/postulaciones/p${i}">Ver ficha</a></td></tr>`,
    ).join("");
    return {
      async ir(url) {
        if (url.endsWith("/reclutador")) {
          const html = vacantes.map((v) => `<table><tr data-testid="fila-vacante" data-external-job-id="${v}"><td><a href="/reclutador/vacantes/${v}">${v}</a></td></tr></table>`).join("");
          return { url, html: menu + html };
        }
        if (url.includes("/reclutador/vacantes/")) return { url, html: `${menu}<table>${filas}</table>` };
        if (o.fichaIngreso) return { url: `${BASE}/ingresar?siguiente=%2Freclutador`, html: `<form><input type="password" /></form>` };
        const id = url.split("/").pop()!;
        return {
          url,
          html: `${menu}<article data-testid="ficha-postulante" data-postulacion="${id}" data-vacante="VAC-1"><span data-campo="nombres">Ana</span><a data-campo="cv" href="/cv/${id}">cv.pdf</a></article>`,
        };
      },
      async descargar() {
        return { ...(o.cv ?? { status: 200, bytes: PDF }), nombreArchivo: "cv.pdf" };
      },
    };
  }

  async function correr(nav: Navegador, permitidas = ["VAC-1"]) {
    const log: string[] = [];
    const enviados: { cv: boolean }[] = [];
    const r = await recorrer(
      perfilVinculo,
      nav,
      {
        vacantesPermitidas: async () => permitidas,
        enviar: async (_d, cv) => {
          enviados.push({ cv: !!cv });
          return { estado: "REQUIERE_REVISION", status: 202, detalle: "en revisión: sin_cv" };
        },
        pausa: async () => undefined,
        log: (m) => log.push(m),
      },
      { urlSitio: BASE, maxPorEjecucion: 25 },
    );
    return { r, log, enviados };
  }

  it("CV que no se descarga (404) o PDF corrupto: se envía SIN CV (queda en revisión) y se avisa", async () => {
    for (const cv of [
      { status: 404, bytes: new Uint8Array() },
      { status: 200, bytes: new Uint8Array(Buffer.from("<html>no es un pdf</html>")) },
    ]) {
      const { r, log, enviados } = await correr(sitio({ cv }));
      expect(enviados).toEqual([{ cv: false }]);
      expect(r.revision).toBe(1);
      expect(log.some((l) => l.includes("el CV no se pudo descargar como PDF"))).toBe(true);
    }
  });

  it("vacante sin postulantes: termina en 0 sin error", async () => {
    const { r, log } = await correr(sitio({ postulantes: 0 }));
    expect(r).toMatchObject({ vacantes: 1, vistas: 0, enviadas: 0, errores: 0 });
    expect(log).toContain("  0 postulante(s) encontrados.");
  });

  it("vacante del panel no vinculada en el Puente: no se abre y se explica por qué no hay nada", async () => {
    const { r, log } = await correr(sitio({ vacantes: ["OTRA"] }));
    expect(r.vacantes).toBe(0);
    expect(log.some((l) => l.startsWith("Ninguna de las vacantes vinculadas en el Puente (VAC-1) aparece en el panel"))).toBe(true);
  });

  it("la sesión vence a mitad de la corrida: se detiene con «Se requiere intervención humana» sin enviar esa ficha", async () => {
    const enviados: unknown[] = [];
    await expect(
      recorrer(
        perfilVinculo,
        sitio({ fichaIngreso: true }),
        {
          vacantesPermitidas: async () => ["VAC-1"],
          enviar: async () => {
            enviados.push(1);
            return { estado: "RECIBIDA", status: 202, detalle: "" };
          },
          pausa: async () => undefined,
          log: () => undefined,
        },
        { urlSitio: BASE, maxPorEjecucion: 25 },
      ),
    ).rejects.toThrow(/Se requiere intervención humana: .*bot:login.*otra ventana del bot abierta/);
    expect(enviados).toHaveLength(0);
  });
});

describe("página de error del sitio", () => {
  it("«Algo salió mal» de Vínculo (p. ej., PostgreSQL apagado) detiene el bot y dice qué revisar, no habla de la sesión", async () => {
    const { detectarBloqueo } = await import("../src/guardias");
    const html = `<main id="contenido" class="indice" role="alert"><h1>Algo salió mal</h1><p>Ocurrió un error inesperado.</p></main>`;
    const b = detectarBloqueo(perfilVinculo, html, `${BASE}/reclutador`);
    expect(b?.tipo).toBe("pagina_inesperada");
    expect(b?.detalle).toMatch(/npm run pg:start/);
  });
});

describe("errores del navegador: en español y con qué hacer", () => {
  it("ventana cerrada, perfil en uso, sitio apagado, tiempo agotado y sin Chromium", () => {
    expect(mensajeErrorNavegador(new Error("page.goto: Target page, context or browser has been closed"))).toMatch(/Se cerró la ventana del bot.*duplicada/);
    expect(mensajeErrorNavegador(new Error("Failed to create a ProcessSingleton for your profile directory"))).toMatch(/perfil del bot ya está abierto/);
    expect(mensajeErrorNavegador(new Error("page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3001/reclutador"), "http://localhost:3001/reclutador")).toBe(
      "El sitio no responde (http://localhost:3001). ¿Están encendidas las apps (npm run dev) y hay red? Vuelve a ejecutar cuando respondan.",
    );
    expect(mensajeErrorNavegador(new Error("page.goto: Timeout 120000ms exceeded."), "http://localhost:3001/reclutador")).toMatch(/tardó demasiado/);
    expect(mensajeErrorNavegador(new Error("browserType.launchPersistentContext: Executable doesn't exist at C:\\x"))).toMatch(/npx playwright install chromium/);
  });
});

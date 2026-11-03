import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { perfilVinculo } from "../src/sitios/vinculo";
import { cargarPerfil } from "../src/sitios";
import { MENSAJE_PENDIENTE, SELECTORES_LINKEDIN } from "../src/sitios/linkedin";
import { detectarBloqueo, ErrorIntervencionHumana, exigirSinBloqueo, MENSAJE_INTERVENCION } from "../src/guardias";
import { aCanonica, sha256 } from "../src/mapeo";
import { enviarPostulacion, vacantesPermitidas } from "../src/envio";
import { recorrer, type Navegador } from "../src/navegacion/recorrido";
import { crearPausa } from "../src/navegacion/pausas";
import { dentroDelHorario, leerConfig } from "../src/config";

// Pruebas del bot sin navegador ni red (V4 F4-V). El recorrido real contra Vínculo, el Puente y Talentia: e2e/bot.spec.ts.

const BASE = "http://localhost:3001";
const fixture = (...p: string[]) => readFileSync(path.resolve(__dirname, "../fixtures", ...p), "utf8");
const PDF = new Uint8Array(Buffer.from("%PDF-1.4\n% CV ficticio de prueba\n%%EOF"));

describe("BV-1 · extracción del perfil Vínculo sobre HTML de sus páginas", () => {
  it("panel del reclutador: vacantes con su código y su enlace", () => {
    const vacantes = perfilVinculo.extraerVacantes(fixture("vinculo", "panel-vacantes.html"), BASE);
    expect(vacantes.length).toBeGreaterThanOrEqual(7);
    const demo = vacantes.find((v) => v.idExterno === "VIN-DEMO-BOT")!;
    expect(demo).toMatchObject({ titulo: "Analista de Integraciones (demo del bot)", url: expect.stringMatching(/^http:\/\/localhost:3001\/reclutador\/vacantes\/[0-9a-f-]{36}$/) });
  });

  it("vacante: los 3 postulantes con el id de la postulación y el enlace a su ficha", () => {
    const p = perfilVinculo.extraerPostulantes(fixture("vinculo", "vacante-postulantes.html"), BASE);
    expect(p).toHaveLength(3);
    for (const x of p) {
      expect(x.idExterno).toMatch(/^[0-9a-f-]{36}$/);
      expect(x.urlDetalle).toBe(`${BASE}/reclutador/postulaciones/${x.idExterno}`);
    }
  });

  it("ficha: datos de contacto, vacante, fecha y enlace del CV", () => {
    const d = perfilVinculo.extraerDetalle(fixture("vinculo", "ficha-postulante.html"), BASE);
    expect(d).toMatchObject({
      vacanteExterna: "VIN-DEMO-BOT",
      nombres: "Sofía",
      apellidos: "Cardona Ficticia",
      correo: "sofia.cardona.bot@demo.test",
      telefono: "+573025550333",
      ciudad: "Envigado",
      titular: "Ingeniera de datos junior",
      perfilUrl: `${BASE}/in/sofia-cardona-ficticia-bot`,
    });
    expect(d.idExterno).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(d.recibidaEn).toString()).not.toBe("Invalid Date");
    expect(d.urlCv).toBe(`${BASE}/reclutador/postulaciones/${d.idExterno}/cv`);
  });

  it("si cambia la estructura, falla con «No se encontró el elemento» (el bot no adivina)", () => {
    expect(() => perfilVinculo.extraerDetalle("<html><body><h1>Otra cosa</h1></body></html>", BASE)).toThrow(/No se encontró el elemento/);
  });
});

describe("BV-2 · guardias: el bot se detiene ante el ingreso o una verificación", () => {
  it("la pantalla de ingreso de Vínculo es «sesión cerrada»", () => {
    const b = detectarBloqueo(perfilVinculo, fixture("vinculo", "ingresar.html"), `${BASE}/ingresar?siguiente=%2Freclutador`);
    expect(b?.tipo).toBe("sesion_cerrada");
    expect(() => exigirSinBloqueo(perfilVinculo, fixture("vinculo", "ingresar.html"), `${BASE}/ingresar`)).toThrow(ErrorIntervencionHumana);
  });

  it("una página de verificación (captcha / actividad inusual) detiene el bot con «Se requiere intervención humana»", () => {
    const html = fixture("guardias", "verificacion.html");
    expect(detectarBloqueo(perfilVinculo, html, `${BASE}/reclutador`)?.tipo).toBe("verificacion");
    expect(() => exigirSinBloqueo(perfilVinculo, html, `${BASE}/reclutador`)).toThrow(MENSAJE_INTERVENCION);
  });

  it("una página del panel sin su estructura (p. ej., que se quedó en «Cargando…») detiene el bot, no se da por vacía", () => {
    const html = fixture("guardias", "panel-incompleto.html");
    expect(detectarBloqueo(perfilVinculo, html, `${BASE}/reclutador`)?.tipo).toBe("pagina_inesperada");
    expect(() => exigirSinBloqueo(perfilVinculo, html, `${BASE}/reclutador`)).toThrow(MENSAJE_INTERVENCION);
  });

  it("las páginas normales del panel no se confunden con un bloqueo", () => {
    for (const f of ["panel-vacantes.html", "vacante-postulantes.html", "ficha-postulante.html"]) {
      expect(detectarBloqueo(perfilVinculo, fixture("vinculo", f), `${BASE}/reclutador`)).toBeNull();
    }
  });
});

describe("BV-6 · BOT_SITIO=linkedin se niega a correr", () => {
  it("con el mensaje «perfil LinkedIn pendiente de la Puerta 0» y sin selectores inventados", () => {
    expect(() => cargarPerfil("linkedin")).toThrow(MENSAJE_PENDIENTE);
    expect(MENSAJE_PENDIENTE).toBe("perfil LinkedIn pendiente de la Puerta 0");
    expect(Object.values(SELECTORES_LINKEDIN).every((s) => s === "")).toBe(true);
    expect(() => cargarPerfil("otro")).toThrow(/Sitio desconocido/);
    expect(cargarPerfil("vinculo").nombre).toBe("vinculo");
  });
});

describe("mapeo a la canónica (sin fuente: la fija el token)", () => {
  it("datos de la ficha + CV → PostulacionCanonica v1", () => {
    const d = perfilVinculo.extraerDetalle(fixture("vinculo", "ficha-postulante.html"), BASE);
    const c = aCanonica(d, { bytes: PDF, nombreArchivo: "cv.pdf" });
    expect(c).toMatchObject({ version: "1", idExterno: d.idExterno, vacanteExterna: "VIN-DEMO-BOT", origenDatos: "fuente", candidato: { nombres: "Sofía", correo: "sofia.cardona.bot@demo.test" } });
    expect(c.cv).toEqual({ nombreArchivo: "cv.pdf", tipo: "application/pdf", sha256: sha256(PDF), bytes: PDF.length });
    expect("fuente" in c).toBe(false);
  });
});

describe("envío al Puente", () => {
  const relojInstantaneo = { dormir: async () => undefined, azar: () => 0 };
  const respuesta = (status: number, cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });

  it("multipart con token; reintenta 503 (arranque en frío) y respeta los estados del Puente", async () => {
    const llamadas: { auth: string | null; datos: string; cv: boolean }[] = [];
    let n = 0;
    const fetchDoble = (async (_url: string, init: RequestInit) => {
      const fd = init.body as FormData;
      llamadas.push({ auth: new Headers(init.headers).get("authorization"), datos: String(fd.get("datos")), cv: fd.get("cv") instanceof Blob });
      return ++n < 3 ? respuesta(503, { estado: "dormido" }) : respuesta(202, { estado: "RECIBIDA", idRecepcion: "x" });
    }) as unknown as typeof fetch;
    const d = perfilVinculo.extraerDetalle(fixture("vinculo", "ficha-postulante.html"), BASE);
    const r = await enviarPostulacion({ puenteUrl: "http://puente.test", token: "pf_tok", fetchImpl: fetchDoble, reloj: relojInstantaneo }, aCanonica(d, { bytes: PDF, nombreArchivo: "cv.pdf" }), {
      bytes: PDF,
      nombreArchivo: "cv.pdf",
    });
    expect(r.estado).toBe("RECIBIDA");
    expect(llamadas).toHaveLength(3);
    expect(llamadas[0].auth).toBe("Bearer pf_tok");
    expect(JSON.parse(llamadas[0].datos).fuente).toBeUndefined();
    expect(llamadas[0].cv).toBe(true);
  });

  it("DUPLICADA (200) y un 401 que detiene el bot", async () => {
    const dup = (async () => respuesta(200, { estado: "DUPLICADA" })) as unknown as typeof fetch;
    const c = aCanonica(perfilVinculo.extraerDetalle(fixture("vinculo", "ficha-postulante.html"), BASE), null);
    expect((await enviarPostulacion({ puenteUrl: "http://p", token: "t", fetchImpl: dup }, c, null)).estado).toBe("DUPLICADA");
    const no = (async () => respuesta(401, { estado: "NO_AUTORIZADO" })) as unknown as typeof fetch;
    await expect(enviarPostulacion({ puenteUrl: "http://p", token: "t", fetchImpl: no }, c, null)).rejects.toThrow(/401/);
    await expect(vacantesPermitidas({ puenteUrl: "http://p", token: "t", fetchImpl: no })).rejects.toThrow(/token/);
  });
});

describe("recorrido: límites, pausas y modo seco (reloj simulado)", () => {
  // Navegador doble: un panel con 1 vacante y N postulantes, todas las fichas iguales.
  function navegadorDoble(postulantes: number): Navegador & { visitas: string[] } {
    const filas = Array.from({ length: postulantes }, (_, i) => {
      const id = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
      return `<tr data-testid="fila-postulante" data-postulacion="${id}"><td><a data-testid="enlace-ficha" href="/reclutador/postulaciones/${id}">Ver ficha</a></td></tr>`;
    }).join("");
    const visitas: string[] = [];
    // Como en Vínculo, toda página del panel trae su menú (la guardia «página inesperada» lo exige).
    const menu = `<nav aria-label="Secciones del panel"></nav>`;
    return {
      visitas,
      async ir(url) {
        visitas.push(url);
        if (url.endsWith("/reclutador")) return { url, html: `${menu}<table><tr data-testid="fila-vacante" data-external-job-id="VAC-1"><td><a href="/reclutador/vacantes/v1">Vacante 1</a></td></tr></table>` };
        if (url.includes("/reclutador/vacantes/")) return { url, html: `${menu}<table>${filas}</table>` };
        const id = url.split("/").pop()!;
        return {
          url,
          html: `${menu}<article data-testid="ficha-postulante" data-postulacion="${id}" data-vacante="VAC-1"><span data-campo="nombres">Ana</span><dd data-campo="correo">ana@demo.test</dd><a data-campo="cv" href="/reclutador/postulaciones/${id}/cv">cv.pdf</a></article>`,
        };
      },
      async descargar() {
        return { status: 200, bytes: PDF, nombreArchivo: "cv.pdf" };
      },
    };
  }

  it("máximo 25 por corrida aunque haya más, con una pausa antes de cada página", async () => {
    const pausas: number[] = [];
    const reloj = { dormir: async (ms: number) => void pausas.push(ms), azar: () => 0.5 };
    const enviados: string[] = [];
    const r = await recorrer(
      perfilVinculo,
      navegadorDoble(30),
      { vacantesPermitidas: async () => ["VAC-1"], enviar: async (d) => (enviados.push(d.idExterno), { estado: "RECIBIDA", status: 202, detalle: "" }), pausa: crearPausa(800, 1500, reloj), log: () => undefined },
      { urlSitio: BASE, maxPorEjecucion: leerConfig(perfilVinculo, { BOT_MAX_POR_EJECUCION: "100" }).maxPorEjecucion },
    );
    expect(r).toMatchObject({ vistas: 25, enviadas: 25, recibidas: 25, limiteAlcanzado: true });
    expect(enviados).toHaveLength(25);
    // 1 pausa antes de la vacante + 1 antes de cada una de las 25 fichas, todas dentro de [800, 1500].
    expect(pausas).toHaveLength(26);
    expect(pausas.every((ms) => ms >= 800 && ms <= 1500)).toBe(true);
  });

  it("BV-5 · --seco recorre y no envía nada", async () => {
    let envios = 0;
    const r = await recorrer(
      perfilVinculo,
      navegadorDoble(3),
      { vacantesPermitidas: async () => ["VAC-1"], enviar: async () => (envios++, { estado: "RECIBIDA", status: 202, detalle: "" }), pausa: async () => 0, log: () => undefined },
      { urlSitio: BASE, maxPorEjecucion: 25, seco: true },
    );
    expect(envios).toBe(0);
    expect(r).toMatchObject({ vistas: 3, enviadas: 0, seco: true });
  });

  it("solo recorre vacantes vinculadas en el Puente (y nada si no hay ninguna)", async () => {
    const nav = navegadorDoble(2);
    const r = await recorrer(perfilVinculo, nav, { vacantesPermitidas: async () => [], enviar: async () => ({ estado: "RECIBIDA", status: 202, detalle: "" }), pausa: async () => 0, log: () => undefined }, { urlSitio: BASE, maxPorEjecucion: 25 });
    expect(r.vistas).toBe(0);
    expect(nav.visitas).toHaveLength(0);
  });

  it("valores por defecto: Vínculo 800–1500 ms sin horario; LinkedIn 3000–8000 ms y 07–19", () => {
    const v = leerConfig(perfilVinculo, {});
    expect(v).toMatchObject({ pausaMin: 800, pausaMax: 1500, maxPorEjecucion: 25, headless: false, horario: { desde: 0, hasta: 24 } });
    expect(dentroDelHorario({ desde: 7, hasta: 19 }, new Date(2026, 10, 3, 6, 59))).toBe(false);
    expect(dentroDelHorario({ desde: 7, hasta: 19 }, new Date(2026, 10, 3, 7, 0))).toBe(true);
    expect(dentroDelHorario({ desde: 7, hasta: 19 }, new Date(2026, 10, 3, 19, 0))).toBe(false);
  });
});

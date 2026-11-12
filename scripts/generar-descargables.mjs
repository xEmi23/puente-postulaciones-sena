#!/usr/bin/env node
// Genera los documentos descargables de la entrega en docs/entrega/descargables/:
//   Documento_Entrega_Completo.docx y .pdf (portada, índice, 01–16 y anexos), Resumen_para_el_Docente.docx y .pdf,
//   Guia_de_Capturas.docx y .pdf, Guia_de_Ejecucion.docx y .pdf, y Entrega_Drive.zip.
//
// Sin pandoc: Markdown → HTML con «marked», HTML → DOCX con «html-to-docx» y HTML → PDF con el Chromium de Playwright.
// «marked» y «html-to-docx» NO son dependencias del proyecto; se instalan aparte:
//   npm install --prefix <carpeta> marked@15.0.12 html-to-docx@1.8.0
//   DESCARGABLES_DEPS=<carpeta> PATRON_PROHIBIDO="<patrón>" node scripts/generar-descargables.mjs
//   (PowerShell: $env:DESCARGABLES_DEPS="<carpeta>"; $env:PATRON_PROHIBIDO="<patrón>")
//
// Reglas: los bloques Mermaid se quitan (cada diagrama ya está exportado a PNG junto a él); las imágenes se incrustan;
// los enlaces a otro documento incluido se vuelven «(ver sección NN)»; los demás enlaces relativos apuntan al archivo en
// el repositorio. Se detiene si el texto contiene datos de la empresa retadora.

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, copyFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEPS = process.env.DESCARGABLES_DEPS;
if (!DEPS) throw new Error("Define DESCARGABLES_DEPS (ver el encabezado del script).");
const reqDeps = createRequire(path.join(path.resolve(DEPS), "package.json"));
const { marked } = reqDeps("marked");
const HTMLtoDOCX = reqDeps("html-to-docx");
const { chromium } = createRequire(path.join(RAIZ, "package.json"))("@playwright/test");

const ENTREGA = path.join(RAIZ, "docs", "entrega");
const SALIDA = path.join(ENTREGA, "descargables");
const REPO = "https://github.com/xEmi23/puente-postulaciones-sena/blob/entrega/";
const FECHA = "12 de noviembre de 2026";
// Datos de la empresa retadora que nunca deben publicarse. El patrón NO se versiona (contiene esos datos): se pasa en
// la variable PATRON_PROHIBIDO (expresión regular, sin barras). Sin ella, el script se detiene.
if (!process.env.PATRON_PROHIBIDO) throw new Error("Define PATRON_PROHIBIDO (patrón con los datos de la empresa que no deben aparecer).");
const PROHIBIDO = new RegExp(process.env.PATRON_PROHIBIDO, "i");

const CAPITULOS = [
  ["01_resumen.md", "01"], ["02_problema_y_contexto.md", "02"], ["03_metodologia.md", "03"], ["04_solucion_y_arquitectura.md", "04"],
  ["05_mapeo_de_datos.md", "05"], ["06_pruebas_y_resultados.md", "06"], ["07_seguridad_y_privacidad.md", "07"], ["08_uso_de_ia.md", "08"],
  ["09_riesgos_y_limitaciones.md", "09"], ["10_trabajo_futuro.md", "10"], ["11_manual_de_uso.md", "11"], ["12_demo.md", "12"],
  ["13_glosario.md", "13"], ["14_preguntas_sustentacion.md", "14"], ["15_lecciones_aprendidas.md", "15"],
  ["16_anexo_decisiones.md", "16"],
  ["medicion/RESULTADO.md", "Anexo A"], ["postman/GUIA.md", "Anexo B"], ["postman/resultados-ejemplos.md", "Anexo C"],
  ["EVIDENCIA_PENDIENTE.md", "Anexo D"], ["GUIA_EJECUCION.md", "Anexo E"], ["GUIA_CAPTURAS.md", "Anexo F"],
];
const SECCION = new Map(CAPITULOS.map(([f, n]) => [path.join(ENTREGA, f), n]));

function dimensionesPng(buf) {
  return buf.toString("ascii", 1, 4) === "PNG" ? { ancho: buf.readUInt32BE(16), alto: buf.readUInt32BE(20) } : { ancho: 800, alto: 600 };
}

/** Markdown de un archivo → HTML listo para el documento (imágenes incrustadas, enlaces resueltos). */
function aHtml(archivoMd, { conSeccion = true } = {}) {
  const dir = path.dirname(archivoMd);
  let md = readFileSync(archivoMd, "utf8").replace(/\r\n/g, "\n");
  md = md.replace(/```mermaid\n[\s\S]*?```\n?/g, "");
  // El código (bloques y en línea) no se toca: se aparta y se devuelve al final.
  const apartados = [];
  md = md.replace(/```[\s\S]*?```|`[^`\n]+`/g, (c) => `\u0000${apartados.push(c) - 1}\u0000`);
  // Imágenes: ![alt](ruta)
  md = md.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, ruta) => {
    const p = path.resolve(dir, decodeURI(ruta));
    if (!existsSync(p)) throw new Error(`Imagen inexistente en ${archivoMd}: ${ruta}`);
    const b = readFileSync(p);
    const { ancho, alto } = dimensionesPng(b);
    const escala = Math.min(1, 600 / ancho, 760 / alto);
    return `<img alt="${alt}" src="data:image/png;base64,${b.toString("base64")}" width="${Math.round(ancho * escala)}" height="${Math.round(alto * escala)}" />`;
  });
  // Enlaces: [texto](destino)
  md = md.replace(/(?<!!)\[([^\]]+)\]\(([^)\s]+)\)/g, (todo, texto, destino) => {
    if (/^(https?:|mailto:)/.test(destino)) return todo;
    if (destino.startsWith("#")) return texto;
    const [rel] = destino.split("#");
    const p = path.resolve(dir, decodeURI(rel));
    const n = SECCION.get(p);
    if (n && conSeccion) return `${texto} (ver ${/^\d/.test(n) ? "sección " : ""}${n})`;
    if (!existsSync(p)) throw new Error(`Enlace roto en ${archivoMd}: ${destino}`);
    const enRepo = path.relative(RAIZ, p).split(path.sep).join("/");
    return `[${texto}](${REPO}${encodeURI(enRepo)})`;
  });
  md = md.replace(/\u0000(\d+)\u0000/g, (_, i) => apartados[Number(i)]);
  return marked.parse(md, { gfm: true });
}

const CSS = `
  @page { size: A4; margin: 18mm 16mm 20mm 16mm; }
  body { font-family: Calibri, "Segoe UI", Arial, sans-serif; font-size: 10.5pt; line-height: 1.4; color: #1a1a1a; }
  h1 { font-size: 18pt; color: #1f3a5f; border-bottom: 2px solid #1f3a5f; padding-bottom: 4px; }
  h2 { font-size: 13.5pt; color: #1f3a5f; margin-top: 18px; }
  h3 { font-size: 11.5pt; color: #1f3a5f; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 8.8pt; }
  th, td { border: 1px solid #9aa5b1; padding: 3px 5px; vertical-align: top; text-align: left; }
  th { background: #e6ecf2; }
  tr { page-break-inside: avoid; }
  code { font-family: Consolas, monospace; font-size: 8.8pt; background: #f2f4f7; }
  pre { background: #f2f4f7; padding: 6px; font-size: 8.5pt; white-space: pre-wrap; word-break: break-all; }
  blockquote { border-left: 3px solid #9aa5b1; margin: 6px 0; padding: 2px 10px; color: #333; background: #f7f9fb; }
  img { max-width: 100%; display: block; margin: 8px auto; border: 1px solid #ccd3da; }
  a { color: #1f5fa8; }
  .salto { page-break-before: always; }
  .portada { text-align: center; padding-top: 120px; }
  .portada h1 { border: none; font-size: 26pt; }
  .portada p { font-size: 12pt; }
`;

function documento(titulo, cuerpo) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${titulo}</title><style>${CSS}</style></head><body>${cuerpo}</body></html>`;
}

function revisar(nombre, html) {
  const sinImagenes = html.replace(/src="data:[^"]+"/g, "");
  const m = PROHIBIDO.exec(sinImagenes);
  if (m) throw new Error(`«${nombre}» contiene un dato prohibido: ${m[0]}`);
}

async function aPdf(navegador, html, destino, { pie = true } = {}) {
  const page = await navegador.newPage();
  await page.setContent(html, { waitUntil: "load" });
  await page.pdf({
    path: destino,
    format: "A4",
    printBackground: true,
    displayHeaderFooter: pie,
    headerTemplate: "<span></span>",
    footerTemplate: `<div style="font-size:8px;width:100%;text-align:center;color:#555;">Puente de postulaciones · Entrega 13/11/2026 · Página <span class="pageNumber"></span> de <span class="totalPages"></span></div>`,
    margin: { top: "18mm", bottom: "20mm", left: "16mm", right: "16mm" },
  });
  await page.close();
}

async function aDocx(html, destino, titulo) {
  const buf = await HTMLtoDOCX(html, null, {
    title: titulo,
    creator: "Equipo del reto (documento generado con apoyo de IA)",
    lang: "es-CO",
    font: "Calibri",
    fontSize: 21,
    footer: true,
    pageNumber: true,
    table: { row: { cantSplit: true } },
    margins: { top: 1020, right: 900, bottom: 1020, left: 900 },
  });
  writeFileSync(destino, buf);
}

const SALTO = `<div class="salto page-break" style="page-break-after: always;"></div>`;

const portada = `
  <div class="portada">
    <h1>Puente de postulaciones</h1>
    <p><strong>Documento de entrega completo</strong></p>
    <p>Reto #1 SENA · Innovación Abierta 2026-2<br/>CUEE 2.0 · SENA Regional Antioquia</p>
    <p>Entrega y sustentación: 13 de noviembre de 2026<br/>Versión del documento: ${FECHA} (etiqueta v1.1-entrega)</p>
    <p>Publicación anonimizada: la empresa que propuso el reto se nombra «la empresa retadora».</p>
    <p>Entorno de simulación: no hay conexión con LinkedIn ni con BUK. Datos ficticios.</p>
    <p><em>Desarrollo y redacción con apoyo mayoritario de IA generativa (ver sección 08).</em></p>
    <p>Repositorio privado: puente-postulaciones-sena · rama «entrega»</p>
  </div>`;

function titulo(archivo) {
  const t = readFileSync(path.join(ENTREGA, archivo), "utf8").split("\n").find((l) => l.startsWith("# "));
  return (t ?? archivo).replace(/^# /, "");
}

const indice = `<h1>Índice</h1><ol style="list-style:none;padding-left:0">${CAPITULOS.map(([f, n]) => `<li><strong>${n}</strong> · ${titulo(f).replace(/^\d+\.\s*/, "")}</li>`).join("")}</ol>
  <p>Los diagramas Mermaid de los documentos se incluyen como imágenes exportadas. Las figuras marcadas «pendiente de insertar» son capturas manuales que aporta el equipo (Anexo F).</p>`;

async function principal() {
  mkdirSync(SALIDA, { recursive: true });
  const navegador = await chromium.launch();
  try {
    // (a)(b) Documento completo
    const cuerpo = [portada, SALTO, indice, ...CAPITULOS.map(([f]) => `${SALTO}<section>${aHtml(path.join(ENTREGA, f))}</section>`)].join("\n");
    const completo = documento("Puente de postulaciones · Documento de entrega completo", cuerpo);
    revisar("Documento completo", completo);
    await aDocx(completo, path.join(SALIDA, "Documento_Entrega_Completo.docx"), "Puente de postulaciones · Documento de entrega completo");
    await aPdf(navegador, completo, path.join(SALIDA, "Documento_Entrega_Completo.pdf"));

    // (c) Resumen para el docente (una página)
    const resumen = documento("Resumen para el docente", aHtml(path.join(ENTREGA, "RESUMEN_DOCENTE.md"), { conSeccion: false }));
    revisar("Resumen", resumen);
    await aDocx(resumen, path.join(SALIDA, "Resumen_para_el_Docente.docx"), "Resumen para el docente");
    await aPdf(navegador, resumen, path.join(SALIDA, "Resumen_para_el_Docente.pdf"), { pie: false });

    // (d) Guías
    for (const [f, nombre, t] of [
      ["GUIA_CAPTURAS.md", "Guia_de_Capturas", "Guía de capturas manuales"],
      ["GUIA_EJECUCION.md", "Guia_de_Ejecucion", "Guía de ejecución"],
    ]) {
      const html = documento(t, aHtml(path.join(ENTREGA, f), { conSeccion: false }));
      revisar(t, html);
      await aDocx(html, path.join(SALIDA, `${nombre}.docx`), t);
      await aPdf(navegador, html, path.join(SALIDA, `${nombre}.pdf`));
    }
  } finally {
    await navegador.close();
  }

  // (e) Paquete para Drive
  const tmp = path.join(SALIDA, "_paquete");
  rmSync(tmp, { recursive: true, force: true });
  const copiar = (origen, destinoRel) => {
    const d = path.join(tmp, destinoRel);
    mkdirSync(path.dirname(d), { recursive: true });
    copyFileSync(origen, d);
  };
  for (const f of readdirSync(SALIDA)) if (/\.(docx|pdf)$/.test(f)) copiar(path.join(SALIDA, f), f);
  copiar(path.join(ENTREGA, "postman", "puente-entrada-generica.postman_collection.json"), "postman/puente-entrada-generica.postman_collection.json");
  copiar(path.join(ENTREGA, "postman", "GUIA.md"), "postman/GUIA.md");
  for (const f of readdirSync(path.join(ENTREGA, "postman", "ejemplos"))) copiar(path.join(ENTREGA, "postman", "ejemplos", f), `postman/ejemplos/${f}`);
  for (const f of readdirSync(path.join(ENTREGA, "img"))) copiar(path.join(ENTREGA, "img", f), `imagenes/diagramas/${f}`);
  const capturas = path.join(RAIZ, "docs", "manuales", "img");
  for (const f of readdirSync(capturas)) if (f.startsWith("entrega-")) copiar(path.join(capturas, f), `imagenes/capturas/${f}`);
  for (const f of readdirSync(path.join(ENTREGA, "medicion"))) copiar(path.join(ENTREGA, "medicion", f), `medicion/${f}`);
  writeFileSync(
    path.join(tmp, "LEEME.txt"),
    [
      "Puente de postulaciones - paquete de entrega (13/11/2026)",
      "",
      "Documento_Entrega_Completo (.docx y .pdf): documentos 01-16 y anexos.",
      "Resumen_para_el_Docente: una pagina.",
      "Guia_de_Capturas y Guia_de_Ejecucion: guias para el equipo y para quien comprueba el proyecto.",
      "postman/: coleccion (sin tokens reales) y ejemplos JSON validos e invalidos.",
      "imagenes/: diagramas y capturas de pantalla (datos ficticios).",
      "medicion/: resultado y datos crudos de la medicion de criterios de exito.",
      "",
      "Entorno de simulacion: no hay conexion con LinkedIn ni con BUK. Desarrollo y redaccion con apoyo mayoritario de IA.",
      "Repositorio privado: puente-postulaciones-sena, rama entrega.",
    ].join("\r\n"),
  );
  const zip = path.join(SALIDA, "Entrega_Drive.zip");
  rmSync(zip, { force: true });
  // En Windows se usa el tar del sistema (bsdtar, crea .zip con -a); el de Git Bash interpreta «C:» como un host remoto.
  const tar = process.platform === "win32" ? path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe") : "tar";
  execFileSync(tar, ["-a", "-c", "-f", zip, "-C", tmp, "."]);
  rmSync(tmp, { recursive: true, force: true });
  console.log(`Descargables en ${path.relative(RAIZ, SALIDA)}:`, readdirSync(SALIDA).join(", "));
}

principal().catch((e) => {
  console.error(e);
  process.exit(1);
});

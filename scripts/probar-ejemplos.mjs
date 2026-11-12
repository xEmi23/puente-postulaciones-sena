#!/usr/bin/env node
// Prueba los ejemplos de docs/entrega/postman/ejemplos/ contra el Puente LOCAL y escribe el resultado en
// docs/entrega/postman/resultados-ejemplos.md. Cubre cada respuesta de la entrada genérica: 202, 200, 400, 401, 413,
// 415, 422 y 429, y comprueba que el ejemplo válido llega a «Postulantes» del Simulador BUK con el mismo SHA-256.
//
// Prepara en la base local (equivale a Puente → Fuentes → «Generar token» y → Correspondencias):
//   - fuente «postman-ejemplos» con un token nuevo y la vacante VAC-DEMO-1 → proceso 9002;
//   - fuente «postman-limite» con otro token (solo para provocar el 429 sin afectar a las demás pruebas).
// Requisitos: `npm run dev` encendido y el Puente conectado con el Simulador BUK. Se niega con una base no local.
//
// Uso: node scripts/probar-ejemplos.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUENTE = process.env.PUENTE_URL ?? "http://localhost:3003";
const DIR = path.join(RAIZ, "docs", "entrega", "postman", "ejemplos");
const VACANTE = "VAC-DEMO-1";
const PROCESO = 9002;

const envDe = (app) => dotenv.parse(readFileSync(path.join(RAIZ, "apps", app, ".env")));
const urlP = envDe("puente").DATABASE_URL;
const urlT = envDe("talentia").DATABASE_URL;
for (const u of [urlP, urlT]) if (!["localhost", "127.0.0.1"].includes(new URL(u).hostname)) throw new Error("Solo contra una base local.");
const dbP = new pg.Client({ connectionString: urlP, options: "-c search_path=puente" });
const dbT = new pg.Client({ connectionString: urlT, options: "-c search_path=talentia" });
const sha = (b) => createHash("sha256").update(b).digest("hex");
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const cv = (n) => readFileSync(path.join(RAIZ, "fixtures", "cv", n));

async function fuenteConToken(nombre, vacantes) {
  const prefijo = randomBytes(5).toString("hex");
  const token = `pf_${prefijo}.${randomBytes(32).toString("base64url")}`;
  await dbP.query(
    `INSERT INTO "Fuente"(id, nombre, descripcion, sistema, "tokenHash", "tokenPrefijo", activa, "creadaEn", "actualizadaEn")
     VALUES (gen_random_uuid(), $1, 'Ejemplos de la colección de Postman (script local)', false, $2, $3, true, now(), now())
     ON CONFLICT (nombre) DO UPDATE SET "tokenHash" = $2, "tokenPrefijo" = $3, activa = true, "revocadaEn" = null, "actualizadaEn" = now()`,
    [nombre, sha(token), prefijo],
  );
  for (const [vacante, proceso] of vacantes) {
    await dbP.query(
      `INSERT INTO "Correspondencia"(id, fuente, "vacanteExterna", "externalJobId", "procesoAtsId", descripcion, activa, "creadaEn", "actualizadaEn", demo)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'Ejemplos de Postman', true, now(), now(), true)
       ON CONFLICT ("externalJobId") DO UPDATE SET activa = true, "cerradaEn" = null, "procesoAtsId" = $4`,
      [nombre, vacante, `${nombre}:${vacante}`, proceso],
    );
  }
  return token;
}

function datosDe(archivo, idUnico) {
  return readFileSync(path.join(DIR, archivo), "utf8").replaceAll("{{idUnico}}", idUnico).replaceAll("{{vacanteExterna}}", VACANTE);
}

async function enviar({ token, datos, archivo, nombreArchivo = "cv.pdf", tipoCuerpo = "multipart" }) {
  const headers = token === null ? {} : { Authorization: `Bearer ${token}` };
  let body;
  if (tipoCuerpo === "json") {
    headers["Content-Type"] = "application/json";
    body = datos;
  } else {
    body = new FormData();
    if (datos !== undefined) body.set("datos", datos);
    if (archivo) body.set("cv", new Blob([archivo], { type: "application/pdf" }), nombreArchivo);
  }
  const r = await fetch(`${PUENTE}/api/entradas/v1/postulaciones`, { method: "POST", headers, body });
  const cuerpo = await r.json().catch(() => ({}));
  return { status: r.status, cuerpo, retryAfter: r.headers.get("retry-after") };
}

async function main() {
  await dbP.connect();
  await dbT.connect();
  const token = await fuenteConToken("postman-ejemplos", [[VACANTE, PROCESO]]);
  const tokenLimite = await fuenteConToken("postman-limite", []);
  const corrida = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const id = (n) => `ej-${corrida}-${n}`;
  const camila = cv("cv-camila-ejemplo.pdf");
  const filas = [];
  const caso = async (nombre, solicitud, esperado, estadoEsperado) => {
    const r = await solicitud();
    const estado = r.cuerpo.estado ?? "";
    const ok = r.status === esperado && (!estadoEsperado || estado === estadoEsperado);
    const detalle = r.cuerpo.motivos ? `motivos: ${r.cuerpo.motivos.join(", ")}` : r.cuerpo.errores ? `errores: ${r.cuerpo.errores.map((e) => `${e.campo} (${e.mensaje})`).join("; ")}` : r.cuerpo.mensaje ?? "";
    filas.push({ nombre, esperado: `${esperado}${estadoEsperado ? ` ${estadoEsperado}` : ""}`, obtenido: `${r.status} ${estado}`.trim(), detalle, ok });
    process.stdout.write(ok ? "." : "F");
    return r;
  };

  const r01 = await caso("01-valido.json + cv-camila-ejemplo.pdf", () => enviar({ token, datos: datosDe("01-valido.json", id("01")), archivo: camila, nombreArchivo: "cv-camila-ejemplo.pdf" }), 202, "RECIBIDA");
  await caso("01-valido.json otra vez (mismo idExterno)", () => enviar({ token, datos: datosDe("01-valido.json", id("01")), archivo: camila }), 200, "DUPLICADA");
  await caso("01-valido.json sin archivo CV", () => enviar({ token, datos: datosDe("01-valido.json", id("01b")) }), 202, "REQUIERE_REVISION");
  await caso("02-sin-correo.json + CV", () => enviar({ token, datos: datosDe("02-sin-correo.json", id("02")), archivo: camila }), 202, "REQUIERE_REVISION");
  await caso("03-falta-nombres.json", () => enviar({ token, datos: datosDe("03-falta-nombres.json", id("03")), archivo: camila }), 400, "INVALIDA");
  await caso("04-telefono-invalido.json", () => enviar({ token, datos: datosDe("04-telefono-invalido.json", id("04")), archivo: camila }), 400, "INVALIDA");
  await caso("05-con-fuente.json", () => enviar({ token, datos: datosDe("05-con-fuente.json", id("05")), archivo: camila }), 400, "INVALIDA");
  await caso("06-campo-desconocido.json", () => enviar({ token, datos: datosDe("06-campo-desconocido.json", id("06")), archivo: camila }), 400, "INVALIDA");
  await caso("07-version-no-soportada.json", () => enviar({ token, datos: datosDe("07-version-no-soportada.json", id("07")), archivo: camila }), 400, "INVALIDA");
  await caso("08-vacante-sin-correspondencia.json", () => enviar({ token, datos: datosDe("08-vacante-sin-correspondencia.json", id("08")), archivo: camila }), 422, "VACANTE_SIN_CORRESPONDENCIA");
  await caso("09-sha256-no-coincide.json + CV", () => enviar({ token, datos: datosDe("09-sha256-no-coincide.json", id("09")), archivo: camila }), 400, "INVALIDA");
  await caso("01-valido.json + no-es-pdf.pdf", () => enviar({ token, datos: datosDe("01-valido.json", id("10")), archivo: cv("no-es-pdf.pdf"), nombreArchivo: "no-es-pdf.pdf" }), 415, "NO_ES_PDF");
  await caso("01-valido.json + PDF de 5 MB + 1 byte", () => enviar({ token, datos: datosDe("01-valido.json", id("11")), archivo: Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(5 * 1024 * 1024 - 8, 0x20)]) }), 413, "DEMASIADO_GRANDE");
  await caso("Campo «datos» que no es JSON", () => enviar({ token, datos: "{esto no es json", archivo: camila }), 400, "INVALIDA");
  await caso("Cuerpo application/json (sin multipart)", () => enviar({ token, datos: datosDe("01-valido.json", id("12")), tipoCuerpo: "json" }), 400, "INVALIDA");
  await caso("Token inválido", () => enviar({ token: "pf_0000000000.no-es-un-token-valido-0000", datos: datosDe("01-valido.json", id("13")), archivo: camila }), 401, "NO_AUTORIZADO");
  await caso("Sin encabezado Authorization", () => enviar({ token: null, datos: datosDe("01-valido.json", id("14")), archivo: camila }), 401, "NO_AUTORIZADO");
  // 429: 60 peticiones por minuto por token. Se usa otro token y cuerpos inválidos (no crean nada).
  for (let i = 0; i < 60; i++) await enviar({ token: tokenLimite, datos: "{}" });
  const r429 = await caso("Petición 61 en un minuto (otro token)", () => enviar({ token: tokenLimite, datos: "{}" }), 429, "DEMASIADAS_PETICIONES");
  if (r429.retryAfter) filas[filas.length - 1].detalle += ` · Retry-After: ${r429.retryAfter} s`;

  // El válido debe llegar a Postulantes del Simulador BUK con el mismo SHA-256.
  let llegada = "no llegó en 60 s";
  if (r01.status === 202) {
    const ref = `postman-ejemplos:${id("01")}`;
    for (let i = 0; i < 600; i++) {
      const f = await dbT.query(
        `SELECT p."procesoId", e.nombre AS etapa, d.sha256, s.nombre, s.correo, s.telefono FROM "Postulacion" p JOIN "Etapa" e ON e.id = p."etapaId"
           JOIN "Postulante" s ON s.id = p."postulanteId" LEFT JOIN "Documento" d ON d.id = p."documentoId" WHERE p."referenciaExterna" = $1`,
        [ref],
      );
      if (f.rows[0]) {
        const x = f.rows[0];
        const mismo = x.sha256 === sha(camila);
        llegada = `proceso ${x.procesoId}, etapa «${x.etapa}», nombre «${x.nombre}», correo «${x.correo}», teléfono «${x.telefono}», SHA-256 ${mismo ? "igual al enviado" : "DISTINTO"}`;
        filas.push({ nombre: "01-valido.json aparece en el Simulador BUK", esperado: "Postulantes, mismo SHA-256", obtenido: x.etapa === "Postulantes" && mismo ? "sí" : "no", detalle: llegada, ok: x.etapa === "Postulantes" && mismo });
        break;
      }
      await esperar(100);
    }
  }
  console.log("");

  const fecha = new Date().toISOString();
  const md = [
    "# Resultados de los ejemplos de la entrada genérica",
    "",
    `> Generado por \`node scripts/probar-ejemplos.mjs\` el ${fecha} contra el Puente local (${PUENTE}, \`npm run dev\`, base \`tb2_dev\`).`,
    `> Fuente de prueba \`postman-ejemplos\`, vacante \`${VACANTE}\` → proceso ${PROCESO} del Simulador BUK. Los marcadores \`{{idUnico}}\` se reemplazaron por \`ej-${corrida}-<n>\`.`,
    "",
    "| # | Caso | Esperado | Obtenido | Detalle | ¿Coincide? |",
    "|---|---|---|---|---|---|",
    ...filas.map((f, i) => `| ${i + 1} | ${f.nombre} | ${f.esperado} | ${f.obtenido} | ${String(f.detalle).replaceAll("|", "\\|")} | ${f.ok ? "Sí" : "**No**"} |`),
    "",
    `**Total:** ${filas.filter((f) => f.ok).length} de ${filas.length} casos con el resultado esperado.`,
    "",
  ].join("\n");
  writeFileSync(path.join(RAIZ, "docs", "entrega", "postman", "resultados-ejemplos.md"), md);
  console.log(md);
  await dbP.end();
  await dbT.end();
  if (filas.some((f) => !f.ok)) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await dbP.end().catch(() => {});
  await dbT.end().catch(() => {});
  process.exit(1);
});

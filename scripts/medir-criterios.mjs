#!/usr/bin/env node
// Medición de los criterios de éxito del reto (entrega del 13/11/2026), en LOCAL y con datos ficticios.
//
//   1. Porcentaje de postulaciones registradas sin error en el ATS simulado (Simulador BUK).
//   2. Tiempo de registro por candidato: desde que el cliente envía la petición hasta que la postulación existe en la
//      etapa «Postulantes» del proceso (marca `creadaEn` de la postulación en el Simulador BUK; mismo reloj, misma máquina).
//   3. Porcentaje de campos mapeados correctamente: comparación campo por campo entre lo enviado y lo que quedó en el ATS.
//
// Cómo funciona (sin tocar el código del producto):
//   - Entrada genérica (JSON de la PostulacionCanonica v1 en el campo `datos` + PDF en `cv`, multipart): crea o renueva
//     la fuente `medicion-criterios` con un token nuevo y sus correspondencias directamente en la base local (equivale a
//     Puente → Fuentes → «Generar token» y → Correspondencias).
//   - Formulario público: crea (o reutiliza) el enlace público del proceso 9003 en la base local, abre la página para
//     obtener la marca de tiempo firmada, espera el mínimo de llenado y envía como lo haría el navegador.
//   - Fallos provocados: token inválido (401), JSON inválido (400), PDF falso (415), CV de más de 5 MB (413), vacante sin
//     correspondencia (422), duplicado (200), sin correo (revisión humana); en el formulario: sin autorización, PDF falso
//     y envío demasiado rápido. Se comprueba que se rechazan y que NO llegan al ATS.
//
// Requisitos: `npm run dev` encendido (3001–3003), el Puente conectado con el Simulador BUK (`npm run demo:bot` o
// Conexiones) y PostgreSQL local. Se niega con una base que no sea localhost.
//
// Uso:  node scripts/medir-criterios.mjs [--secuenciales 30] [--rafaga 10] [--salida docs/entrega/medicion]

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const N_SEC = Number(arg("secuenciales", "30"));
const N_RAFAGA = Number(arg("rafaga", "10"));
const SALIDA = path.resolve(RAIZ, arg("salida", "docs/entrega/medicion"));
const PUENTE = arg("puente", "http://localhost:3003");
const FUENTE = "medicion-criterios";
const PROCESOS = [9001, 9002];
const PROCESO_FORM = 9003;

const envDe = (app) => dotenv.parse(readFileSync(path.join(RAIZ, "apps", app, ".env")));
const urlPuente = envDe("puente").DATABASE_URL;
const urlTalentia = envDe("talentia").DATABASE_URL;
for (const u of [urlPuente, urlTalentia]) {
  const h = new URL(u).hostname;
  if (!["localhost", "127.0.0.1", "::1"].includes(h)) throw new Error(`Solo se mide contra una base local (host ${h}).`);
}
const dbP = new pg.Client({ connectionString: urlPuente, options: "-c search_path=puente" });
const dbT = new pg.Client({ connectionString: urlTalentia, options: "-c search_path=talentia" });

const sha = (b) => createHash("sha256").update(b).digest("hex");
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const CORRIDA = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
const CVS = ["cv-andres-prueba.pdf", "cv-camila-ejemplo.pdf", "cv-sofia-demo.pdf"].map((n) => {
  const bytes = readFileSync(path.join(RAIZ, "fixtures", "cv", n));
  return { nombre: n, bytes, sha256: sha(bytes), tamano: bytes.length };
});
const NO_PDF = readFileSync(path.join(RAIZ, "fixtures", "cv", "no-es-pdf.pdf"));

// Datos ficticios con variaciones que el Puente debe normalizar (espacios, mayúsculas, tildes, formatos de teléfono).
const NOMBRES = ["Ana María", "Juan  Pablo", "Sofía", "Andrés Felipe", "Camila", "Mateo", "Valeria", "Simón", "Isabella", "Tomás"];
const APELLIDOS = ["Gómez Ruiz", "Ortiz", " Peña Díaz ", "Muñoz", "Zapata Restrepo", "Londoño", "Arango", "Vélez", "Cárdenas", "Ríos"];
const CIUDADES = ["Medellín", "Itagüí", "Bello", "Envigado", "Bogotá", "Cali", "Rionegro", "Sabaneta", "La Estrella", "Barranquilla"];
const TELEFONOS = ["300 555 0101", "(310) 555-0102", "320.555.0103", "3015550104", "+57 315 555 0105"];

function caso(i, prefijo) {
  const nombres = NOMBRES[i % NOMBRES.length];
  const apellidos = APELLIDOS[(i * 3) % APELLIDOS.length];
  const tel = TELEFONOS[i % TELEFONOS.length];
  const correo = `${prefijo}-${CORRIDA}-${i}@Demo.Test`;
  const conPerfil = i % 2 === 0;
  return {
    nombres,
    apellidos,
    correo,
    telefono: tel,
    ciudad: CIUDADES[i % CIUDADES.length],
    perfilUrl: conPerfil ? `https://www.linkedin.com/in/persona-ficticia-${CORRIDA}-${i}` : undefined,
    cv: CVS[i % CVS.length],
  };
}

const limpio = (s) => s.replace(/\s+/g, " ").trim();
const e164 = (t) => {
  const d = t.replace(/[\s().\-/]/g, "");
  return d.startsWith("+") ? d : `+57${d}`;
};

// ───────────── Preparación (base local) ─────────────

async function prepararFuente() {
  const conexion = await dbP.query(`SELECT "estadoPrueba" FROM "Conexion" WHERE tipo = 'TALENTIA'`);
  if (!conexion.rows.length) throw new Error("El Puente no tiene conexión con el Simulador BUK: ejecuta `npm run demo:bot` (o Conexiones).");
  const prefijo = randomBytes(5).toString("hex");
  const token = `pf_${prefijo}.${randomBytes(32).toString("base64url")}`;
  await dbP.query(
    `INSERT INTO "Fuente"(id, nombre, descripcion, sistema, "tokenHash", "tokenPrefijo", activa, "creadaEn", "actualizadaEn")
     VALUES (gen_random_uuid(), $1, 'Medición de criterios de éxito (script local)', false, $2, $3, true, now(), now())
     ON CONFLICT (nombre) DO UPDATE SET "tokenHash" = $2, "tokenPrefijo" = $3, activa = true, "revocadaEn" = null, "actualizadaEn" = now()`,
    [FUENTE, sha(token), prefijo],
  );
  for (const p of PROCESOS) {
    await dbP.query(
      `INSERT INTO "Correspondencia"(id, fuente, "vacanteExterna", "externalJobId", "procesoAtsId", descripcion, activa, "creadaEn", "actualizadaEn", demo)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, now(), now(), true)
       ON CONFLICT ("externalJobId") DO UPDATE SET activa = true, "cerradaEn" = null, "procesoAtsId" = $4`,
      [FUENTE, `VAC-MED-${p}`, `${FUENTE}:VAC-MED-${p}`, p, `Medición → proceso ${p}`],
    );
  }
  return token;
}

async function prepararFormulario() {
  await dbP.query(
    `INSERT INTO "Fuente"(id, nombre, descripcion, sistema, activa, "creadaEn", "actualizadaEn")
     VALUES (gen_random_uuid(), 'formulario-publico', 'Formulario público del Puente (enlace externo en la oferta)', true, true, now(), now())
     ON CONFLICT (nombre) DO NOTHING`,
  );
  const ex = await dbP.query(`SELECT "vacanteExterna" FROM "Correspondencia" WHERE fuente = 'formulario-publico' AND "procesoAtsId" = $1`, [PROCESO_FORM]);
  let codigo = ex.rows[0]?.vacanteExterna;
  if (!codigo) {
    const alf = "abcdefghijkmnpqrstuvwxyz23456789";
    codigo = Array.from(randomBytes(12), (b) => alf[b % alf.length]).join("");
    await dbP.query(
      `INSERT INTO "Correspondencia"(id, fuente, "vacanteExterna", "externalJobId", "procesoAtsId", descripcion, activa, "creadaEn", "actualizadaEn", demo)
       VALUES (gen_random_uuid(), 'formulario-publico', $1, $2, $3, 'Medición (formulario)', true, now(), now(), false)`,
      [codigo, `formulario-publico:${codigo}`, PROCESO_FORM],
    );
  } else {
    await dbP.query(`UPDATE "Correspondencia" SET activa = true, "cerradaEn" = null WHERE "externalJobId" = $1`, [`formulario-publico:${codigo}`]);
  }
  return codigo;
}

// ───────────── Envíos ─────────────

function cuerpoGenerico(c, vacante, extra = {}) {
  const datos = {
    version: "1",
    idExterno: `${CORRIDA}-${c.correo.split("@")[0]}`,
    vacanteExterna: vacante,
    recibidaEn: new Date().toISOString(),
    candidato: { nombres: c.nombres, apellidos: c.apellidos, ...(c.correo ? { correo: c.correo } : {}), telefono: c.telefono, ciudad: c.ciudad, ...(c.perfilUrl ? { perfilUrl: c.perfilUrl } : {}) },
    cv: { nombreArchivo: c.cv.nombre, tipo: "application/pdf", sha256: c.cv.sha256, bytes: c.cv.tamano },
    origenDatos: "fuente",
    ...extra,
  };
  return datos;
}

async function enviarGenerico(token, datos, cvBytes, nombre = "cv.pdf", textoDatos) {
  const fd = new FormData();
  fd.set("datos", textoDatos ?? JSON.stringify(datos));
  if (cvBytes) fd.set("cv", new Blob([cvBytes], { type: "application/pdf" }), nombre);
  const t0 = Date.now();
  const r = await fetch(`${PUENTE}/api/entradas/v1/postulaciones`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
  return { t0, status: r.status, cuerpo: await r.json().catch(() => ({})) };
}

let ipFalsa = 0;
async function enviarFormulario(codigo, c, { autorizacion = true, cv = c.cv.bytes, esperarMs = 3200 } = {}) {
  // Cada envío del formulario se identifica con una IP distinta (encabezado que el Puente lee en local; ver D-76).
  const ip = `198.51.100.${++ipFalsa}`;
  const pagina = await (await fetch(`${PUENTE}/postular/${codigo}`, { headers: { "X-Forwarded-For": ip } })).text();
  const t = /name="t"[^>]*value="([^"]+)"|value="([^"]+)"[^>]*name="t"/.exec(pagina);
  if (!t) throw new Error("No se encontró la marca de tiempo del formulario.");
  await esperar(esperarMs);
  const fd = new FormData();
  fd.set("t", t[1] ?? t[2]);
  fd.set("campo_auxiliar", "");
  fd.set("nombres", c.nombres);
  fd.set("apellidos", c.apellidos);
  fd.set("correo", c.correo);
  fd.set("indicativo", "+57");
  fd.set("telefono", c.telefono.replace(/^\+57\s*/, ""));
  fd.set("ciudad", c.ciudad);
  if (c.perfilUrl) fd.set("perfil", c.perfilUrl);
  if (autorizacion) fd.set("autorizacion", "si");
  fd.set("cv", new Blob([cv], { type: "application/pdf" }), c.cv.nombre);
  const t0 = Date.now();
  const r = await fetch(`${PUENTE}/api/postular/${codigo}`, { method: "POST", headers: { Accept: "application/json", "X-Forwarded-For": ip }, body: fd });
  return { t0, status: r.status, cuerpo: await r.json().catch(() => ({})) };
}

// ───────────── Verificación en el ATS ─────────────

async function enAts(referencia) {
  const r = await dbT.query(
    `SELECT p.id, p."procesoId", p."creadaEn", e.nombre AS etapa, p.fuente, p."referenciaExterna" AS ref_postulacion,
            s.nombre, s.apellido, s.correo, s.telefono, s.ciudad, s."referenciaExterna" AS ref_postulante,
            d.sha256, d.tamano, d."nombreArchivo"
       FROM "Postulacion" p JOIN "Postulante" s ON s.id = p."postulanteId" JOIN "Etapa" e ON e.id = p."etapaId"
       LEFT JOIN "Documento" d ON d.id = p."documentoId"
      WHERE p."referenciaExterna" = $1`,
    [referencia],
  );
  return r.rows[0] ?? null;
}

async function esperarEnAts(referencia, maxMs = 180000) {
  const inicio = Date.now();
  while (Date.now() - inicio < maxMs) {
    const f = await enAts(referencia);
    if (f) return f;
    await esperar(100);
  }
  return null;
}

async function recepcion(fuente, idExterno) {
  const r = await dbP.query(`SELECT id, estado, "errorCodigo", "jobApplicationId" FROM "Recepcion" WHERE fuente = $1 AND "idExterno" = $2`, [fuente, idExterno]);
  return r.rows[0] ?? null;
}

function compararCampos(c, f, procesoEsperado) {
  const esperado = {
    nombre: limpio(c.nombres),
    apellido: limpio(c.apellidos),
    correo: c.correo.trim().toLowerCase(),
    telefono: e164(c.telefono),
    ciudad: limpio(c.ciudad),
    referencia_postulante: c.perfilUrl ?? f.ref_postulacion, // sin perfil, la referencia del Puente
    proceso: procesoEsperado,
    etapa: "Postulantes",
    cv_sha256: c.cv.sha256,
    cv_tamano: c.cv.tamano,
  };
  const real = {
    nombre: f.nombre,
    apellido: f.apellido,
    correo: f.correo,
    telefono: f.telefono,
    ciudad: f.ciudad,
    referencia_postulante: f.ref_postulante,
    proceso: f.procesoId,
    etapa: f.etapa,
    cv_sha256: f.sha256,
    cv_tamano: f.tamano,
  };
  return Object.keys(esperado).map((k) => ({ campo: k, esperado: esperado[k], real: real[k], ok: String(esperado[k]) === String(real[k]) }));
}

// ───────────── Corrida ─────────────

const registros = [];
const fallos = [];

async function medirGenerico(token, i, prefijo, modo) {
  const c = caso(i, prefijo);
  const proceso = PROCESOS[i % PROCESOS.length];
  const datos = cuerpoGenerico(c, `VAC-MED-${proceso}`);
  const env = await enviarGenerico(token, datos, c.cv.bytes, c.cv.nombre);
  return { c, proceso, datos, env, entrada: "entrada genérica (JSON + PDF)", modo, referencia: `${FUENTE}:${datos.idExterno}`, fuente: FUENTE, idExterno: datos.idExterno };
}

async function cerrar(m) {
  const fila = m.env.status === 202 && m.env.cuerpo.estado === "RECIBIDA" ? await esperarEnAts(m.referencia) : null;
  // El ATS crea la postulación un instante antes de que el Puente marque la recepción: se espera su estado final.
  let rec = await recepcion(m.fuente, m.idExterno);
  for (let i = 0; fila && i < 300 && rec && !["COMPLETADO", "RECHAZADO", "REQUIERE_VERIFICACION"].includes(rec.estado); i++) {
    await esperar(100);
    rec = await recepcion(m.fuente, m.idExterno);
  }
  const campos = fila ? compararCampos(m.c, fila, m.proceso) : [];
  registros.push({
    entrada: m.entrada,
    modo: m.modo,
    http: m.env.status,
    respuesta: m.env.cuerpo.estado ?? (m.env.cuerpo.ok ? "ok" : m.env.cuerpo.error),
    referencia: m.env.cuerpo.referencia ?? null,
    estadoPuente: rec?.estado ?? null,
    enAts: !!fila,
    etapa: fila?.etapa ?? null,
    ms: fila ? new Date(fila.creadaEn).getTime() - m.env.t0 : null,
    camposOk: campos.filter((x) => x.ok).length,
    camposTotal: campos.length,
    camposMal: campos.filter((x) => !x.ok),
  });
}

async function medirFormulario(codigo, i) {
  const c = caso(i, "form");
  const env = await enviarFormulario(codigo, c);
  const idExterno = createHash("sha256").update(`${codigo}:${c.correo.trim().toLowerCase()}`, "utf8").digest("hex").slice(0, 32);
  return { c, proceso: PROCESO_FORM, env: { ...env, status: env.status === 200 && env.cuerpo.ok ? 202 : env.status, cuerpo: { ...env.cuerpo, estado: env.cuerpo.ok ? "RECIBIDA" : env.cuerpo.error } }, entrada: "formulario público", modo: "secuencial", referencia: `formulario-publico:${idExterno}`, fuente: "formulario-publico", idExterno };
}

async function provocado(nombre, esperadoHttp, fn, verificar) {
  const r = await fn();
  const llegó = verificar ? await verificar(r) : false;
  fallos.push({ caso: nombre, esperado: esperadoHttp, http: r.status, respuesta: r.cuerpo.estado ?? r.cuerpo.error ?? "", llegoAlAts: llegó, ok: r.status === esperadoHttp && !llegó });
}

async function main() {
  await dbP.connect();
  await dbT.connect();
  const token = await prepararFuente();
  const codigo = await prepararFormulario();
  const inicio = new Date();
  console.log(`Corrida ${CORRIDA}: ${N_SEC} secuenciales + ${N_RAFAGA} en ráfaga + 5 por formulario + fallos provocados.`);

  // A. Secuenciales: una postulación, se espera a que aparezca en Postulantes, la siguiente.
  for (let i = 0; i < N_SEC; i++) {
    await cerrar(await medirGenerico(token, i, "seq", "secuencial"));
    process.stdout.write(".");
  }
  // B. Ráfaga: N envíos a la vez (cola del worker).
  const rafaga = await Promise.all(Array.from({ length: N_RAFAGA }, (_, k) => medirGenerico(token, 100 + k, "raf", "ráfaga")));
  for (const m of rafaga) await cerrar(m);
  process.stdout.write("R");
  // C. Formulario público (5 envíos válidos).
  for (let i = 0; i < 5; i++) {
    await cerrar(await medirFormulario(codigo, 200 + i));
    process.stdout.write("F");
  }
  console.log("");

  // D. Fallos provocados: deben rechazarse (o quedar en revisión) y no llegar al ATS.
  const base = caso(300, "fallo");
  const noLlega = async (ref) => !!(await enAts(ref));
  await provocado("Token inválido", 401, () => enviarGenerico("pf_0000000000.tokeninvalidotokeninvalido", cuerpoGenerico(base, "VAC-MED-9001"), base.cv.bytes));
  await provocado("«datos» no es JSON", 400, () => enviarGenerico(token, null, base.cv.bytes, "cv.pdf", "{esto no es json"));
  await provocado("Falta candidato.nombres", 400, () => {
    const d = cuerpoGenerico({ ...base, nombres: "" }, "VAC-MED-9001");
    delete d.candidato.nombres;
    return enviarGenerico(token, d, base.cv.bytes);
  });
  await provocado("PDF falso", 415, () => enviarGenerico(token, cuerpoGenerico(caso(301, "fallo"), "VAC-MED-9001", { cv: undefined }), NO_PDF, "falso.pdf"));
  await provocado("CV de más de 5 MB", 413, () => {
    const grande = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(5 * 1024 * 1024 + 10, 0x20)]);
    return enviarGenerico(token, cuerpoGenerico(caso(302, "fallo"), "VAC-MED-9001", { cv: undefined }), grande, "grande.pdf");
  });
  await provocado("Vacante sin correspondencia", 422, () => enviarGenerico(token, cuerpoGenerico(caso(303, "fallo"), "VAC-NO-EXISTE"), caso(303, "fallo").cv.bytes));
  const dup = cuerpoGenerico(caso(0, "seq"), "VAC-MED-9001"); // mismo idExterno que el primer envío secuencial
  await provocado("Duplicado (mismo idExterno)", 200, () => enviarGenerico(token, dup, CVS[0].bytes));
  const sinCorreo = { ...caso(304, "fallo"), correo: "" };
  const dSin = cuerpoGenerico(sinCorreo, "VAC-MED-9001");
  await provocado("Sin correo → revisión humana (202, no va al ATS)", 202, () => enviarGenerico(token, dSin, sinCorreo.cv.bytes), async () => {
    await esperar(3000);
    return noLlega(`${FUENTE}:${dSin.idExterno}`);
  });
  // Formulario: el mismo correo en la misma vacante = misma postulación (misma referencia; una sola en el ATS).
  {
    const c0 = caso(200, "form");
    const r = await enviarFormulario(codigo, c0);
    const primera = registros.find((x) => x.entrada === "formulario público");
    const idEx = createHash("sha256").update(`${codigo}:${c0.correo.trim().toLowerCase()}`, "utf8").digest("hex").slice(0, 32);
    const n = await dbT.query(`SELECT count(*)::int AS n FROM "Postulacion" WHERE "referenciaExterna" = $1`, [`formulario-publico:${idEx}`]);
    fallos.push({
      caso: "Formulario: segundo envío con el mismo correo",
      esperado: 200,
      http: r.status,
      respuesta: `referencia ${r.cuerpo.referencia} (primera: ${primera?.referencia ?? "?"}); postulaciones en el ATS: ${n.rows[0].n}`,
      llegoAlAts: n.rows[0].n !== 1,
      ok: r.status === 200 && r.cuerpo.ok === true && r.cuerpo.referencia === primera?.referencia && n.rows[0].n === 1,
    });
  }
  const cf = caso(305, "form");
  await provocado("Formulario sin autorización", 422, () => enviarFormulario(codigo, cf, { autorizacion: false }));
  await provocado("Formulario con PDF falso", 415, () => enviarFormulario(codigo, caso(306, "form"), { cv: NO_PDF }));
  await provocado("Formulario enviado en menos de 3 s", 422, () => enviarFormulario(codigo, caso(307, "form"), { esperarMs: 200 }));

  // Contar ATS: cuántas postulaciones de esta corrida hay (para descartar duplicados).
  const enAtsCorrida = await dbT.query(`SELECT count(*)::int AS n FROM "Postulacion" p JOIN "Postulante" s ON s.id = p."postulanteId" WHERE s.correo LIKE $1`, [`%-${CORRIDA}-%@demo.test`]);
  const fin = new Date();

  // ───────────── Resultados ─────────────
  const validos = registros;
  const aceptados = validos.filter((r) => r.http === 202 && r.respuesta === "RECIBIDA");
  const sinError = validos.filter((r) => r.enAts && r.estadoPuente === "COMPLETADO" && r.etapa === "Postulantes");
  const tiempos = (filtro) => validos.filter(filtro).map((r) => r.ms).filter((x) => x !== null).sort((a, b) => a - b);
  const est = (xs) => {
    if (!xs.length) return null;
    const q = (p) => xs[Math.min(xs.length - 1, Math.ceil(p * xs.length) - 1)];
    const med = xs.length % 2 ? xs[(xs.length - 1) / 2] : (xs[xs.length / 2 - 1] + xs[xs.length / 2]) / 2;
    return { n: xs.length, minimo: xs[0], mediana: med, p90: q(0.9), maximo: xs[xs.length - 1] };
  };
  const camposOk = validos.reduce((s, r) => s + r.camposOk, 0);
  const camposTotal = validos.reduce((s, r) => s + r.camposTotal, 0);
  const resultado = {
    corrida: CORRIDA,
    inicio: inicio.toISOString(),
    fin: fin.toISOString(),
    entorno: {
      descripcion: "Local: npm run dev (Puente :3003, Simulador BUK :3002, workers dentro del proceso), PostgreSQL local, base tb2_dev",
      node: process.version,
      plataforma: `${process.platform} ${process.arch}`,
    },
    criterio1: { enviosValidos: validos.length, aceptados: aceptados.length, registradosSinError: sinError.length, porcentaje: +((100 * sinError.length) / validos.length).toFixed(1) },
    criterio2: {
      todos: est(tiempos(() => true)),
      secuencial: est(tiempos((r) => r.modo === "secuencial" && r.entrada.startsWith("entrada"))),
      rafaga: est(tiempos((r) => r.modo === "ráfaga")),
      formulario: est(tiempos((r) => r.entrada === "formulario público")),
    },
    criterio3: { camposComparados: camposTotal, camposCorrectos: camposOk, porcentaje: camposTotal ? +((100 * camposOk) / camposTotal).toFixed(1) : null, camposPorPostulacion: validos[0]?.camposTotal ?? 0 },
    fallosProvocados: fallos,
    postulacionesDeLaCorridaEnAts: enAtsCorrida.rows[0].n,
    detalle: registros,
  };

  mkdirSync(SALIDA, { recursive: true });
  writeFileSync(path.join(SALIDA, `medicion-${CORRIDA}.json`), JSON.stringify(resultado, null, 2));
  console.log(JSON.stringify({ ...resultado, detalle: undefined }, null, 2));
  await dbP.end();
  await dbT.end();
}

main().catch(async (e) => {
  console.error(e);
  await dbP.end().catch(() => {});
  await dbT.end().catch(() => {});
  process.exit(1);
});

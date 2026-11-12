#!/usr/bin/env node
// Genera docs/entrega/postman/puente-entrada-generica.postman_collection.json desde los ejemplos de
// docs/entrega/postman/ejemplos/. Sin tokens reales: la variable «token» trae un marcador que se reemplaza en Postman.
// Uso: node scripts/generar-postman.mjs

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(RAIZ, "docs", "entrega", "postman");
const ej = (n) => readFileSync(path.join(DIR, "ejemplos", n), "utf8");

const idNuevo = { listen: "prerequest", script: { type: "text/javascript", exec: ["pm.collectionVariables.set('idUnico', 'postman-' + Date.now());"] } };
const prueba = (status, estado) => ({
  listen: "test",
  script: {
    type: "text/javascript",
    exec: [
      `pm.test('HTTP ${status}', () => pm.response.to.have.status(${status}));`,
      ...(estado ? [`pm.test('estado ${estado}', () => pm.expect(pm.response.json().estado).to.eql('${estado}'));`] : []),
    ],
  },
});

function solicitud(nombre, descripcion, { datos, cv = "fixtures/cv/cv-camila-ejemplo.pdf", status, estado, nuevoId = true, auth = "{{token}}" }) {
  const formdata = [];
  if (datos !== undefined) formdata.push({ key: "datos", type: "text", value: datos, description: "PostulacionCanonica v1 sin «fuente» (JSON)" });
  if (cv) formdata.push({ key: "cv", type: "file", src: cv, description: "PDF de hasta 5 MB (ruta relativa a la raíz del repositorio)" });
  return {
    name: nombre,
    event: [...(nuevoId ? [idNuevo] : []), prueba(status, estado)],
    request: {
      method: "POST",
      header: auth ? [{ key: "Authorization", value: `Bearer ${auth}` }] : [],
      body: { mode: "formdata", formdata },
      url: { raw: "{{baseUrl}}/api/entradas/v1/postulaciones", host: ["{{baseUrl}}"], path: ["api", "entradas", "v1", "postulaciones"] },
      description: descripcion,
    },
  };
}

const coleccion = {
  info: {
    name: "Puente de postulaciones · entrada genérica (V4)",
    description:
      "Entrada genérica del Puente: POST /api/entradas/v1/postulaciones (multipart: «datos» = JSON de la PostulacionCanonica v1 sin «fuente»; «cv» = PDF ≤ 5 MB). Contrato: docs/contratos.md §8. Guía: docs/entrega/postman/GUIA.md.\n\nAntes de usarla: Puente → Fuentes → crear una fuente y «Generar token»; Puente → Correspondencias → vincular la vacante {{vacanteExterna}} de esa fuente a un proceso del Simulador BUK. Pega el token en la variable «token» (nunca lo guardes en el repositorio). En Postman → Settings → Working directory = la raíz del repositorio, para que encuentre fixtures/cv/*.pdf.\n\nTodo es simulado y con datos ficticios (@demo.test).",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  variable: [
    { key: "baseUrl", value: "http://localhost:3003", description: "Puente local (o https://puente-postulaciones.onrender.com)" },
    { key: "token", value: "PEGA_AQUI_EL_TOKEN_DE_LA_FUENTE", description: "Token de la fuente (Puente → Fuentes). Se muestra una sola vez." },
    { key: "vacanteExterna", value: "VAC-DEMO-1", description: "Vacante de la fuente vinculada en Correspondencias" },
    { key: "idUnico", value: "", description: "Lo pone cada solicitud antes de enviarse (postman-<timestamp>)" },
  ],
  item: [
    {
      name: "Válidos",
      item: [
        solicitud("01 · Válida con CV → 202 RECIBIDA", "Llega a Postulantes del proceso vinculado.", { datos: ej("01-valido.json"), status: 202, estado: "RECIBIDA" }),
        solicitud("01 bis · Repetir la anterior → 200 DUPLICADA", "Mismo idExterno: no se crea nada. Ejecutar justo después de la 01.", { datos: ej("01-valido.json"), status: 200, estado: "DUPLICADA", nuevoId: false }),
        solicitud("02 · Sin correo → 202 REQUIERE_REVISION", "Queda en revisión humana (Operaciones).", { datos: ej("02-sin-correo.json"), status: 202, estado: "REQUIERE_REVISION" }),
        solicitud("01 sin CV → 202 REQUIERE_REVISION", "Sin la parte «cv»: motivo sin_cv.", { datos: ej("01-valido.json"), cv: null, status: 202, estado: "REQUIERE_REVISION" }),
        {
          name: "Vacantes de la fuente → 200",
          event: [prueba(200)],
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{token}}" }],
            url: { raw: "{{baseUrl}}/api/entradas/v1/vacantes", host: ["{{baseUrl}}"], path: ["api", "entradas", "v1", "vacantes"] },
            description: "Correspondencias activas de la fuente del token.",
          },
        },
      ],
    },
    {
      name: "Inválidos",
      item: [
        solicitud("03 · Falta candidato.nombres → 400", "", { datos: ej("03-falta-nombres.json"), status: 400, estado: "INVALIDA" }),
        solicitud("04 · Teléfono inválido → 400", "", { datos: ej("04-telefono-invalido.json"), status: 400, estado: "INVALIDA" }),
        solicitud("05 · Trae «fuente» en el cuerpo → 400", "La fuente la fija el token.", { datos: ej("05-con-fuente.json"), status: 400, estado: "INVALIDA" }),
        solicitud("06 · Campo desconocido → 400", "El contrato es estricto.", { datos: ej("06-campo-desconocido.json"), status: 400, estado: "INVALIDA" }),
        solicitud("07 · Versión 2 → 400", "", { datos: ej("07-version-no-soportada.json"), status: 400, estado: "INVALIDA" }),
        solicitud("08 · Vacante sin correspondencia → 422", "", { datos: ej("08-vacante-sin-correspondencia.json"), status: 422, estado: "VACANTE_SIN_CORRESPONDENCIA" }),
        solicitud("09 · SHA-256 declarado distinto → 400", "", { datos: ej("09-sha256-no-coincide.json"), status: 400, estado: "INVALIDA" }),
        solicitud("10 · Archivo que no es PDF → 415", "", { datos: ej("01-valido.json"), cv: "fixtures/cv/no-es-pdf.pdf", status: 415, estado: "NO_ES_PDF" }),
        solicitud("11 · Token inválido → 401", "", { datos: ej("01-valido.json"), status: 401, estado: "NO_AUTORIZADO", auth: "pf_0000000000.no-es-un-token-valido-0000" }),
        solicitud("12 · Sin Authorization → 401", "", { datos: ej("01-valido.json"), status: 401, estado: "NO_AUTORIZADO", auth: null }),
      ],
      description:
        "413 (CV de más de 5 MB) y 429 (más de 60 peticiones por minuto por token) no van como solicitud fija: 413 necesita un PDF grande (ver GUIA.md) y 429 se provoca con el Runner (61 iteraciones). Ambos se comprobaron con scripts/probar-ejemplos.mjs.",
    },
  ],
};

writeFileSync(path.join(DIR, "puente-entrada-generica.postman_collection.json"), JSON.stringify(coleccion, null, 2) + "\n");
console.log("Colección escrita en docs/entrega/postman/puente-entrada-generica.postman_collection.json");

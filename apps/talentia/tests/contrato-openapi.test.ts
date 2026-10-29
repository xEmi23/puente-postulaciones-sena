import { createHash } from "node:crypto";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { beforeAll, describe, expect, it } from "vitest";
import { EJEMPLOS_SOLICITUD } from "@/modules/api/openapi";
import { api, fetchEnProceso, formularioCv, leerCv, nuevaLlave, reiniciarBd } from "./utilidades";

// Criterio 3 · prueba de contrato: el documento /api/openapi.json (lo que ve quien lee /apidocs) coincide con la implementación.
// 1) cada ejemplo documentado cumple su propio esquema; 2) cada ejemplo de solicitud se ejecuta contra las rutas reales;
// 3) cada respuesta real cumple el esquema documentado para su código de estado (y ese código está documentado).

type Doc = {
  paths: Record<string, Record<string, { requestBody?: { content: Record<string, { schema: object; example?: unknown }> }; responses: Record<string, { content?: Record<string, { schema: object; example?: unknown }> }> }>>;
  components: { schemas: Record<string, object>; securitySchemes: Record<string, { name: string; in: string }> };
};

let doc: Doc;
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv as unknown as Parameters<typeof addFormats>[0]);

beforeAll(async () => {
  await reiniciarBd();
  doc = (await (await fetchEnProceso("http://talentia.test/api/openapi.json")).json()) as Doc;
  ajv.addSchema({ $id: "doc", components: doc.components }, "doc");
});

const conRefs = (s: object) => JSON.parse(JSON.stringify(s).replaceAll('"#/components/', '"doc#/components/'));
function validar(schema: object, valor: unknown) {
  const v = ajv.compile(conRefs(schema));
  return v(valor) ? [] : (v.errors ?? []).map((e) => `${e.instancePath} ${e.message}`);
}
function esquemaRespuesta(ruta: string, metodo: string, status: number) {
  const r = doc.paths[ruta]?.[metodo]?.responses[String(status)];
  if (!r) throw new Error(`${metodo.toUpperCase()} ${ruta} responde ${status}, pero ese código no está documentado`);
  return r.content!["application/json"].schema;
}
async function comprobar(metodo: string, plantilla: string, ruta: string, llave: string, cuerpo?: unknown) {
  const r = await api(metodo.toUpperCase(), ruta, llave, cuerpo);
  expect(validar(esquemaRespuesta(plantilla, metodo, r.status), r.body), `${metodo} ${ruta} (${r.status})`).toEqual([]);
  return r;
}

describe("criterio 3 · /api/openapi.json frente a la implementación", () => {
  it("es OpenAPI 3.1 con la API Key en el encabezado auth_token", () => {
    expect((doc as unknown as { openapi: string }).openapi).toBe("3.1.0");
    expect(doc.components.securitySchemes.ApiKey).toMatchObject({ in: "header", name: "auth_token" });
  });

  it("todos los ejemplos documentados (solicitudes y respuestas) cumplen su esquema", () => {
    let revisados = 0;
    for (const [ruta, metodos] of Object.entries(doc.paths)) {
      for (const [metodo, op] of Object.entries(metodos)) {
        const json = op.requestBody?.content["application/json"];
        if (json?.example !== undefined) {
          expect(validar(json.schema, json.example), `${metodo} ${ruta} solicitud`).toEqual([]);
          revisados++;
        }
        for (const [status, resp] of Object.entries(op.responses)) {
          const c = resp.content?.["application/json"];
          if (c?.example === undefined) continue;
          expect(validar(c.schema, c.example), `${metodo} ${ruta} ${status}`).toEqual([]);
          revisados++;
        }
      }
    }
    expect(revisados).toBeGreaterThan(40);
  });

  it("los ejemplos de solicitud funcionan contra la API real y las respuestas cumplen lo documentado", async () => {
    const llave = await nuevaLlave();
    const S = "/api/v1/seleccion";
    await comprobar("get", `${S}/procesos`, `${S}/procesos`, llave);
    await comprobar("get", `${S}/procesos/{id}`, `${S}/procesos/9001`, llave);
    await comprobar("get", `${S}/procesos/{id}`, `${S}/procesos/1`, llave);
    expect((await comprobar("post", `${S}/procesos`, `${S}/procesos`, llave, EJEMPLOS_SOLICITUD.crearProceso)).status).toBe(201);
    await comprobar("post", `${S}/procesos`, `${S}/procesos`, llave, { titulo: "x" });

    const p = await comprobar("post", `${S}/postulantes`, `${S}/postulantes`, llave, EJEMPLOS_SOLICITUD.crearPostulante);
    expect(p.status).toBe(201);
    const id = p.body.data.id as string;
    expect((await comprobar("post", `${S}/postulantes`, `${S}/postulantes`, llave, EJEMPLOS_SOLICITUD.crearPostulante)).status).toBe(409);
    await comprobar("get", `${S}/postulantes`, `${S}/postulantes?email=${EJEMPLOS_SOLICITUD.crearPostulante.correo}`, llave);
    await comprobar("get", `${S}/postulantes/{id}`, `${S}/postulantes/${id}`, llave);
    expect((await comprobar("patch", `${S}/postulantes/{id}`, `${S}/postulantes/${id}`, llave, EJEMPLOS_SOLICITUD.actualizarPostulante)).status).toBe(200);

    const cv = leerCv();
    const sha = createHash("sha256").update(cv).digest("hex");
    const d = await api("POST", `${S}/postulantes/${id}/documentos`, llave, formularioCv(cv, sha));
    expect(validar(esquemaRespuesta(`${S}/postulantes/{id}/documentos`, "post", d.status), d.body)).toEqual([]);
    const d422 = await api("POST", `${S}/postulantes/${id}/documentos`, llave, formularioCv(cv, "0".repeat(64)));
    expect(validar(esquemaRespuesta(`${S}/postulantes/{id}/documentos`, "post", d422.status), d422.body)).toEqual([]);
    await comprobar("get", `${S}/postulantes/{id}/documentos`, `${S}/postulantes/${id}/documentos`, llave);

    const ejemplo = { ...EJEMPLOS_SOLICITUD.crearPostulacion, postulante_id: id, documento_id: d.body.data.id };
    const post = await comprobar("post", `${S}/postulaciones`, `${S}/postulaciones`, llave, ejemplo);
    expect(post.status).toBe(201);
    expect((await comprobar("post", `${S}/postulaciones`, `${S}/postulaciones`, llave, ejemplo)).status).toBe(200);
    await comprobar("get", `${S}/postulaciones`, `${S}/postulaciones?referencia_externa=${encodeURIComponent(ejemplo.referencia_externa)}`, llave);
    await comprobar("get", `${S}/postulaciones/{id}`, `${S}/postulaciones/${post.body.data.id}`, llave);
    const m = await comprobar("patch", `${S}/postulaciones/{id}`, `${S}/postulaciones/${post.body.data.id}`, llave, EJEMPLOS_SOLICITUD.moverPostulacion);
    expect(m.body.data.etapa.nombre).toBe(EJEMPLOS_SOLICITUD.moverPostulacion.etapa);
    await comprobar("get", "/api/v1/api-key", "/api/v1/api-key", llave);

    // Errores documentados en todas las operaciones: 401 y 403.
    const r401 = await api("GET", `${S}/procesos`, null);
    expect(validar(esquemaRespuesta(`${S}/procesos`, "get", r401.status), r401.body)).toEqual([]);
    const r403 = await api("POST", `${S}/postulantes`, await nuevaLlave({ lectura: true }), EJEMPLOS_SOLICITUD.crearPostulante);
    expect(validar(esquemaRespuesta(`${S}/postulantes`, "post", r403.status), r403.body)).toEqual([]);
  });

  it("documenta todas las rutas de la API v1 que existen", () => {
    expect(Object.keys(doc.paths).sort()).toEqual(
      [
        "/api/v1/api-key",
        "/api/v1/seleccion/postulaciones",
        "/api/v1/seleccion/postulaciones/{id}",
        "/api/v1/seleccion/postulantes",
        "/api/v1/seleccion/postulantes/{id}",
        "/api/v1/seleccion/postulantes/{id}/documentos",
        "/api/v1/seleccion/procesos",
        "/api/v1/seleccion/procesos/{id}",
      ].sort(),
    );
  });
});

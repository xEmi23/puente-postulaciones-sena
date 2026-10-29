import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { beforeEach, describe, expect, it } from "vitest";
import { EJEMPLOS } from "@/modules/api/openapi";
import { aplicacionIntegrador, api, empresaAndina, fetchEnProceso, pedirToken, publicarVacante, reiniciarBd, solicitar } from "./utilidades";

// Criterio 3 (Vínculo) · prueba de contrato: /api/openapi.json (lo que muestra /developers/docs) frente a la implementación.

type Op = { requestBody?: { content: Record<string, { schema: object; example?: unknown }> }; responses: Record<string, { content?: Record<string, { schema: object; example?: unknown }> }> };
type Doc = { paths: Record<string, Record<string, Op>>; webhooks: Record<string, Record<string, Op>>; components: { schemas: Record<string, object> } };

let doc: Doc;
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv as unknown as Parameters<typeof addFormats>[0]);

beforeEach(async () => {
  await reiniciarBd();
  if (!doc) {
    doc = (await (await fetchEnProceso("http://vinculo.test/api/openapi.json")).json()) as Doc;
    ajv.addSchema({ $id: "doc", components: doc.components }, "doc");
  }
});

const conRefs = (s: object) => JSON.parse(JSON.stringify(s).replaceAll('"#/components/', '"doc#/components/'));
function validar(schema: object, valor: unknown) {
  const v = ajv.compile(conRefs(schema));
  return v(valor) ? [] : (v.errors ?? []).map((e) => `${e.instancePath} ${e.message}`);
}
function esquema(ruta: string, metodo: string, status: number) {
  const r = doc.paths[ruta]?.[metodo]?.responses[String(status)];
  if (!r) throw new Error(`${metodo.toUpperCase()} ${ruta} responde ${status}, pero no está documentado`);
  return r.content!["application/json"].schema;
}

describe("contrato OpenAPI de Vínculo", () => {
  it("todos los ejemplos documentados (rutas y webhooks) cumplen su esquema", () => {
    let n = 0;
    for (const grupo of [doc.paths, doc.webhooks]) {
      for (const [ruta, metodos] of Object.entries(grupo)) {
        for (const [metodo, op] of Object.entries(metodos)) {
          for (const c of Object.values(op.requestBody?.content ?? {})) {
            if (c.example === undefined) continue;
            expect(validar(c.schema, c.example), `${metodo} ${ruta} solicitud`).toEqual([]);
            n++;
          }
          for (const [status, r] of Object.entries(op.responses)) {
            const c = r.content?.["application/json"];
            if (c?.example === undefined) continue;
            expect(validar(c.schema, c.example), `${metodo} ${ruta} ${status}`).toEqual([]);
            n++;
          }
        }
      }
    }
    expect(n).toBeGreaterThan(20);
  });

  it("las respuestas reales cumplen lo documentado para su código de estado", async () => {
    const int = await aplicacionIntegrador();
    const tok = await pedirToken(int.clientId, int.clientSecret);
    expect(validar(esquema("/oauth/v2/accessToken", "post", tok.status), tok.body)).toEqual([]);
    const mal = await pedirToken(int.clientId, "x");
    expect(validar(esquema("/oauth/v2/accessToken", "post", mal.status), mal.body)).toEqual([]);
    const t = tok.body.access_token as string;

    const aut = await api("GET", "/api/v1/autorizaciones", t);
    expect(validar(esquema("/api/v1/autorizaciones", "get", aut.status), aut.body)).toEqual([]);

    const ejemplo = { ...EJEMPLOS.jobPosting, companyId: (await empresaAndina()).id, onsiteApply: { jobApplicationWebhookUrl: int.webhook.url } };
    const pub = await api("POST", "/api/v1/jobPostings", t, ejemplo);
    expect(pub.status).toBe(201);
    expect(validar(esquema("/api/v1/jobPostings", "post", pub.status), pub.body)).toEqual([]);
    const otra = await api("POST", "/api/v1/jobPostings", t, ejemplo);
    expect(validar(esquema("/api/v1/jobPostings", "post", otra.status), otra.body)).toEqual([]);
    const sinToken = await api("POST", "/api/v1/jobPostings", null, ejemplo);
    expect(validar(esquema("/api/v1/jobPostings", "post", sinToken.status), sinToken.body)).toEqual([]);

    const r = await solicitar((pub.body as { id: string }).id);
    const lc = await api("POST", `/api/v1/jobApplications/${encodeURIComponent(r.jobApplicationId)}/lifecycle`, t, EJEMPLOS.lifecycle);
    expect(validar(esquema("/api/v1/jobApplications/{jobApplicationId}/lifecycle", "post", lc.status), lc.body)).toEqual([]);

    const cierre = await api("POST", `/api/v1/jobPostings/${ejemplo.externalJobId}/close`, t);
    expect(validar(esquema("/api/v1/jobPostings/{externalJobId}/close", "post", cierre.status), cierre.body)).toEqual([]);
    const otraApp = await publicarVacante(await aplicacionIntegrador({ autorizar: false }));
    expect(validar(esquema("/api/v1/jobPostings", "post", otraApp.respuesta.status), otraApp.respuesta.body)).toEqual([]);
  });
});

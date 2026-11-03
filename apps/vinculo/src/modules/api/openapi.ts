import { z } from "zod";
import { esquemaJobPosting } from "@/modules/vacantes";
import { esquemaJobPostingRespuesta } from "./vistas";

// OpenAPI 3.1 de la API de Vínculo, generado desde los mismos esquemas Zod que usa la implementación.
// CONTRATO DEL SIMULADOR modelado sobre Apply Connect de LinkedIn: el formato de la entrega, la firma X-LI-Signature,
// el desafío del webhook, los códigos de error y el mediaUrl con Bearer siguen la documentación pública (Verificado,
// docs/contratos.md §1); las rutas de token, jobPostings, cierre, autorizaciones y ciclo de vida son nuestras.
// Lo prueba tests/contrato-openapi.test.ts.

const js = (s: z.ZodType, io: "input" | "output" = "output") => {
  const esquema = z.toJSONSchema(s, { io, unrepresentable: "any" }) as Record<string, unknown>;
  delete esquema.$schema;
  return esquema;
};
const ref = (n: string) => ({ $ref: `#/components/schemas/${n}` });
const err = (descripcion: string, code: string, message: string, status: number) => ({
  description: descripcion,
  content: { "application/json": { schema: ref("Error"), example: { status, code, message } } },
});
const no401 = { 401: err("Access token ausente, vencido o de una aplicación revocada.", "INVALID_ACCESS_TOKEN", "El access token falta, venció o no es válido.", 401) };

export const EJEMPLOS = {
  token: { grant_type: "client_credentials", client_id: "vin_3f9a1c7e2b4d6a80", client_secret: "<se muestra una sola vez al crear la aplicación>" },
  jobPosting: {
    externalJobId: "9003",
    companyId: "6f1d2c3b-4a5e-4f60-8a71-b2c3d4e5f601",
    title: "Desarrollador/a Frontend React",
    description: "Construirás interfaces accesibles con React y Next.js junto a un equipo ágil. Vacante ficticia.",
    location: "Bogotá",
    workplaceType: "HYBRID",
    employmentType: "FULL_TIME",
    experienceLevel: "MID_SENIOR_LEVEL",
    listingType: "BASIC",
    onsiteApply: { jobApplicationWebhookUrl: "https://puente.example.test/api/webhooks/vinculo" },
  },
  lifecycle: { action: "RESUME_DOWNLOADED" },
};

const ejemploRespuesta = {
  id: "0b7e5a7c-1d2f-4e3a-9b8c-7d6e5f4a3b21",
  externalJobId: "9003",
  companyId: "6f1d2c3b-4a5e-4f60-8a71-b2c3d4e5f601",
  companyName: "Andina Software S.A.S.",
  title: "Desarrollador/a Frontend React",
  state: "LISTED",
  applyMethod: "ONSITE_APPLY",
  jobApplicationWebhookUrl: "https://puente.example.test/api/webhooks/vinculo",
  companyApplyUrl: "https://andina-software.test/empleos",
  notOnsiteReason: null,
  url: "https://vinculo.example.test/empleos/0b7e5a7c-1d2f-4e3a-9b8c-7d6e5f4a3b21",
  listedAt: "2026-10-28T15:00:00.000Z",
  closedAt: null,
};

const entregaEjemplo = {
  type: "EXPORT_JOB_APPLICATION",
  externalJobId: "9003",
  jobApplicationId: "urn:li:jobApplication:6172839405",
  jobApplicant: "urn:li:person:4f2a9c0d1e2b3a45",
  appliedAt: 1761663600000,
  questionResponses: {
    contactInformationQuestionResponses: {
      firstNameAnswer: { value: "Valentina" },
      lastNameAnswer: { value: "Ríos Gaviria" },
      emailAnswer: { value: "valentina.rios@demo.test" },
      cellphoneNumberQuestionAnswer: { countryCode: "57", nationalNumber: "3001112233" },
      locationAnswer: { locationCityAnswer: { value: "Medellín" }, locationCountryAnswer: { value: "CO" } },
    },
    resumeQuestionResponses: {
      resumeQuestionAnswer: { mediaUrl: "https://vinculo.example.test/api/v1/media/1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f", mediaUrn: "urn:li:media:1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f" },
    },
  },
};

export function documentoOpenApi(servidor: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "API del Simulador LinkedIn para integradores",
      version: "1.0.0",
      description:
        "Entorno de simulación con datos ficticios. El Simulador LinkedIn es una red profesional simulada; esta API está **modelada sobre Apply Connect de LinkedIn** (formato de la entrega, firma `X-LI-Signature`, desafío del webhook, códigos de error y descarga del CV con Bearer, según la documentación pública). Las rutas de token, publicación, cierre, autorizaciones y ciclo de vida son **contrato del simulador**: no son rutas oficiales de LinkedIn.",
    },
    servers: [{ url: servidor }],
    tags: [{ name: "Autenticación" }, { name: "Vacantes" }, { name: "Postulaciones" }],
    paths: {
      "/oauth/v2/accessToken": {
        post: {
          tags: ["Autenticación"],
          operationId: "obtenerToken",
          summary: "Access token de la aplicación (client credentials)",
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/x-www-form-urlencoded": { schema: ref("SolicitudToken"), example: EJEMPLOS.token },
              "application/json": { schema: ref("SolicitudToken"), example: EJEMPLOS.token },
            },
          },
          responses: {
            200: { description: "Token válido 60 minutos.", content: { "application/json": { schema: ref("Token"), example: { access_token: "eyJhbGciOiJIUzI1NiJ9…", expires_in: 3600, token_type: "Bearer" } } } },
            400: { description: "Solicitud inválida.", content: { "application/json": { schema: ref("ErrorOAuth"), example: { error: "unsupported_grant_type", error_description: "Solo se admite grant_type=client_credentials." } } } },
            401: { description: "Credenciales incorrectas.", content: { "application/json": { schema: ref("ErrorOAuth"), example: { error: "invalid_client", error_description: "Client ID o Client Secret incorrectos." } } } },
          },
        },
      },
      "/api/v1/autorizaciones": {
        get: {
          tags: ["Vacantes"],
          operationId: "listarAutorizaciones",
          summary: "Empresas que autorizaron a la aplicación (Conectar ATS)",
          responses: {
            200: {
              description: "Empresas autorizadas.",
              content: {
                "application/json": {
                  schema: ref("Autorizaciones"),
                  example: {
                    application: { clientId: "vin_3f9a1c7e2b4d6a80", name: "Puente de postulaciones", webhookStatus: "VALIDADO" },
                    elements: [{ companyId: "6f1d2c3b-4a5e-4f60-8a71-b2c3d4e5f601", name: "Andina Software S.A.S.", authorizedAt: "2026-10-28T14:00:00.000Z" }],
                  },
                },
              },
            },
            ...no401,
          },
        },
      },
      "/api/v1/jobPostings": {
        post: {
          tags: ["Vacantes"],
          operationId: "publicarVacante",
          summary: "Publicar o actualizar una vacante desde el ATS",
          description:
            "Idempotente por (aplicación, externalJobId): repetir actualiza. Con `onsiteApply`, el Simulador LinkedIn valida el webhook por desafío antes de publicar; si falla, la vacante queda como «postulación en el sitio de la empresa» (`applyMethod = COMPANY_SITE`).",
          requestBody: { required: true, content: { "application/json": { schema: ref("JobPosting"), example: EJEMPLOS.jobPosting } } },
          responses: {
            200: { description: "Vacante actualizada.", content: { "application/json": { schema: ref("JobPostingPublicada"), example: { ...ejemploRespuesta, webhookValidation: "El webhook respondió el desafío correctamente." } } } },
            201: { description: "Vacante creada.", content: { "application/json": { schema: ref("JobPostingPublicada"), example: { ...ejemploRespuesta, webhookValidation: "El webhook respondió el desafío correctamente." } } } },
            400: err("Datos inválidos.", "INVALID_REQUEST", "Datos inválidos.", 400),
            403: err("La empresa no autorizó a la aplicación.", "COMPANY_NOT_AUTHORIZED", "La empresa no ha autorizado a esta aplicación (Conectar ATS).", 403),
            404: err("La empresa no existe.", "COMPANY_NOT_FOUND", "La empresa no existe en el Simulador LinkedIn.", 404),
            409: err("El externalJobId ya se usa para otra empresa.", "EXTERNAL_JOB_ID_IN_USE", "Ese externalJobId ya se usa para otra empresa.", 409),
            ...no401,
          },
        },
      },
      "/api/v1/jobPostings/{externalJobId}/close": {
        post: {
          tags: ["Vacantes"],
          operationId: "cerrarVacante",
          summary: "Cerrar una vacante",
          parameters: [{ name: "externalJobId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: { description: "Vacante cerrada.", content: { "application/json": { schema: ref("JobPostingRespuesta"), example: { ...ejemploRespuesta, state: "CLOSED", closedAt: "2026-10-30T15:00:00.000Z" } } } },
            404: err("No existe para esta aplicación.", "JOB_POSTING_NOT_FOUND", "La aplicación no tiene una vacante con ese externalJobId.", 404),
            ...no401,
          },
        },
      },
      "/api/v1/media/{id}": {
        get: {
          tags: ["Postulaciones"],
          operationId: "descargarCv",
          summary: "Descargar el CV de una postulación (mediaUrl)",
          description: "Es el `mediaUrl` que llega en la entrega. Solo la aplicación dueña de la vacante puede descargarlo; vale 30 días.",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            200: { description: "El PDF.", content: { "application/pdf": { schema: { type: "string", format: "binary" } } } },
            403: err("La vacante es de otra aplicación.", "ACCESS_DENIED", "El archivo pertenece a una vacante de otra aplicación.", 403),
            404: err("No existe.", "NOT_FOUND", "No existe.", 404),
            410: err("Venció.", "MEDIA_EXPIRED", "El enlace del archivo venció (30 días).", 410),
            ...no401,
          },
        },
      },
      "/api/v1/jobApplications/{jobApplicationId}/lifecycle": {
        post: {
          tags: ["Postulaciones"],
          operationId: "cicloDeVida",
          summary: "Informar al candidato el avance de su postulación",
          description: "VIEWED → «Vista por la empresa», RESUME_DOWNLOADED → «CV descargado», REJECTED → «No seleccionado». Idempotente; los estados solo avanzan.",
          parameters: [{ name: "jobApplicationId", in: "path", required: true, schema: { type: "string" }, example: "urn:li:jobApplication:6172839405" }],
          requestBody: { required: true, content: { "application/json": { schema: ref("Lifecycle"), example: EJEMPLOS.lifecycle } } },
          responses: {
            200: { description: "Estado actual.", content: { "application/json": { schema: ref("LifecycleRespuesta"), example: { jobApplicationId: "urn:li:jobApplication:6172839405", action: "RESUME_DOWNLOADED", status: "CV_DESCARGADO" } } } },
            400: err("Acción inválida.", "INVALID_REQUEST", "action debe ser VIEWED, RESUME_DOWNLOADED o REJECTED.", 400),
            403: err("La postulación es de otra aplicación.", "ACCESS_DENIED", "La postulación pertenece a una vacante de otra aplicación.", 403),
            404: err("No existe.", "JOB_APPLICATION_NOT_FOUND", "La postulación no existe.", 404),
            ...no401,
          },
        },
      },
    },
    webhooks: {
      validacionWebhook: {
        get: {
          summary: "Validación del webhook por desafío (Verificado: guía de webhooks de LinkedIn)",
          description:
            "El Simulador LinkedIn llama `GET {webhook}?challengeCode=<uuid>&applicationId=<clientId>` al registrar la URL y antes de publicar una vacante con Solicitud sencilla. Responde 200 en menos de 3 s con `challengeResponse = hex(HMAC-SHA256(challengeCode, clientSecret))`.",
          parameters: [
            { name: "challengeCode", in: "query", required: true, schema: { type: "string", format: "uuid" } },
            { name: "applicationId", in: "query", required: true, schema: { type: "string" } },
          ],
          responses: { 200: { description: "Desafío respondido.", content: { "application/json": { schema: ref("RespuestaDesafio") } } } },
        },
      },
      entregaPostulacion: {
        post: {
          summary: "Entrega de una postulación (EXPORT_JOB_APPLICATION, Verificado: Apply Connect)",
          description:
            "Encabezado `X-LI-Signature = hex(HMAC-SHA256(\"hmacsha256=\" + cuerpo crudo, clientSecret))` (D-04). 2xx = recibido. Con otro código el Simulador LinkedIn reintenta: hasta 6 intentos con espera exponencial desde 30 s (unos 15 minutos), salvo los códigos que LinkedIn no reintenta (SIGNATURE_MISMATCH, MISSING_REQUIRED_RESPONSE, INPUT_VALIDATION_FAILED, JOB_POSTING_CLOSED, DUPLICATE_APPLICATION_RECEIVED).",
          parameters: [{ name: "X-LI-Signature", in: "header", required: true, schema: { type: "string", pattern: "^[0-9a-f]{64}$" } }],
          requestBody: { required: true, content: { "application/json": { schema: ref("EntregaPostulacion"), example: entregaEjemplo } } },
          responses: { 200: { description: "Recibida." } },
        },
      },
    },
    components: {
      securitySchemes: { Bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "Access token de /oauth/v2/accessToken." } },
      schemas: {
        SolicitudToken: {
          type: "object",
          required: ["grant_type", "client_id", "client_secret"],
          properties: { grant_type: { type: "string", enum: ["client_credentials"] }, client_id: { type: "string" }, client_secret: { type: "string" } },
        },
        Token: {
          type: "object",
          required: ["access_token", "expires_in", "token_type"],
          properties: { access_token: { type: "string" }, expires_in: { type: "integer" }, token_type: { type: "string", enum: ["Bearer"] } },
        },
        ErrorOAuth: { type: "object", required: ["error", "error_description"], properties: { error: { type: "string" }, error_description: { type: "string" } } },
        Error: {
          type: "object",
          required: ["status", "code", "message"],
          properties: { status: { type: "integer" }, code: { type: "string" }, message: { type: "string" }, details: { type: "object" } },
        },
        Autorizaciones: {
          type: "object",
          required: ["application", "elements"],
          properties: {
            application: { type: "object", required: ["clientId", "name", "webhookStatus"], properties: { clientId: { type: "string" }, name: { type: "string" }, webhookStatus: { type: "string", enum: ["SIN_VALIDAR", "VALIDADO", "FALLIDO"] } } },
            elements: {
              type: "array",
              items: { type: "object", required: ["companyId", "name", "authorizedAt"], properties: { companyId: { type: "string", format: "uuid" }, name: { type: "string" }, authorizedAt: { type: "string", format: "date-time" } } },
            },
          },
        },
        JobPosting: js(esquemaJobPosting, "input"),
        JobPostingRespuesta: js(esquemaJobPostingRespuesta),
        JobPostingPublicada: js(esquemaJobPostingRespuesta.extend({ webhookValidation: z.string().nullable().describe("Resultado del desafío al webhook (null si no se pidió onsiteApply)") })),
        Lifecycle: { type: "object", required: ["action"], properties: { action: { type: "string", enum: ["VIEWED", "RESUME_DOWNLOADED", "REJECTED"] } } },
        LifecycleRespuesta: {
          type: "object",
          required: ["jobApplicationId", "action", "status"],
          properties: { jobApplicationId: { type: "string" }, action: { type: "string" }, status: { type: "string", enum: ["ENVIADA", "VISTA", "CV_DESCARGADO", "NO_SELECCIONADO"] } },
        },
        RespuestaDesafio: { type: "object", required: ["challengeCode", "challengeResponse"], properties: { challengeCode: { type: "string" }, challengeResponse: { type: "string", pattern: "^[0-9a-f]{64}$" } } },
        EntregaPostulacion: {
          type: "object",
          required: ["type", "externalJobId", "jobApplicationId", "jobApplicant", "appliedAt", "questionResponses"],
          properties: {
            type: { type: "string", enum: ["EXPORT_JOB_APPLICATION"] },
            externalJobId: { type: "string" },
            jobApplicationId: { type: "string", pattern: "^urn:li:jobApplication:" },
            jobApplicant: { type: "string", pattern: "^urn:li:person:" },
            appliedAt: { type: "integer", description: "Epoch en milisegundos" },
            questionResponses: { type: "object" },
          },
        },
      },
    },
    security: [{ Bearer: [] }],
  };
}

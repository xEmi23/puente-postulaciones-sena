import { z } from "zod";
import { esquemaCambioPostulacion, esquemaCambioPostulante, esquemaNuevaPostulacion, esquemaNuevoPostulante, esquemaNuevoProceso } from "@/modules/seleccion";
import { ENCABEZADO_LLAVE, LIMITE_POR_MINUTO } from "./http";
import { esquemaDocumento, esquemaError, esquemaLlaveActual, esquemaPaginacion, esquemaPostulacion, esquemaPostulante, esquemaProceso } from "./vistas";

// Documento OpenAPI 3.1 de la API v1 de Talentia, generado desde los mismos esquemas Zod que usa la implementación.
// Es CONTRATO DEL SIMULADOR: los recursos y permisos siguen lo verificado del módulo de Selección de BUK
// (docs/contratos.md), pero las rutas, los campos y el encabezado son nuestros. Lo prueban tests/contrato-openapi.test.ts.

const js = (s: z.ZodType, io: "input" | "output" = "output") => {
  const esquema = z.toJSONSchema(s, { io, unrepresentable: "any" }) as Record<string, unknown>;
  delete esquema.$schema;
  return esquema;
};
const ref = (nombre: string) => ({ $ref: `#/components/schemas/${nombre}` });
const datos = (s: object) => ({ type: "object", required: ["data"], properties: { data: s } });
const lista = (s: object, paginada = false) => ({
  type: "object",
  required: paginada ? ["data", "paginacion"] : ["data"],
  properties: { data: { type: "array", items: s }, ...(paginada ? { paginacion: ref("Paginacion") } : {}) },
});

const EJ = {
  proceso: {
    id: 9001,
    titulo: "Desarrollador/a Backend Java",
    area: "Ingeniería",
    ciudad: "Medellín",
    descripcion: "Servicios backend en Java y Spring Boot. Proceso ficticio.",
    prioridad: "Alta",
    estado: "INICIADO",
    fecha_inicio: "2026-10-18T17:00:00.000Z",
    vigencia_dias: 10,
    total_postulaciones: 3,
    etapas: [{ id: "3b9d6f0e-2a41-4c1e-9d55-0f2a7c1b8e01", nombre: "Postulantes", orden: 1, tipo: "Entrada", postulantes: 2 }],
  },
  postulante: {
    id: "8f14e45f-ceea-4e7a-9b1d-2c3d4e5f6a7b",
    nombre: "Valentina",
    apellido: "Ríos Gaviria",
    correo: "valentina.rios@demo.test",
    telefono: "+573001112233",
    ciudad: "Medellín",
    referencia_externa: "urn:li:person:4f2a9c",
    creado_en: "2026-10-28T15:04:05.000Z",
    actualizado_en: "2026-10-28T15:04:05.000Z",
  },
  documento: {
    id: "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
    postulante_id: "8f14e45f-ceea-4e7a-9b1d-2c3d4e5f6a7b",
    tipo: "CV",
    nombre_archivo: "cv-valentina-rios.pdf",
    mime: "application/pdf",
    tamano: 48213,
    sha256: "9b74c9897bac770ffc029102a200c5de4c7d9a1f3e5b2a6c8d0e1f2a3b4c5d6e",
    creado_en: "2026-10-28T15:04:06.000Z",
  },
  postulacion: {
    id: "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9",
    proceso_id: 9001,
    postulante_id: "8f14e45f-ceea-4e7a-9b1d-2c3d4e5f6a7b",
    documento_id: "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
    etapa: { id: "3b9d6f0e-2a41-4c1e-9d55-0f2a7c1b8e01", nombre: "Postulantes", orden: 1 },
    calificacion: "SIN_CALIFICAR",
    fuente: "Portal simulado (tipo LinkedIn)",
    referencia_externa: "urn:li:jobApplication:6172839405",
    descartada: false,
    creada_en: "2026-10-28T15:04:07.000Z",
    actualizada_en: "2026-10-28T15:04:07.000Z",
  },
  llave: { nombre: "Puente de postulaciones", prefijo: "tal_7f3a9c2b", permisos: { seleccion: { lectura: true, modificacion: true } }, creada_en: "2026-10-28T14:00:00.000Z" },
};

/** Ejemplos de solicitud que la prueba de contrato ejecuta contra la implementación real. */
export const EJEMPLOS_SOLICITUD = {
  crearProceso: { titulo: "Analista de Datos", area: "Datos", ciudad: "Bogotá", descripcion: "Proceso ficticio de ejemplo.", prioridad: "Media", fecha_inicio: "2026-10-28" },
  crearPostulante: { nombre: "Valentina", apellido: "Ríos Gaviria", correo: "valentina.rios@demo.test", telefono: "+573001112233", ciudad: "Medellín", referencia_externa: "urn:li:person:4f2a9c" },
  actualizarPostulante: { telefono: "+573004445566", ciudad: "Envigado" },
  crearPostulacion: {
    proceso_id: 9001,
    postulante_id: "8f14e45f-ceea-4e7a-9b1d-2c3d4e5f6a7b",
    documento_id: "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
    fuente: "Portal simulado (tipo LinkedIn)",
    referencia_externa: "urn:li:jobApplication:6172839405",
  },
  moverPostulacion: { etapa: "Por contactar" },
};

const errorEj = (codigo: string, mensaje: string) => ({ error: { codigo, mensaje } });
const respuestasComunes = (escritura: boolean) => ({
  401: { description: "Sin API Key, llave inválida o revocada.", content: { "application/json": { schema: ref("Error"), example: errorEj("NO_AUTORIZADO", "La API Key fue revocada.") } } },
  403: {
    description: `La llave no tiene el permiso de ${escritura ? "Modificación" : "Lectura"} de Selección.`,
    content: { "application/json": { schema: ref("Error"), example: errorEj("PERMISO_INSUFICIENTE", "La API Key no tiene el permiso de Modificación del módulo Selección.") } },
  },
  429: {
    description: `Más de ${LIMITE_POR_MINUTO()} solicitudes por minuto con la misma llave. El encabezado Retry-After indica cuántos segundos esperar.`,
    headers: { "Retry-After": { schema: { type: "integer" } } },
    content: { "application/json": { schema: ref("Error"), example: errorEj("LIMITE_EXCEDIDO", "Se superó el límite de 120 solicitudes por minuto.") } },
  },
});
const idempotencia = {
  name: "Idempotency-Key",
  in: "header",
  required: false,
  description: "Capacidad del simulador (no atribuida a BUK): la misma clave con la misma solicitud devuelve la respuesta original sin volver a escribir.",
  schema: { type: "string", maxLength: 200 },
};
const ok = (descripcion: string, schema: object, example: unknown) => ({ description: descripcion, content: { "application/json": { schema, example } } });
const err = (descripcion: string, codigo: string, mensaje: string) => ({ description: descripcion, content: { "application/json": { schema: ref("Error"), example: errorEj(codigo, mensaje) } } });
const cuerpo = (nombre: string, example: unknown) => ({ required: true, content: { "application/json": { schema: ref(nombre), example } } });
const idUuid = (desc: string) => ({ name: "id", in: "path", required: true, description: desc, schema: { type: "string", format: "uuid" } });

export function documentoOpenApi(servidor: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "API de Talentia (simulador)",
      version: "1.0.0",
      description:
        "Entorno de simulación con datos ficticios. API del ATS simulado Talentia. Los recursos (procesos, postulantes, postulaciones) y los permisos por módulo (Selección → Lectura y Modificación) siguen lo verificado del centro de ayuda público de BUK; **las rutas, los campos y el encabezado `auth_token` son contrato del simulador** y no son la API oficial de BUK.",
    },
    servers: [{ url: servidor }],
    security: [{ ApiKey: [] }],
    tags: [{ name: "Procesos" }, { name: "Postulantes" }, { name: "Documentos" }, { name: "Postulaciones" }, { name: "Llave" }],
    paths: {
      "/api/v1/seleccion/procesos": {
        get: {
          tags: ["Procesos"],
          operationId: "listarProcesos",
          summary: "Listar procesos de selección",
          description: "Requiere permiso de Lectura.",
          parameters: [{ name: "estado", in: "query", required: false, schema: { type: "string", enum: ["INICIADO", "CERRADO"] } }],
          responses: { 200: ok("Procesos con sus etapas.", lista(ref("Proceso")), { data: [EJ.proceso] }), ...respuestasComunes(false) },
        },
        post: {
          tags: ["Procesos"],
          operationId: "crearProceso",
          summary: "Crear un proceso",
          description: "Requiere permiso de Modificación. Crea las 9 etapas de la plantilla; la primera es «Postulantes».",
          parameters: [idempotencia],
          requestBody: cuerpo("NuevoProceso", EJEMPLOS_SOLICITUD.crearProceso),
          responses: {
            201: ok("Proceso creado.", datos(ref("Proceso")), { data: { ...EJ.proceso, id: 9003, titulo: "Analista de Datos", total_postulaciones: 0 } }),
            400: err("Datos inválidos.", "DATOS_INVALIDOS", "Datos inválidos."),
            ...respuestasComunes(true),
          },
        },
      },
      "/api/v1/seleccion/procesos/{id}": {
        get: {
          tags: ["Procesos"],
          operationId: "obtenerProceso",
          summary: "Consultar un proceso",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { 200: ok("Proceso.", datos(ref("Proceso")), { data: EJ.proceso }), 404: err("No existe.", "NO_ENCONTRADO", "El proceso no existe."), ...respuestasComunes(false) },
        },
      },
      "/api/v1/seleccion/postulantes": {
        get: {
          tags: ["Postulantes"],
          operationId: "listarPostulantes",
          summary: "Buscar postulantes",
          description: "Con `email` devuelve como máximo un postulante (el correo es único).",
          parameters: [
            { name: "email", in: "query", required: false, schema: { type: "string", format: "email" } },
            { name: "pagina", in: "query", required: false, schema: { type: "integer", minimum: 1 } },
            { name: "por_pagina", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100 } },
          ],
          responses: { 200: ok("Postulantes.", lista(ref("Postulante"), true), { data: [EJ.postulante], paginacion: { pagina: 1, por_pagina: 25, total: 1 } }), ...respuestasComunes(false) },
        },
        post: {
          tags: ["Postulantes"],
          operationId: "crearPostulante",
          summary: "Crear un postulante",
          parameters: [idempotencia],
          requestBody: cuerpo("NuevoPostulante", EJEMPLOS_SOLICITUD.crearPostulante),
          responses: {
            201: ok("Postulante creado.", datos(ref("Postulante")), { data: EJ.postulante }),
            400: err("Datos inválidos.", "DATOS_INVALIDOS", "Datos inválidos."),
            409: err("Ya existe un postulante con ese correo (detalle.postulante_id).", "POSTULANTE_EXISTENTE", "Ya existe un postulante con ese correo."),
            ...respuestasComunes(true),
          },
        },
      },
      "/api/v1/seleccion/postulantes/{id}": {
        get: {
          tags: ["Postulantes"],
          operationId: "obtenerPostulante",
          summary: "Consultar un postulante",
          parameters: [idUuid("Id del postulante")],
          responses: { 200: ok("Postulante.", datos(ref("Postulante")), { data: EJ.postulante }), 404: err("No existe.", "NO_ENCONTRADO", "El postulante no existe."), ...respuestasComunes(false) },
        },
        patch: {
          tags: ["Postulantes"],
          operationId: "actualizarPostulante",
          summary: "Actualizar un postulante",
          parameters: [idUuid("Id del postulante"), idempotencia],
          requestBody: cuerpo("CambioPostulante", EJEMPLOS_SOLICITUD.actualizarPostulante),
          responses: {
            200: ok("Postulante actualizado.", datos(ref("Postulante")), { data: { ...EJ.postulante, telefono: "+573004445566", ciudad: "Envigado" } }),
            400: err("Datos inválidos.", "DATOS_INVALIDOS", "Datos inválidos."),
            404: err("No existe.", "NO_ENCONTRADO", "El postulante no existe."),
            ...respuestasComunes(true),
          },
        },
      },
      "/api/v1/seleccion/postulantes/{id}/documentos": {
        get: {
          tags: ["Documentos"],
          operationId: "listarDocumentos",
          summary: "Listar documentos de un postulante",
          parameters: [idUuid("Id del postulante")],
          responses: { 200: ok("Documentos (sin contenido).", lista(ref("Documento")), { data: [EJ.documento] }), 404: err("No existe.", "NO_ENCONTRADO", "El postulante no existe."), ...respuestasComunes(false) },
        },
        post: {
          tags: ["Documentos"],
          operationId: "subirDocumento",
          summary: "Subir el CV (PDF) con su SHA-256",
          description: "Supuesto pendiente: no hay documentación pública de adjuntos en BUK. Talentia recalcula el SHA-256 y responde 422 si no coincide.",
          parameters: [idUuid("Id del postulante"), idempotencia],
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["archivo", "sha256"],
                  properties: {
                    archivo: { type: "string", format: "binary", description: "PDF de máximo 5 MB" },
                    sha256: { type: "string", pattern: "^[0-9a-f]{64}$" },
                    tipo: { type: "string", enum: ["CV"], default: "CV" },
                  },
                },
              },
            },
          },
          responses: {
            201: ok("Documento guardado.", datos(ref("Documento")), { data: EJ.documento }),
            400: err("Faltan campos.", "DATOS_INVALIDOS", "Adjunta el archivo en el campo «archivo»."),
            404: err("No existe.", "NO_ENCONTRADO", "El postulante no existe."),
            413: err("Archivo demasiado grande.", "ARCHIVO_DEMASIADO_GRANDE", "El archivo supera el máximo permitido."),
            415: err("No es PDF.", "ARCHIVO_NO_PDF", "El archivo no es un PDF."),
            422: err("El SHA-256 no coincide.", "HASH_NO_COINCIDE", "El SHA-256 del archivo recibido no coincide con el declarado."),
            ...respuestasComunes(true),
          },
        },
      },
      "/api/v1/seleccion/postulaciones": {
        get: {
          tags: ["Postulaciones"],
          operationId: "listarPostulaciones",
          summary: "Listar postulaciones",
          parameters: [
            { name: "proceso_id", in: "query", required: false, schema: { type: "integer" } },
            { name: "referencia_externa", in: "query", required: false, schema: { type: "string" } },
          ],
          responses: { 200: ok("Postulaciones.", lista(ref("Postulacion")), { data: [EJ.postulacion] }), 400: err("Filtro inválido.", "DATOS_INVALIDOS", "proceso_id debe ser un entero."), ...respuestasComunes(false) },
        },
        post: {
          tags: ["Postulaciones"],
          operationId: "crearPostulacion",
          summary: "Añadir un postulante a un proceso",
          description: "La deja en la primera etapa («Postulantes»), sin calificar. La misma referencia_externa devuelve 200 con la existente.",
          parameters: [idempotencia],
          requestBody: cuerpo("NuevaPostulacion", EJEMPLOS_SOLICITUD.crearPostulacion),
          responses: {
            200: ok("Ya existía una postulación con esa referencia_externa.", datos(ref("Postulacion")), { data: EJ.postulacion }),
            201: ok("Postulación creada en «Postulantes».", datos(ref("Postulacion")), { data: EJ.postulacion }),
            400: err("Datos inválidos.", "DATOS_INVALIDOS", "Datos inválidos."),
            404: err("Proceso o postulante inexistente.", "PROCESO_NO_EXISTE", "El proceso no existe."),
            409: err("La persona ya está en el proceso (detalle.postulacion_id).", "POSTULACION_EXISTENTE", "El postulante ya tiene una postulación en este proceso."),
            422: err("Proceso cerrado o documento ajeno.", "PROCESO_CERRADO", "El proceso está cerrado y no recibe postulaciones."),
            ...respuestasComunes(true),
          },
        },
      },
      "/api/v1/seleccion/postulaciones/{id}": {
        get: {
          tags: ["Postulaciones"],
          operationId: "obtenerPostulacion",
          summary: "Consultar una postulación",
          parameters: [idUuid("Id de la postulación")],
          responses: { 200: ok("Postulación.", datos(ref("Postulacion")), { data: EJ.postulacion }), 404: err("No existe.", "NO_ENCONTRADO", "La postulación no existe."), ...respuestasComunes(false) },
        },
        patch: {
          tags: ["Postulaciones"],
          operationId: "cambiarPostulacion",
          summary: "Mover de etapa, descartar o restaurar",
          parameters: [idUuid("Id de la postulación"), idempotencia],
          requestBody: cuerpo("CambioPostulacion", EJEMPLOS_SOLICITUD.moverPostulacion),
          responses: {
            200: ok("Postulación actualizada.", datos(ref("Postulacion")), { data: { ...EJ.postulacion, etapa: { id: "4c0e7a1f-3b52-4d2f-8e66-1a3b8d2c9f02", nombre: "Por contactar", orden: 2 } } }),
            400: err("Datos inválidos.", "DATOS_INVALIDOS", "Datos inválidos."),
            404: err("No existe.", "NO_ENCONTRADO", "La postulación no existe."),
            422: err("La etapa no es del proceso.", "ETAPA_INVALIDA", "La etapa no pertenece al proceso de la postulación."),
            ...respuestasComunes(true),
          },
        },
      },
      "/api/v1/api-key": {
        get: {
          tags: ["Llave"],
          operationId: "llaveActual",
          summary: "Consultar la llave con la que se llama (nombre, prefijo y permisos)",
          description: "Contrato del simulador. La usa «Probar conexión» del puente.",
          responses: { 200: ok("Llave actual.", datos(ref("LlaveActual")), { data: EJ.llave }), ...respuestasComunes(false) },
        },
      },
    },
    components: {
      securitySchemes: {
        ApiKey: { type: "apiKey", in: "header", name: ENCABEZADO_LLAVE, description: "API Key creada en Administración → API Keys. Supuesto pendiente: nombre del encabezado no verificado en BUK." },
      },
      schemas: {
        Proceso: js(esquemaProceso),
        Postulante: js(esquemaPostulante),
        Documento: js(esquemaDocumento),
        Postulacion: js(esquemaPostulacion),
        LlaveActual: js(esquemaLlaveActual),
        Error: js(esquemaError),
        Paginacion: js(esquemaPaginacion),
        NuevoProceso: js(esquemaNuevoProceso, "input"),
        NuevoPostulante: js(esquemaNuevoPostulante, "input"),
        CambioPostulante: js(esquemaCambioPostulante, "input"),
        NuevaPostulacion: js(esquemaNuevaPostulacion, "input"),
        CambioPostulacion: js(esquemaCambioPostulacion, "input"),
      },
    },
  };
}

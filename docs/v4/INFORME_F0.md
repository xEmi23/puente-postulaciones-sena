# Informe F0 — Auditoría del código frente a la V4

> Escrito por Claude Code (2026-11-02), rama `v4` creada desde `v2` (`f1b7c4c`). Fase de solo lectura: no se modificó código, esquema ni pruebas. Por instrucción del equipo para la noche del 02/11 (PROMPT_NOCHE_V4.md), este informe es el plan aprobado para F1–F3.

## 0. Línea base

Ver la sección «Línea base» al final (comandos, conteos y tiempos reales).

## a) Mapa real del Puente (`apps/puente`)

| Pieza | Dónde está hoy | Notas |
|---|---|---|
| Recepción del webhook de Vínculo | `src/app/api/webhooks/vinculo/route.ts` → `src/modules/webhook.ts` (`responderDesafio`, `recibirPostulacion`) | Firma HMAC (`src/lib/firma.ts`), validación con `src/modules/contrato-apply-connect.ts` (Zod), deduplicación por `jobApplicationId`, resolución del proceso (`src/modules/destino.ts`) y `prisma.recepcion.create` con su `Trabajo` en la misma escritura. Mezcla adaptador (formato Apply Connect) y núcleo (guardar/encolar) |
| Modelo de recepción | `prisma/schema.prisma`: `Recepcion` (estados `RECIBIDO, PROCESANDO, COMPLETADO, RECHAZADO, FALLIDO_REINTENTABLE, REQUIERE_VERIFICACION`), `Trabajo` (`PENDIENTE, EN_CURSO, HECHO, DETENIDO`), `EventoRecepcion`, `EntregaRechazada` | Campos atados a Apply Connect: `jobApplicationId` (único), `jobApplicant`, `externalJobId`, `appliedAt`, `mediaUrl`, `mediaUrn` (obligatorios), `correo` obligatorio |
| Procesador y pasos | `src/modules/procesador.ts` (`reclamarTrabajos` con `FOR UPDATE SKIP LOCKED` + lease, `procesarTrabajo`, `manejarFallo`, `completar`, `descargarCv`) | Pasos `cv_descargado → postulante_listo → documento_subido → postulacion_creada`, cada uno persistido. Llama directo a `ats-cliente` y descarga el CV de Vínculo (conoce la fuente y el ATS) |
| Cliente de Talentia | `src/modules/ats-cliente.ts` | Único lugar con rutas y formato de Talentia. Importado por `procesador.ts`, `operaciones.ts`, `prueba-conexion.ts`, `publicacion.ts`, `app/(app)/procesos/page.tsx` y `app/(app)/correspondencias/page.tsx` |
| Deduplicación | `Recepcion.jobApplicationId @unique` + captura de violación única en `webhook.ts`; respuesta 200 `DUPLICADO` | Clave dura atada a Apply Connect |
| Reintentos | `procesador.ts`: `MAX_INTENTOS_TRABAJO = 10` (D-46), `backoffConJitter`, `Retry-After` en 429; worker `src/worker/ciclo.ts` (`PUENTE_MAX_INTENTOS`) | Al agotar: `FALLIDO_REINTENTABLE` + trabajo `DETENIDO` |
| Reconciliación | `procesador.ts` (si `ATS_SIN_RESPUESTA`, consulta antes de crear) y `src/modules/operaciones.ts` (`reconciliar` desde el panel) | Busca por `referencia_externa` |
| Cifrado de la API Key | `src/lib/cifrado.ts` (AES-256-GCM) y `src/modules/conexiones.ts` (`Conexion`) | Cumple la V4 |
| Autenticación y roles | `src/lib/auth.ts` (Better Auth, cookie `pue_sesion`), `src/lib/sesion-servidor.ts` (`exigirUsuario`, `exigirUsuarioAccion(rol)`), `src/proxy.ts` | Roles `ADMIN` y `OPERADOR` (D-42) |
| Logs | `console.error/log` en `procesador.ts`, `webhook.ts`, `worker/ciclo.ts` | Sin datos personales desde F6 (v2), pero sin `idRecepcion` en todos |
| Borrado o retención | `procesador.ts` borra `cvContenido` al completar o rechazar | No hay retención configurable ni borrado a pedido; el binario se borra **al completar** (más estricto que la V4) |
| Enmascarado | `src/lib/privacidad.ts` | Usado en el panel |
| Métricas | `src/modules/operaciones.ts`, `app/(app)/metricas` | No hay métricas por fuente (solo hay una fuente) |

## b) Requisitos V4 → estado actual

| § | Requisito | Estado | Archivo |
|---|---|---|---|
| 6 | `PostulacionCanonica v1` (Zod) | No existe | — |
| 6 | Obligatorios `version, fuente, idExterno, vacanteExterna, candidato.nombres` | No existe | — |
| 6 | Sin correo o sin CV → `REQUIERE_REVISION` | No existe (el webhook rechaza con 400) | `webhook.ts` |
| 6 | `fuente` fijada por el token o el adaptador | No existe | — |
| 6 | Dedup dura `fuente + idExterno` | Parcial (`jobApplicationId` único) | `schema.prisma` |
| 6 | Normalización correo/teléfono E.164 (+57)/nombres | Parcial (correo en minúsculas; teléfono sin indicativo por defecto) | `webhook.ts` |
| 7 | Estados `RECIBIDA … FALLIDA_DEFINITIVA` | Parcial: existen con otros nombres; faltan `REQUIERE_REVISION` y `FALLIDA_DEFINITIVA` | `schema.prisma` |
| 7 | Posible duplicado (mismo correo, misma vacante, otra fuente) | No existe | — |
| 7 | `Idempotency-Key` por paso y reconciliación | Existe | `procesador.ts`, `ats-cliente.ts` |
| 7 | `FOR UPDATE SKIP LOCKED` + lease | Existe | `procesador.ts` |
| 7 | Reintentos (5 por defecto, configurable) | Parcial (10 por defecto, D-46) | `procesador.ts`, `worker/ciclo.ts` |
| 7 | Solo PDF, 5 MB, SHA-256 al recibir y al subir | Existe | `procesador.ts`, `lib/archivos.ts` (Talentia confirma el hash) |
| 7 | Retención `RETENCION_CV_DIAS` | Parcial (se borra al completar) | `procesador.ts` |
| 7 | Eventos de auditoría con actor | Parcial (`EventoRecepcion` sin actor) | `schema.prisma` |
| 7 | Logs con `idRecepcion` y enmascarados | Parcial | varios |
| 7 | Métricas por fuente | No existe | `operaciones.ts` |
| 8.1 | Fuentes con token (hash SHA-256, prefijo, último uso, revocar) | No existe | — |
| 8.1 | Correspondencias genéricas (fuente, vacante) → proceso | Parcial (solo vacantes de Vínculo) | `Correspondencia`, `destino.ts` |
| 8.1 | `GET /api/entradas/v1/vacantes`, `POST /api/entradas/v1/postulaciones` | No existe | — |
| 8.1 | Límite 60/min por token | No existe | — |
| 9 | `ConectorATS` + capacidades | No existe (cliente directo) | `ats-cliente.ts` |
| 9 | Adaptador BUK deshabilitado | No existe | — |
| 9 | `ATS_DESTINO` y `/api/salud` | No existe | `app/api/salud/route.ts` |
| 9 | Omitir `documento_subido` si el ATS no admite CV | No existe | — |
| 9 | Pruebas de contrato de `ConectorATS` | Parcial (pruebas del cliente contra el doble) | `tests/contrato-puente.test.ts`, `tests/dobles.ts` |
| 11 | Secretos cifrados; tokens con hash y tiempo constante | Parcial (cifrado sí; tokens no existen) | `lib/cifrado.ts`, `lib/firma.ts` |
| 11 | Solo ADMIN crea fuentes, tokens, borra datos | Parcial (roles existen) | `sesion-servidor.ts` |
| 11 | Límites de tamaño y frecuencia; SSRF | Parcial (tamaño y SSRF sí; frecuencia no) | `procesador.ts`, `lib/red.ts` |
| 11 | Retención y supresión a pedido, auditadas | No existe | — |

## c) Equivalencia de estructura (propuesta mínima)

La v2 organiza la lógica en `src/modules/` plano (D-02). Para cumplir la V4 sin mover lo que funciona:

| Sección 5 (propuesta) | Organización real elegida |
|---|---|
| `nucleo/contrato/` | `src/nucleo/contrato/` (nuevo) |
| `nucleo/recepcion/` | `src/nucleo/recepcion/` (nuevo; `registrarRecepcion`) |
| `nucleo/procesador/` | Se queda en `src/modules/procesador.ts` (sin moverlo: lo importan 6 pruebas); deja de conocer Talentia y Vínculo |
| `entradas/generica/` | `src/entradas/generica/` (lógica) + `src/app/api/entradas/v1/...` (rutas Next) |
| `entradas/apply-connect/` | `src/entradas/apply-connect/` (mapeo a la canónica y descarga del CV). `src/modules/webhook.ts` queda como adaptador HTTP y delega; `contrato-apply-connect.ts` no se mueve |
| `entradas/importador/` | `src/entradas/importador/` + página `src/app/(app)/importar/` |
| `salidas/conector-ats.ts` | `src/salidas/conector-ats.ts` |
| `salidas/talentia/` | `src/salidas/talentia/` (el contenido de `ats-cliente.ts` se traslada; `src/modules/ats-cliente.ts` deja de existir) |
| `salidas/buk/` | `src/salidas/buk/` |

## d) Riesgos del refactor y cobertura

| Parte | Pruebas que la cubren | Riesgo |
|---|---|---|
| Webhook (firma, validación, códigos) | `webhook.test.ts`, `contrato-puente.test.ts`, `firma.test.ts`, E2E C7 | Medio: cambiar el guardado por `registrarRecepcion` no debe cambiar respuestas |
| Procesador (pasos, reintentos, reconciliación, caídas) | `fiabilidad.test.ts`, `p5.test.ts`, `conexiones.test.ts`, E2E panel/C8 | **Alto**: las aserciones usan los nombres de estado v2 (`FALLIDO_REINTENTABLE`, `RECHAZADO`, `REQUIERE_VERIFICACION`) y el paso `cv_descargado`; no se pueden cambiar (R.2) |
| Cliente de Talentia | `contrato-puente.test.ts`, todo lo anterior vía el doble | Medio: el traslado a `ConectorATS` debe conservar `Idempotency-Key`, la clasificación de errores y los fallos simulados |
| Publicación, avisos, conexiones | `conexiones.test.ts`, E2E tres-sistemas | Bajo (no cambian) |
| Panel (operaciones, reconciliar, reintentar) | E2E panel, p5, criterios | Medio |
| Sin pruebas hoy | Migración de datos de recepciones; métricas por fuente; retención | Se agregan en F1–F2 |

**Conflictos con la especificación que se resuelven sin tocar pruebas existentes (decisiones D-52 a D-54):**

1. **Nombres de estado.** Las pruebas existentes afirman los estados v2. Se conservan en la base y se agrega un **estado V4 visible** derivado (`RECIBIDO→RECIBIDA`, `PROCESANDO→EN_PROCESO`, `COMPLETADO→COMPLETADA`, `RECHAZADO→FALLIDA_DEFINITIVA`, `FALLIDO_REINTENTABLE` con trabajo detenido → `FALLIDA_DEFINITIVA`, si no `FALLIDA_REINTENTABLE`). `REQUIERE_REVISION` se agrega como estado nuevo. `REQUIERE_VERIFICACION` (respuesta perdida) se conserva. La API nueva responde con los nombres V4.
2. **Paso `cv_verificado`.** Se conserva `cv_descargado` (afirmado por pruebas) como equivalente: «CV obtenido y verificado».
3. **`DUPLICADA`.** Es una respuesta, no una fila: la clave única impide guardar la segunda llegada (como en la v2).
4. **`ConectorATS`.** Se implementa con las firmas de la sección 9 y parámetros **opcionales** adicionales (documento y referencia externa) para conservar el comportamiento de la v2 frente a Talentia.

## e) Plan de archivos F1–F3

### F1
- Crear `src/nucleo/contrato/canonica.ts` (+ `tests/canonica.test.ts`), `src/nucleo/recepcion/registrar.ts`, `src/nucleo/estados.ts` (estado V4 visible), `src/salidas/conector-ats.ts`, `src/salidas/talentia/index.ts` (traslado de `ats-cliente.ts`), `src/salidas/buk/index.ts`, `src/salidas/index.ts` (selección por `ATS_DESTINO`), `src/entradas/apply-connect/{mapeo,cv}.ts`, `tests/conector-ats.test.ts`, `tests/salidas.test.ts`.
- Modificar `webhook.ts` (mapea y llama a `registrarRecepcion`), `procesador.ts` (usa `ConectorATS`; CV por adaptador de fuente; omite documento si no hay capacidad), `operaciones.ts`, `prueba-conexion.ts`, `publicacion.ts`, páginas de procesos y correspondencias, `api/salud`, `worker/ciclo.ts`, `lib/config.ts`, `eslint.config.mjs` (regla que prohíbe importar `salidas/talentia` fuera de `salidas/`), `tests/dobles.ts` (filtro `proceso_id`).
- Migración `v4_f1_fuente`: columnas `fuente` (default `apply-connect`), `idExterno`, `vacanteExterna`; relleno `idExterno = jobApplicationId`, `vacanteExterna = externalJobId`; `UNIQUE(fuente, idExterno)`. Reversible (`down` documentado en el SQL).

### F2
- Modelos `Fuente`, `EventoAuditoria`; estado `REQUIERE_REVISION` con `motivoRevision`; `correo`, `mediaUrl`, `mediaUrn` opcionales; `Correspondencia.fuente` con `UNIQUE(fuente, externalJobId)` (migra las existentes a `apply-connect`); `cvBorradoEn`.
- `src/entradas/generica/{tokens,limite,servicio}.ts`, rutas `src/app/api/entradas/v1/{vacantes,postulaciones}/route.ts`, página `src/app/(app)/fuentes/`, acciones en `operaciones/[id]` (completar, aprobar, descartar, reintentar, borrar datos), filtros y métricas por fuente, tarea de retención en el worker.
- Pruebas `tests/entrada-generica.test.ts` (G-1 a G-9) y E2E.

### F3
- `src/entradas/importador/{texto-pdf,sugerencias,csv,servicio}.ts`, página `src/app/(app)/importar/`, pruebas `tests/importador.test.ts` y `e2e/importador.spec.ts`, `docs/manuales/importador.md`.

## Dudas para el equipo (no bloquean)

- ¿Mantener 10 intentos (D-46, pensado para el arranque en frío de Render) o bajar a 5 como dice la sección 7? Se aplicará el valor de la especificación (5) y se registra la decisión; con 75 s por llamada sigue cubriendo el arranque.
- `docs/v3/`, `PROMPTS_BOT.md`, `docs/insumos/` y `PROMPT_DOCUMENTACION.md` están en la carpeta sin versionar y no forman parte del kit V4; no se versionan (el último contiene el nombre de la empresa).

## Línea base

Ejecutada el 2026-11-02 en la rama `v4` recién creada (mismo código que `v2` `f1b7c4c`):

| Comando | Resultado | Tiempo |
|---|---|---|
| `npm run lint` | exit 0 | 41 s |
| `npm run typecheck` | exit 0 | 38 s |
| `npm test` | Vínculo 26/26 · Talentia 30/30 · Puente 73/73 = **129** | 194 s |
| `npm run test:e2e` (build + Playwright escritorio y móvil) | **37/37** | 354 s |

Total **166 pruebas en verde**, sin fallos previos.

# Registro de decisiones

> Creado por Claude Code (2026-10-25) en modo autónomo. Cada decisión es reversible salvo que se indique lo contrario.
> Formato: fecha · decisión · alternativa descartada · motivo.

## D-01 · Simular ambos extremos (diferencia con la ficha)

- **Fecha:** 2026-10-25
- **Contexto:** la ficha (numerales 2.8 y 3.2) pide registrar las postulaciones «en BUK mediante su API REST, en un entorno de pruebas con acceso controlado». El equipo informa que **la empresa no facilitará la API de BUK por seguridad**. LinkedIn tampoco da acceso: Apply Connect es solo para socios ATS certificados con licencia Recruiter (docs/contratos.md F3).
- **Decisión:** simular los dos extremos: un portal de origen que entrega con el **contrato documentado de LinkedIn Apply Connect** y un ATS de destino con un **contrato del simulador** propio. El puente, que es lo que se propone, se construye como si fuera real.
- **Alternativa descartada:** inventar una API «tipo BUK». No hay documentación pública y podría confundirse con la real.
- **Motivo:** demostrar el recorrido completo, con fiabilidad y pruebas, sin credenciales ni datos reales y sin atribuir a BUK lo que no está verificado.
- **PENDIENTE:** aceptación de la empresa y del mentor. **No hay evidencia todavía** de que lo hayan aceptado.

## D-02 · Una sola app Next.js con tres módulos y tres esquemas

- **Fecha:** 2026-10-25
- **Decisión:** origen (`/origen`), puente (`/puente`, `/api/puente`) y ATS (`/ats`, `/api/ats/v1`) viven en una app Next.js. Cada sistema tiene su esquema PostgreSQL (`origen`, `puente`, `ats`). **Se comunican solo por HTTP**, aunque sea el mismo proceso.
- **Alternativa descartada:** tres apps separadas (más puertos, más arranque y más fallos en la demo) o compartir tablas (oculta el contrato).
- **Motivo:** demo estable con un solo `npm run dev` más el worker, sin perder la separación por contrato.

## D-03 · Versiones fijadas

- **Fecha:** 2026-10-25
- **Decisión:** Next.js 16.4.3, React 19.3.1, Zod 4.6.7, Prisma 7.10.1 (con `@prisma/adapter-pg`), Vitest 5.0.5, Playwright 1.64.1, ESLint 9.39.5, TypeScript **5.9.3**, Node ≥ 22 (probado con 24.2.0).
- **Alternativas descartadas:** TypeScript 7.0.2, porque typescript-eslint 8 (de eslint-config-next) aún no lo soporta. ESLint 10, porque eslint-plugin-react 7 no declara soporte. Prisma 8, que está en *release candidate*. Vitest 4.1.12, que falló al instalar con un error interno de npm (`edgesOut`).
- **Motivo:** últimas versiones estables que funcionan juntas. Todas van con versión exacta en `package.json`.

## D-04 · Firma: seguir la guía compartida de webhooks

- **Fecha:** 2026-10-25
- **Decisión:** `X-LI-Signature = hex(HMAC-SHA256("hmacsha256=" + cuerpo crudo, secreto))`, cabecera solo con el hex (F2).
- **Alternativa descartada:** la lectura de F1 (firmar el cuerpo y anteponer `hmacsha256=` a la firma).
- **Motivo:** F2 es explícita y su ejemplo de cabecera coincide. Detalle en docs/contratos.md §Firma.

## D-05 · PostgreSQL local del proyecto en lugar de Docker

- **Fecha:** 2026-10-25
- **Contexto:** Docker no está instalado en la máquina de desarrollo. Hay un PostgreSQL 16 del sistema en el 5432, con credenciales desconocidas que no se deben buscar.
- **Decisión:** `scripts/pg-local.mjs` crea con los binarios de PostgreSQL 16 un clúster propio en `.pgdata/` (ignorado por git), puerto **5433**, autenticación scram y contraseña aleatoria en `.env`. `docker-compose.yml` queda como alternativa equivalente para quien tenga Docker.
- **Alternativa descartada:** SQLite o memoria (prohibido, ocultaría problemas reales como `SKIP LOCKED` o `timestamptz`) y usar el PostgreSQL del sistema.
- **Motivo:** base PostgreSQL real, aislada y reproducible sin tocar nada fuera de la carpeta.
- **Nota:** las bases se llaman `tb_dev`, `tb_test` y `tb_e2e`. Las primeras (`talentbridge*`) quedaron con un esquema anterior, porque Prisma bloquea `migrate reset` ejecutado por un agente de IA sin consentimiento explícito y no se forzó. Solo tienen datos sembrados y se pueden borrar a mano.

## D-06 · Duplicados: responder 200 sin escribir

- **Fecha:** 2026-10-25
- **Decisión:** un `jobApplicationId` ya recibido responde `200 {"estado":"DUPLICADO"}`, sin escrituras nuevas, y suma `duplicadosEvitados`.
- **Alternativa descartada:** responder `DUPLICATE_APPLICATION_RECEIVED` con código no 200. LinkedIn lo trataría como fallo de entrega, aunque al postulante le diga que fue exitosa.
- **Motivo:** la entrega sí está guardada; un 2xx evita reintentos inútiles. F2 pide deduplicar.

## D-07 · Reintentos del despachador del origen

- **Fecha:** 2026-10-25
- **Decisión:** máximo 6 intentos en total, backoff exponencial (1 s, 2 s, 4 s…) con jitter del 30 %. Reintenta ante cualquier respuesta no 2xx o fallo de red, **excepto** si el cuerpo trae un código que LinkedIn no reintenta (`SIGNATURE_MISMATCH`, `MISSING_REQUIRED_RESPONSE`, `INPUT_VALIDATION_FAILED`, `JOB_POSTING_CLOSED`, `DUPLICATE_APPLICATION_RECEIVED`).
- **Alternativa descartada:** reintentar todo lo no 2xx. Insistiría con errores definitivos.
- **Motivo:** imitar el comportamiento documentado (F1).

## D-08 · Estados y paso del puente; copia temporal del CV

- **Fecha:** 2026-10-25
- **Decisión:** `Recepcion.estado` ∈ {RECIBIDO, PROCESANDO, COMPLETADO, RECHAZADO, FALLIDO_REINTENTABLE, REQUIERE_VERIFICACION} y `paso` ∈ {cv_descargado, candidato_creado, documento_subido, postulacion_creada}. El trabajo (`Trabajo`) es aparte, tiene restricción única por recepción y se reserva con `FOR UPDATE SKIP LOCKED` y *lease* de 60 s. Los bytes del CV se guardan en la recepción solo hasta completar y luego se borran (minimización).
- **Alternativa descartada:** volver a descargar el CV en cada paso. Más tráfico y riesgo de que el enlace expire.
- **Motivo:** retomar desde el último paso confirmado tras un reinicio.

## D-09 · Datos guardados en el puente (minimización)

- **Fecha:** 2026-10-25
- **Decisión:** el puente no guarda el JSON completo. Guarda los campos que necesita (nombre, apellido, correo, teléfono, ciudad, mediaUrl/Urn) y el SHA-256 del cuerpo como evidencia.
- **Motivo:** principio de minimización (Ley 1581). El payload real trae datos sensibles (autoidentificación voluntaria) que el ATS no necesita.

## D-10 · Fechas en `timestamptz` y sesión en UTC

- **Fecha:** 2026-10-25
- **Decisión:** todas las fechas son `timestamptz(3)` y el cliente Prisma abre la sesión con `TimeZone=UTC` (`crearClientePrisma`).
- **Motivo:** con `timestamp` y la zona del servidor (America/Bogota), el adaptador pg guardaba las fechas con 5 h de desfase y el despachador no veía filas listas. Lo cubre la prueba de regresión `tests/zona-horaria.test.ts`.

## D-11 · Etapas de los procesos 9001 y 9002 (supuesto)

- **Fecha:** 2026-10-25
- **Contexto:** el prompt indica usar las etapas de `docs/referencia-ats.md`, pero **ese archivo no está en el repositorio** (tampoco `CLAUDE.md`).
- **Decisión:** «Postulantes» como primera etapa y «Contratados» como última (verificado en el centro de ayuda de BUK, F6). Intermedias supuestas: Preselección, Entrevista RR. HH., Prueba técnica, (Entrevista técnica), Oferta. Ver `docs/referencia-ats-supuesta.md`.
- **PENDIENTE:** reemplazar por las etapas reales cuando el equipo agregue `docs/referencia-ats.md`. Solo hay que editar `prisma/datos-demo.ts` y ejecutar `npm run demo:reset`.

### Actualizado por Claude Code (2026-10-25): etapas según el ATS de la empresa

- **Nueva fuente:** **observación directa del ATS de la empresa** en la socialización del 15/10/2026 (fotos), descrita por el equipo. Reemplaza el supuesto anterior.
- **Etapas, en orden** (procesos 9001, 9002 y los que se creen): Postulantes · Por contactar · Referidos · Sagrilaft · Prueba técnica · Entrevista técnica · Valoración psicológica · Suspendido · Contratados.
  - Postulantes … Suspendido: **Verificado** por observación directa (la foto se corta en «Suspendido»).
  - Contratados: **Verificado** en el centro de ayuda de BUK (F6), **no** en la foto.
- **Tipo de etapa** (Filtro / Validaciones / Entrevistas): **Supuesto pendiente** para cada etapa. El equipo indicó que la referencia muestra el tipo, pero no qué tipo corresponde a cada etapa, y el archivo `docs/referencia-ats.md` **no está en el repositorio** (búsqueda del 2026-10-25). Asignación provisional: Filtro (Postulantes, Por contactar, Referidos, Suspendido), Validaciones (Sagrilaft, Prueba técnica, Valoración psicológica), Entrevistas (Entrevista técnica) y sin tipo en Contratados (etapa final). Se corrige en `src/modules/ats/etapas.ts` y se aplica con `npm run demo:reset`.
- **«Descartados (n)» por columna:** sección plegable en cada etapa; el reclutador puede descartar y restaurar sin cambiar de etapa (`PostulacionAts.descartadaEn`). Es coherente con F7 (existe «Descartados»), aunque F7 lo describe como una etapa y aquí se muestra por columna, según la referencia del equipo.
- **Alternativa descartada:** mantener las etapas supuestas o inventar los tipos sin marcarlos.
- **PENDIENTE:** agregar `docs/referencia-ats.md` al repositorio y confirmar el tipo de cada etapa.

## D-12 · Protección de modos de prueba y demo por host local

- **Fecha:** 2026-10-25
- **Decisión:** los controles de fallos (`SIMULADOR_MODO_PRUEBA`) y la autenticación de demostración solo se activan si la variable está en `true` **y** `APP_BASE_URL` es `localhost`, `127.0.0.1`, `::1` o un dominio `.test`.
- **Alternativa descartada:** condicionar a `NODE_ENV !== "production"`. `next start` siempre corre en producción, así que la demo local no los tendría.
- **Motivo:** un despliegue real nunca se sirve desde localhost, así que no pueden quedar activos por accidente.

## D-13 · Alcance de la autenticación de demostración

- **Fecha:** 2026-10-25
- **Decisión:** una sola sesión de demo (usuario y contraseña de `.env`, cookie `tb_sesion` HttpOnly, SameSite=Lax, firmada con HMAC-SHA256 y válida 8 h) protege el **panel del puente** (`/puente/*`) y la **interfaz del ATS simulado** (`/ats/*`, incluida la descarga de CV). El portal de origen es público (es el portal de empleo). El webhook se protege con firma, la API del ATS con `ATS_API_KEY` y la URL del CV con Bearer. El `proxy` hace la comprobación optimista y la verificación definitiva se repite en layouts, descarga y cada server action.
- **Alternativa descartada:** dejar el ATS abierto (expone datos de candidatos, aunque sean ficticios) o un inicio de sesión por módulo (más pasos en la demo).
- **Motivo:** proteger lo interno sin complicar la demostración. Si falta configuración o el host no es local, el panel queda **cerrado** (falla segura).

## D-14 · Política de reintentos del puente

- **Fecha:** 2026-10-25
- **Decisión:** hasta 8 intentos por trabajo, con backoff exponencial desde 2 s (tope 5 min) y jitter (entre 50 % y 150 % del valor). Se clasifican los fallos:
  - **rechazar** (no se reintenta nunca): CV inválido, demasiado grande o expirado, vacante sin correspondencia, validación del ATS.
  - **reintentar**: red, 5xx o 429 del ATS u origen, transferencia incompleta.
  - **detener** (sin reintento automático; el panel ofrece «Reintentar»): credenciales rechazadas por el ATS o el origen.
  - Si se agotan los intentos con una escritura de resultado desconocido (`ATS_SIN_RESPUESTA`) → **REQUIERE_VERIFICACION** (el panel ofrece «Reconciliar»). En otro caso → FALLIDO_REINTENTABLE detenido.
- **Ajuste por entorno:** `PUENTE_MAX_INTENTOS` y `PUENTE_BACKOFF_BASE_MS` (los E2E usan 3 y 300 ms).
- **Motivo:** no insistir con errores definitivos, no repetir a ciegas una escritura incierta y no perder el progreso por paso.

## D-15 · Administración del simulador de origen y consola de pruebas

- **Fecha:** 2026-10-25
- **Decisión:** `/origen/admin` (con sesión de demo) permite publicar y editar vacantes, cerrarlas o reabrirlas, ver la outbox y **reenviar un evento** (mismo cuerpo, misma firma). `/origen/admin/consola` envía al webhook entregas inválidas predefinidas (equivale a Postman, ficha 2.8). En el ATS, «Nuevo proceso» crea procesos con la plantilla de etapas.
- **Alternativa descartada:** preparar vacantes y procesos solo con seeds, o reenviar con `curl`. No permitiría demostrar a mano los criterios 1, 6 y 7.
- **Motivo:** cada criterio del 29/10 se puede mostrar desde la interfaz.

## D-16 · Supervisor de procesos para las pruebas E2E

- **Fecha:** 2026-10-25
- **Decisión:** `e2e/supervisor.mjs`, iniciado por `globalSetup`, es dueño de la app (`next start`, puerto 3200) y del worker durante toda la ejecución. Las pruebas piden los reinicios por HTTP (puerto 3299).
- **Alternativa descartada:** arrancarlos desde el proceso de la prueba. Morían al cambiar de proyecto de Playwright (fallo real observado).
- **Motivo:** probar el criterio 8 (reiniciar sin perder datos) de forma estable.

## D-17 · Cierre de vacantes propagado por la outbox, respetando a quien se postuló antes

- **Fecha:** 2026-10-25 (P5)
- **Decisión:** cerrar o reabrir una vacante en el origen genera, en la misma transacción, un evento `JOB_POSTING_STATUS` en la outbox. El puente lo recibe firmado y marca la correspondencia con `cerradaEn`. Las postulaciones hechas **antes** del cierre se aceptan aunque lleguen tarde; las posteriores reciben `JOB_POSTING_CLOSED`. Detalle en docs/contratos.md §2.1.
- **Alternativas descartadas:** que el puente lea la tabla de vacantes del origen (rompe la separación por contrato, D-02); una llamada HTTP síncrona al cerrar (si el puente está caído, el cierre se pierde); rechazar todo lo que llegue después del cierre (castiga al postulante por una demora de entrega que no es suya).
- **Motivo:** el cierre no se pierde ante caídas, el orden de llegada no importa y el postulante no queda perjudicado.

## D-18 · Prueba de transferencia interrumpida y contratos independientes

- **Fecha:** 2026-10-25 (P5)
- **Decisión:** el modo de prueba `media → INTERRUMPIR` envía los encabezados y la mitad del PDF y luego corta la conexión. El puente lo detecta (bytes ≠ `Content-Length` o error de lectura), lo marca `CV_TRANSFERENCIA_INCOMPLETA`, no avanza de paso y reintenta. Las pruebas de contrato (`tests/contratos/`) validan el origen contra un validador escrito a mano desde F1/F2 y contra el **ejemplo oficial** de LinkedIn, sin usar el esquema Zod del puente; el ATS se prueba con HTTP crudo contra docs/contratos.md §3.
- **Motivo:** que un error compartido entre origen y puente no pase como correcto (requisito de P5).

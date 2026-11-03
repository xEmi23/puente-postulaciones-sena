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

### Actualizado por Claude Code (2026-10-25): tipos de etapa confirmados

- **Fuente de los tipos:** **observación directa del ATS de la empresa (15/10/2026)**, tabla de `docs/referencia-ats.md`. Deja de ser «Supuesto pendiente» y reemplaza la asignación provisional de la sección anterior.
- **Tipos:** Postulantes = entrada (sin tipo) · Por contactar = Filtro · Referidos = Validaciones · Sagrilaft = Validaciones · Prueba técnica = Filtro · Entrevista técnica = Entrevistas · Valoración psicológica = Entrevistas · Suspendido = Filtro.
- **Contratados:** sin tipo, se muestra como «Etapa final». Sigue siendo **Verificado** en el centro de ayuda de BUK (F6), no en la foto.
- `docs/referencia-ats-supuesta.md` queda reemplazado por `docs/referencia-ats.md`.

## D-19 · Diferencias con el plan del equipo y con docs/referencia-ats.md (**RESUELTA**, ver abajo)

- **Fecha:** 2026-10-25
- **Estructura (Decisión interna, ya aplicada):** rutas `/origen`, `/ats` y `/puente` en lugar de grupos `(…)`; módulos planos en lugar de `domain/application/infrastructure`; CV en `bytea` por esquema en lugar de `storage/<módulo>`. Motivos en la tabla de `CLAUDE.md`.
- **Pendientes de decidir con el equipo (no se cambiaron):**
  - **Texto de la fuente:** `docs/referencia-ats.md` pide «Portal simulado (tipo LinkedIn)»; hoy se muestra «LinkedIn Easy Apply (simulado)», porque F1 pide marcar la fuente como «LinkedIn Easy Apply». La regla del equipo («nunca afirmar conexión con LinkedIn») favorece el texto del equipo. Cambiarlo es una línea (`FUENTE_ATS` en `src/modules/puente/procesador.ts`) más pruebas y documentos.
  - **Campos del proceso** observados que no tiene el simulador: prioridad, fecha de inicio, vigencia y estado «Iniciado» (hoy «Abierto»).
  - **Tarjeta:** casilla de selección e ícono de IA no están (la calificación con IA está fuera de alcance, según el mismo documento).

### D-19 resuelta (2026-10-25, decisión del equipo)

- **Fuente:** el texto visible es **«Portal simulado (tipo LinkedIn)»** (`FUENTE_ATS`). El contrato técnico interno conserva los nombres de la documentación de LinkedIn (`EXPORT_JOB_APPLICATION`, `jobApplicationId`, etc.), pero **ningún texto visible dice «LinkedIn Easy Apply»**. Lo comprueba `e2e/proceso-encabezado.spec.ts` recorriendo las pantallas principales.
- **Proceso:** se agregaron **prioridad** (Alta/Media/Baja), **fecha de inicio**, **vigencia** (días completos desde el inicio, calculada al mostrarla) y **estado «Iniciado»** en lugar de «Abierto» (migración `proceso_prioridad_inicio`, que convierte los `ABIERTO` existentes). Se muestran en el encabezado del proceso y en la lista, como en `docs/referencia-ats.md`. Seed ficticio: 9001 Alta, iniciado hace 10 días; 9002 Media, hace 3 días. «Nuevo proceso» pide prioridad y fecha de inicio. Solo un proceso «Iniciado» recibe postulaciones (`PROCESO_CERRADO` en otro caso).
- **Tarjeta:** casilla de selección **solo visual** (sin acciones masivas). **Sin ícono de IA**: la calificación está fuera de alcance y la tarjeta muestra «Sin calificar».
- **Estructura** (rutas, módulos, `bytea`): se mantiene como se describe en `CLAUDE.md`.

---

# Versión 2

> Actualizado por Claude Code (2026-10-28). Decisiones de la v2 (docs/v2/SOLUCION.md y docs/v2/ESPECIFICACION.md).

## D-20 · Monorepo con npm workspaces y tres apps sin código compartido

- **Fecha:** 2026-10-28 (F0)
- **Decisión:** `apps/vinculo` (sale del origen v1), `apps/talentia` (sale del ATS v1) y `apps/puente` (sale del puente v1 con su worker), cada una con su `package.json`, `prisma/schema.prisma`, migraciones, cliente generado en `src/generated/prisma` y pruebas. Las utilidades pequeñas (`lib/firma`, `lib/archivos`, `lib/http`, `lib/fechas`, `lib/sesion`) se **duplican** en cada app; no hay `packages/` todavía. Reemplaza D-02 (una sola app con tres módulos).
- **Alternativa descartada:** un paquete `packages/comun` con esas utilidades. Es legal (no es dominio), pero acopla versiones entre apps y cada sistema evoluciona distinto (Vínculo firma y el puente verifica).
- **Motivo:** independencia real exigida por ESPECIFICACION §0.1: ninguna app importa nada de otra.

## D-21 · Una base, un esquema por sistema, migraciones dentro del esquema

- **Fecha:** 2026-10-28 (F0)
- **Decisión:** el `DATABASE_URL` no lleva esquema. Cada app usa `DB_SCHEMA` (por defecto `vinculo`, `talentia` o `puente`): `prisma.config.ts` agrega `?schema=` para las migraciones (la tabla `_prisma_migrations` queda dentro del esquema) y el cliente usa la opción `schema` del adaptador pg más `search_path` (las consultas SQL crudas usan nombres sin esquema). Las migraciones de la v1 se reemplazaron por una migración inicial por app (la historia de la v1 sigue en git). PostgreSQL local del proyecto en el **5435** con `tb2_dev`, `tb2_test` y `tb2_e2e`; el clúster de la v1 (5433) no se toca.
- **Alternativa descartada:** un solo `schema.prisma` con `multiSchema` (como la v1): un cliente y un historial de migraciones compartidos rompen la independencia.
- **Motivo:** en Render hay una sola base gratuita (SOLUCION §7); así las tres apps la comparten sin mezclar tablas ni historial. En producción cada sistema tendría su base.

## D-22 · Estrategia de pruebas entre sistemas independientes

- **Fecha:** 2026-10-28 (F0)
- **Decisión:** cada app tiene su Vitest contra PostgreSQL real (su esquema en `tb2_test`), con sus rutas reales llamadas en proceso. Las pruebas del puente usan **dobles de contrato** de Vínculo y Talentia (`apps/puente/tests/dobles.ts`), escritos desde docs/contratos.md sin importar código de esas apps; las pruebas de contrato de cada simulador verifican que el sistema real cumple ese mismo contrato. El recorrido entre los tres se prueba con Playwright contra **procesos reales** (`e2e/supervisor.mjs` arranca y reinicia cada app y cada worker en los puertos 3211–3213).
- **Alternativa descartada:** cargar en un mismo proceso de Vitest las rutas de las tres apps. Exige importar código entre apps y las tres leerían el mismo `process.env` (URLs y secretos chocan).
- **Motivo:** probar el puente como se usaría en la vida real: solo por HTTP y contra un contrato.

## D-23 · Fallos inyectables en los conectores del puente

- **Fecha:** 2026-10-28 (F0)
- **Decisión:** los fallos de prueba (NO_DISPONIBLE, PERDER_RESPUESTA, LENTO, CREDENCIALES, INTERRUMPIR) se aplican en las llamadas HTTP salientes del puente (`apps/puente/src/modules/fallos.ts`, tabla `puente.FalloSimulado`), no dentro de Talentia ni de Vínculo. Solo existen con `PUENTE_MODO_PRUEBAS=1` y host local (misma protección que D-12). PERDER_RESPUESTA hace la llamada real y luego falla como un corte de red; LENTO retiene la respuesta más que el tiempo de espera; INTERRUMPIR corta el cuerpo a la mitad conservando `Content-Length`.
- **Alternativa descartada:** controles de fallos dentro de cada simulador (v1). Los simuladores tendrían código de prueba expuesto en Render y el puente dependería de esa cooperación.
- **Motivo:** ESPECIFICACION §4.2 pone `/pruebas` en el puente; además «Talentia caído» se prueba de verdad deteniendo el proceso de Talentia en las E2E.

## D-24 · Workers dentro del proceso web o aparte

- **Fecha:** 2026-10-28 (F0)
- **Decisión:** el despachador de Vínculo y el procesador del puente arrancan en `instrumentation.ts` cuando `WORKER_EN_PROCESO=1` (lo que se usa en Render y en `npm run dev`), con apagado ordenado en SIGTERM. `npm run worker -w apps/<app>` los corre aparte; las E2E los corren aparte para poder matar el worker sin matar la web (criterio 8 de la v1).
- **Alternativa descartada:** solo procesos aparte (Render gratuito no los permite) o solo dentro de la web (no se podría probar la caída aislada del worker).
- **Motivo:** ESPECIFICACION §6 y conservar las pruebas de reinicio de la v1.

## D-25 · F0 conserva los contratos y la autenticación de la v1 (transitorio)

- **Fecha:** 2026-10-28 (F0)
- **Decisión:** en F0 los sistemas siguen hablando con los contratos de la v1 (webhook del puente en `/api/puente/webhook`, CV en `/api/origen/media/{id}`, API del ATS en `/api/ats/v1/...`) y con secretos compartidos por variables de entorno que `npm run setup` genera una vez en el `.env` de la raíz y copia al `.env` de cada app. Cada app tiene su propio inicio de sesión de demostración con cookie propia (`vin_sesion`, `tal_sesion`, `pue_sesion`). F1–F3 reemplazan esto por las APIs de la especificación, API Keys y credenciales configuradas en `/conexiones`.
- **Motivo:** la puerta de F0 exige que las pruebas y el recorrido de la v1 sigan pasando antes de cambiar los contratos.

## D-26 · Encabezado de la API Key de Talentia: `auth_token` (Supuesto pendiente)

- **Fecha:** 2026-10-28 (F1)
- **Investigación:** el artículo público de BUK «Integración del módulo de Selección por API» (https://supportcenter.buk.co/hc/es-419/articles/49474572553755, actualizado el 28/10/2026, consultado el 28/10/2026) **verifica**: la API Key se crea en Administración con permisos de Selección «Lectura» y «Modificación»; recursos Postulantes (GET, POST, PATCH), Postulación (GET, POST, PATCH) y Procesos de Selección (GET, POST); documentación en `<empresa>.buk.cl/apidocs`. **No** dice el nombre del encabezado; una búsqueda web tampoco lo encontró en fuentes de BUK.
- **Decisión:** Talentia recibe la llave en el encabezado `auth_token`, marcado **Supuesto pendiente** en el código, en `/apidocs` y en docs/contratos.md.
- **Alternativa descartada:** `Authorization: Bearer` (estándar, pero la especificación pide `auth_token` si no se verifica).
- **Pendiente (empresa):** confirmar el encabezado real en el `/apidocs` de su cuenta de BUK.

## D-27 · Autenticación con Better Auth en cada app

- **Fecha:** 2026-10-28 (F1; Vínculo y puente en F2 y F3)
- **Decisión:** Better Auth 1.7.10 (librería mantenida, ESPECIFICACION §2.1) con su adaptador de Prisma, correo y contraseña (hash scrypt), sesiones en la base del sistema y cookie propia (`tal_sesion` en Talentia). Roles como campo adicional `rol` del usuario. Talentia no permite registro público (las cuentas son de la empresa); la siembra crea la administradora y el reclutador con contraseña común de demostración, visible en la pantalla de ingreso a propósito (§3.1). Versión fijada con más de dos semanas de publicada.
- **Alternativa descartada:** Auth.js (v5 sigue en beta y desaconseja credenciales con contraseña) y mantener la sesión propia de la v1 (la especificación pide una librería mantenida).
- **Motivo:** cumplir §2.1/§3.1 con algo auditado; cada app conserva su propia instancia, tablas y secreto (`BETTER_AUTH_SECRET`).

## D-28 · Migración inicial consolidada mientras no haya despliegue

- **Fecha:** 2026-10-28 (F1)
- **Decisión:** mientras la v2 no se haya desplegado, cada cambio de modelo regenera la migración inicial de la app (`prisma migrate diff --from-empty`) y el esquema local se recrea (`DROP SCHEMA` en el clúster del proyecto, que solo tiene datos de demostración). Desde el primer despliegue (F7) los cambios irán en migraciones nuevas.
- **Alternativa descartada:** acumular migraciones de transición (renombres Candidato → Postulante, etc.) que nadie va a aplicar en una base real.

## D-29 · Diseño de la API v1 de Talentia (contrato del simulador)

- **Fecha:** 2026-10-28 (F1)
- **Decisión:** rutas `/api/v1/seleccion/{procesos,postulantes,postulantes/{id}/documentos,postulaciones}` y `/api/v1/api-key`; JSON en snake_case con envoltura `{ data }` (y `paginacion` en postulantes); errores `{ error: { codigo, mensaje, detalle? } }`. GET exige Lectura y POST/PATCH Modificación (403 `PERMISO_INSUFICIENTE`); sin llave, inválida o revocada → 401 `NO_AUTORIZADO`. Límite de 120 por minuto por llave en ventana fija de un minuto guardada en PostgreSQL (vale con varias instancias) → 429 con `Retry-After`. Idempotency-Key por llave (la misma clave con otra llave es independiente). La llave se guarda como SHA-256 con prefijo visible (`tal_xxxxxxxx`) y se muestra una vez, en el resultado de la acción (nunca en la URL). El registro de actividad guarda la ruta como plantilla (`/postulantes/{id}`), sin cuerpos. `POST /postulaciones` con la misma `referencia_externa` devuelve 200 con la existente; la misma persona en el proceso con otra referencia, 409 con `detalle.postulacion_id`. `POST /postulantes` con un correo existente, 409 con `detalle.postulante_id`. OpenAPI 3.1 generado desde los esquemas Zod (`z.toJSONSchema`), servido en `/api/openapi.json` y renderizado con Swagger UI local en `/apidocs` (sin CDN).
- **Motivo:** recursos y permisos como lo verificado de BUK (D-26); forma propia y documentada para todo lo demás.

## D-30 · El conector del puente sigue a Talentia en la misma fase

- **Fecha:** 2026-10-28 (F1)
- **Decisión:** al cambiar la API de Talentia se actualizó en la misma fase `apps/puente/src/modules/ats-cliente.ts` (busca postulante por correo y lo actualiza o crea; documento multipart; `auth_token`) y su doble de pruebas, para que el recorrido completo siga en verde. Las Idempotency-Key del puente pasan a derivarse de (`jobApplicationId`, paso) como pide §4.3. Transitorio hasta F3: la siembra de Talentia registra como API Key la llave que el puente tiene en su `.env` (`TALENTIA_LLAVE_PUENTE`).

## D-31 · Client Secret de Vínculo cifrado, no con hash

- **Fecha:** 2026-10-28 (F2)
- **Decisión:** el Client Secret de cada aplicación se guarda cifrado con AES-256-GCM (`VINCULO_CLAVE_CIFRADO`, 32 bytes) y se muestra una sola vez, en el resultado de la acción (nunca en la URL). Regenerarlo o revocar la aplicación incrementa `secretoVersion`, lo que invalida los tokens ya emitidos.
- **Alternativa descartada:** guardar solo un hash (como las API Keys de Talentia). Vínculo necesita el secreto en claro para firmar cada entrega (`X-LI-Signature`) y calcular el `challengeResponse`, igual que LinkedIn. SOLUCION §6 admite «hash o cifrado».

## D-32 · Tokens de aplicación JWT HS256 de 60 minutos

- **Fecha:** 2026-10-28 (F2)
- **Decisión:** `POST /oauth/v2/accessToken` con `grant_type=client_credentials` (formulario o JSON) devuelve un JWT HS256 (`VINCULO_JWT_SECRET`, librería `jose`) con la aplicación y la versión del secreto; dura 3600 s. Errores al estilo OAuth (`invalid_client`, 401).
- **Motivo:** ESPECIFICACION §2.3; sin tabla de tokens, pero revocable por versión.

## D-33 · API de Vínculo (contrato del simulador modelado sobre Apply Connect)

- **Fecha:** 2026-10-28 (F2)
- **Decisión:** rutas `/api/v1/jobPostings` (crear o actualizar, idempotente por aplicación + `externalJobId`), `/api/v1/jobPostings/{externalJobId}/close`, `/api/v1/autorizaciones` (empresas que autorizaron la aplicación: así el integrador obtiene el `companyId` sin copiarlo a mano), `/api/v1/media/{id}` y `/api/v1/jobApplications/{id}/lifecycle`. Errores `{ status, code, message, details? }`. El cuerpo de la entrega, la firma, el desafío, los códigos de error y el mediaUrl con Bearer siguen lo **Verificado** (docs/contratos.md §1); lo demás es nuestro y así lo dice el OpenAPI (`/developers/docs`, con la sección `webhooks`). `jobPostings` acepta además `experienceLevel` y `companyApplyUrl`; la respuesta informa `applyMethod` (`ONSITE_APPLY` = Solicitud sencilla, `COMPANY_SITE`) y el motivo si no quedó con Solicitud sencilla.
- **Desafío del webhook:** al registrar la URL en `/developers` y antes de publicar con `onsiteApply`. Si falla, la vacante se publica como «postulación en el sitio de la empresa» (como LinkedIn). **No** se revalida cada 2 h (F2 lo describe en LinkedIn): queda como posible mejora.

## D-34 · «Solicitud sencilla» con o sin ATS conectado

- **Fecha:** 2026-10-28 (F2)
- **Decisión:** una vacante puede recibir con Solicitud sencilla aunque no tenga un ATS conectado: las solicitudes quedan en Vínculo y el reclutador descarga cada CV a mano desde su panel. Así se muestra el problema actual de la ficha. Las 6 vacantes sembradas de Andina están así, con 12 solicitudes. Con un ATS conectado (aplicación autorizada con webhook validado), cada solicitud se entrega por el outbox. Lo que hace el reclutador en Vínculo también avanza el estado que ve el candidato (abrir/marcar → «Vista por la empresa», descargar → «CV descargado», «No seleccionar»), igual que la API de ciclo de vida.
- **Alternativa descartada:** atar la Solicitud sencilla a la integración (no permitiría mostrar el antes y el después).

## D-35 · Sin evento JOB_POSTING_STATUS en la v2

- **Fecha:** 2026-10-28 (F2)
- **Decisión:** Vínculo ya no envía el evento de cierre del simulador v1 (D-17). Una vacante cerrada en Vínculo deja de aceptar solicitudes en el propio Vínculo; las vacantes que publica el puente se cierran por la API (`close`, F3), y el puente aplica la regla de D-17 (respeta lo postulado antes del cierre) con sus propios registros. El endpoint del puente `/api/puente/vacantes/estado` y sus pruebas siguen hasta que F3 lo reemplace.
- **Motivo:** en Apply Connect el cierre lo decide el ATS; el evento era una invención necesaria solo cuando no había API de publicación.

## D-36 · Reintentos de entrega con ventana de unos 15 minutos

- **Fecha:** 2026-10-28 (F2)
- **Decisión:** máximo 6 intentos (F1), espera exponencial desde 30 s con ±10 % (30 s, 1, 2, 4 y 8 min: unos 15 min en total) y 75 s de espera por intento (`VINCULO_TIMEOUT_ENTREGA_MS`), para cubrir el arranque en frío de Render (§2.3, §6). Se respetan los códigos que LinkedIn no reintenta (D-07). Las pruebas bajan la base con `VINCULO_BACKOFF_BASE_MS`.

## D-37 · Protección SSRF para los webhooks registrados

- **Fecha:** 2026-10-28 (F2)
- **Decisión:** antes de llamar a un webhook, Vínculo exige http(s) sin credenciales en la URL; en un despliegue público además exige https y rechaza destinos que resuelvan a redes privadas, de loopback o de enlace local (incluido 169.254.169.254). En local (demo) se permiten `http://localhost`.

## D-38 · Copia del CV por solicitud y mediaUrl solo para la aplicación dueña

- **Fecha:** 2026-10-28 (F2)
- **Decisión:** cada solicitud guarda su propia copia del CV (lo enviado no cambia si la persona actualiza su perfil), con `mediaUrn` y vencimiento de 30 días. `GET /api/v1/media/{id}` exige el token de la aplicación dueña de la vacante (otra aplicación: 403; vencido: 410). El puente acepta solo mediaUrl con el host de Vínculo configurado y la ruta `/api/v1/media/`.

## D-39 · Datos de demostración generados

- **Fecha:** 2026-10-28 (F2)
- **Decisión:** generador determinista (`apps/vinculo/prisma/generador.ts`): nombres por combinación de listas de nombres y apellidos comunes en Colombia, con una lista de combinaciones descartadas por coincidir con figuras públicas; correos `@demo.test`; CV PDF de una página con pdf-lib (banda de color, perfil, experiencia, educación, habilidades y la leyenda «documento ficticio»). Empresas con nombres inventados y sitios `.test`. Cuentas de demostración: `valentina.rios@demo.test`, `santiago.mejia@demo.test` y `reclutadora@andina.demo.test`, contraseña `Demo2026!`, visibles en `/ingresar`.
- **Pendiente (equipo):** revisar a ojo la lista de nombres generados.

## D-40 · Punto único de salida HTTP en Vínculo

- **Fecha:** 2026-10-28 (F2)
- **Decisión:** las llamadas salientes de Vínculo (desafío y entregas) usan `fetchSaliente()` (`src/lib/salida.ts`), que las pruebas reemplazan por un fetch en proceso con webhooks dobles. En ejecución normal es el fetch global.

## D-41 · Conexiones del puente guardadas en su base, cifradas (reemplaza la siembra transitoria de D-25)

- **Fecha:** 2026-10-29 (F3)
- **Decisión:** las URL y credenciales de Vínculo (Client ID y Client Secret) y de Talentia (API Key) se configuran en `/conexiones` y se guardan en `puente.Conexion`, con el secreto cifrado con AES-256-GCM (`PUENTE_CLAVE_CIFRADO`, solo en `.env`) y visible solo como `••••` más sus 4 últimos caracteres. «Probar conexión» deja su resultado guardado (token y empresa que autorizó la aplicación; permisos de la llave y procesos visibles). Ya no hay `ORIGEN_BASE_URL`, `ATS_BASE_URL`, `ATS_API_KEY` ni secretos compartidos entre `.env`.
- **Alternativa descartada:** variables de entorno por conexión. Obligan a reiniciar y a copiar secretos entre apps; la especificación pide configurarlas en pantalla.

## D-42 · Better Auth en el puente con dos roles

- **Fecha:** 2026-10-29 (F3)
- **Decisión:** igual que en Talentia (D-27): correo y contraseña, sin registro público, cookie `pue_sesion`. ADMIN configura conexiones, publicación, correspondencias y los controles de prueba; OPERADOR supervisa operaciones, rechazos y métricas y puede reintentar. Cuentas demo `admin@puente.demo.test` y `operador@puente.demo.test` (`Demo2026!`), visibles en `/ingresar`.
- **Alternativa descartada:** el usuario único de demostración de la v1 (`DEMO_ADMIN_USER`).

## D-43 · Webhook en `/api/webhooks/vinculo` y 503 sin conexión

- **Fecha:** 2026-10-29 (F3)
- **Decisión:** el webhook del puente pasa a `/api/webhooks/vinculo` (GET desafío, POST entregas). El desafío y la firma usan el Client Secret guardado; si aún no hay conexión con Vínculo responde 503 para que Vínculo reintente, sin guardar nada. Se elimina `/api/puente/vacantes/estado` (D-35).

## D-44 · Publicación desde el puente y resolución del proceso

- **Fecha:** 2026-10-29 (F3)
- **Decisión:** «Publicar en Vínculo» (en `/procesos`) crea o actualiza la vacante por `POST /api/v1/jobPostings` con `externalJobId` = id del proceso de Talentia y el webhook del puente; «Cerrar en Vínculo» usa `close`. El destino de una postulación se resuelve primero por publicación y, para vacantes creadas a mano en Vínculo, por correspondencia manual; en ambos casos se aplica D-17 (se respeta lo postulado antes del cierre). Publicación automática opcional: cada 2 minutos se publican los procesos «Iniciados» sin publicación (`PUENTE_SONDEO_MS`).

## D-45 · Errores de Talentia: 401 y 403 detienen, 429 respeta Retry-After

- **Fecha:** 2026-10-29 (F3)
- **Decisión:** 401 (llave revocada o inválida) → `ATS_AUTENTICACION`, se detiene sin reintentar con el mensaje «La API Key de Talentia fue revocada o no es válida.»; 403 → `ATS_PERMISO`, se detiene; 429 → `ATS_LIMITE`, se reintenta esperando al menos `Retry-After`. Sin conexión configurada → `PUENTE_SIN_CONEXION`, se detiene. Tras corregir la conexión, «Reintentar» continúa desde el último paso.
- **Decisión complementaria:** si Vínculo rechaza el access token al descargar el CV (por ejemplo tras regenerar el Client Secret), el puente pide un token nuevo una vez antes de dar el error por definitivo.

## D-46 · Reintentos y esperas del puente para el arranque en frío

- **Fecha:** 2026-10-29 (F3)
- **Decisión:** hasta 10 intentos por postulación con espera exponencial desde 2 s y tope de 5 min (unos 13 min en total); espera por llamada de 75 s si el sistema destino no respondió en los últimos 10 minutos (puede estar dormido en Render) y de 20 s si respondió hace poco (`PUENTE_TIMEOUT_MS` lo fija en pruebas). En `/conexiones`, «Probar conexión» muestra «Despertando…» si tarda más de 3 s.

## D-47 · Aviso RESUME_DOWNLOADED en un ciclo aparte

- **Fecha:** 2026-10-29 (F3)
- **Decisión:** al completar, la recepción queda con aviso PENDIENTE y un ciclo del worker llama a `POST /api/v1/jobApplications/{id}/lifecycle` con `RESUME_DOWNLOADED` (hasta 8 intentos con espera creciente). Su resultado se ve en la operación, pero no cambia el COMPLETADO: la transferencia ya terminó cuando existe `postulacion_creada`.
- **Alternativa descartada:** avisar dentro del mismo trabajo; una caída de Vínculo dejaría la transferencia como no completada.

## D-48 · `demo:conectar` como orquestación por procesos

- **Fecha:** 2026-10-29 (F3)
- **Decisión:** `npm run demo:conectar` (y la preparación de las E2E) hace lo mismo que el administrador en las pantallas, ejecutando en cada app su propio script con su propio `.env` (`scripts/conectar-lib.mjs`): Talentia crea la API Key, Vínculo registra y autoriza la aplicación, el puente guarda y prueba las conexiones y publica 9001 y 9002, y Vínculo registra el webhook. Ninguna app toca el esquema de otra. `demo:reset` del puente borra conexiones y publicaciones; después hay que volver a conectar.

## D-49 · CV ficticios propios de Talentia en la siembra

- **Fecha:** 2026-10-29 (F4)
- **Decisión:** los 15 postulantes sembrados en Talentia llevan un CV PDF de una página generado con pdf-lib en `apps/talentia/prisma/cv-demo.ts`, con la leyenda «documento ficticio». No se reutiliza el generador de Vínculo: cada sistema es independiente (regla de no importar dominio entre apps). Las fechas del historial coinciden con la fecha de la postulación.
- **Alternativa descartada:** copiar los PDF de `fixtures/cv/`; sus nombres no coinciden con los postulantes y la ficha se vería incoherente.

## D-50 · Claves de cifrado derivadas cuando no son hexadecimales

- **Fecha:** 2026-10-29 (F7)
- **Decisión:** `VINCULO_CLAVE_CIFRADO` y `PUENTE_CLAVE_CIFRADO` aceptan 64 hexadecimales (lo que genera `npm run setup`, se usan tal cual) o cualquier secreto de 32+ caracteres, del que se deriva la clave AES-256 con SHA-256. Así `render.yaml` puede usar `generateValue` sin variables manuales.
- **Alternativa descartada:** `sync: false` para que alguien pegue una clave hexadecimal en Render (la especificación pide no usar `sync: false`).

## D-51 · Render: una base, tres esquemas, siembra solo si está vacía

- **Fecha:** 2026-10-29 (F7)
- **Decisión:** el plan gratuito permite una base PostgreSQL; los tres servicios la comparten con `DB_SCHEMA` distinto (cada uno con su `_prisma_migrations`). El `startCommand` migra y siembra con `--si-vacio` (no siembra si ya hay usuarios), porque la siembra normal borra y recrea los datos demo y en Render se ejecutaría en cada arranque o despertar. Las conexiones entre sistemas se configuran en las pantallas tras el primer despliegue (no hay forma segura de pasar secretos entre servicios en el Blueprint sin compartirlos).
- **Alternativa descartada:** tres bases (el plan gratuito no lo permite) y ejecutar `demo:conectar` en el despliegue (exigiría que un servicio conozca los secretos de otro).

---

# V4 (desde el 2026-11-02)

> Actualizado por Claude Code (2026-11-02). Especificación vigente: `docs/v4/ESPECIFICACION_V4.md`.

## D-52 · Estados V4 derivados de los estados v2 (sin cambiar las pruebas existentes)

- **Fecha:** 2026-11-02 (F1)
- **Decisión:** la base conserva los estados de la v2 (`RECIBIDO, PROCESANDO, COMPLETADO, RECHAZADO, FALLIDO_REINTENTABLE, REQUIERE_VERIFICACION`) y el paso `cv_descargado`, porque las pruebas existentes los afirman y R.2 prohíbe cambiar sus aserciones. La interfaz y la API nueva muestran el **estado V4**, derivado: `RECIBIDO→RECIBIDA`, `PROCESANDO→EN_PROCESO`, `COMPLETADO→COMPLETADA`, `RECHAZADO→FALLIDA_DEFINITIVA`, `FALLIDO_REINTENTABLE` con el trabajo detenido → `FALLIDA_DEFINITIVA`, si no → `FALLIDA_REINTENTABLE`. `REQUIERE_REVISION` se agrega como estado nuevo (F2). `REQUIERE_VERIFICACION` (respuesta perdida del ATS, v2) se conserva. `cv_descargado` equivale a `cv_verificado` («CV obtenido y verificado»). `DUPLICADA` es una respuesta, no una fila: la clave única impide guardar la segunda llegada.
- **Alternativa descartada:** renombrar el enum (rompería 20+ aserciones existentes).

## D-53 · Ubicación de la estructura V4 en el código real

- **Fecha:** 2026-11-02 (F1)
- **Decisión:** `apps/puente/src/nucleo/{contrato,recepcion,errores,fuentes}`, `src/entradas/{apply-connect,generica,importador}`, `src/salidas/{conector-ats.ts,talentia,buk,index.ts}`. `src/modules/procesador.ts` y `src/modules/webhook.ts` se quedan donde estaban (las pruebas los importan); el procesador ya no conoce Talentia ni Vínculo y el webhook es el adaptador HTTP de Apply Connect que delega en `registrarRecepcion()`. `src/modules/ats-cliente.ts` se trasladó a `src/salidas/talentia/` y se eliminó. Una regla de ESLint (`no-restricted-imports`) y una prueba impiden importar un adaptador concreto fuera de `src/salidas/`.
- **Alternativa descartada:** mover todo `src/modules` a la estructura de la §5 (más riesgo de regresión sin beneficio visible).

## D-54 · ConectorATS con parámetros opcionales para conservar el comportamiento de la v2

- **Fecha:** 2026-11-02 (F1)
- **Decisión:** la interfaz tiene exactamente los métodos y capacidades de la §9, con dos ajustes compatibles: `crearPostulante` y `crearPostulacion` aceptan un `extra` opcional (referencia externa, documento vinculado y texto de la fuente) y `adjuntarCV` puede devolver `{ idDocumento }`. Sin eso, Talentia dejaría de vincular el documento a la postulación y de mostrar la fuente. `crearPostulante` busca por correo y actualiza si la persona existe (un postulante por persona, como en la v2). La reconciliación usa `consultarPostulacion(postulante, proceso)` (en Talentia, `GET /postulaciones?proceso_id=`), en lugar de la búsqueda por referencia de la v2. Los errores de cualquier adaptador son `ErrorConectorATS`.
- **Alternativa descartada:** una interfaz sin `extra` (perdía comportamiento visible en Talentia) o métodos propios de Talentia en la interfaz.

## D-55 · ATS_DESTINO y salud del Puente

- **Fecha:** 2026-11-02 (F1)
- **Decisión:** `ATS_DESTINO=talentia` (por defecto) o `buk`. Con un adaptador sin implementar (hoy `buk`), el worker no arranca el ciclo del procesador y `/api/salud` responde **503** con `«ATS buk no implementado»`; las postulaciones se siguen recibiendo y esperan. El adaptador de BUK no contiene rutas, encabezados ni formatos: `verificarConexion` responde «no configurado» y el resto lanza «no implementado: pendiente de la documentación oficial de /apidocs».
- **Alternativa descartada:** responder 200 en salud con BUK (podría «parecer» conectado).

## D-56 · Teléfono a E.164 con +57 por defecto en todas las fuentes

- **Fecha:** 2026-11-02 (F1)
- **Decisión:** la normalización del contrato canónico (§6) se aplica también a Apply Connect: un teléfono sin indicativo recibe +57 (en la v2 quedaba `+<número>`). Un teléfono que no se puede llevar a E.164 hace inválida la canónica.
- **Alternativa descartada:** descartar en silencio el teléfono inválido (se perdería un dato sin aviso).

## D-57 · 5 intentos por defecto (reemplaza los 10 de D-46)

- **Fecha:** 2026-11-02 (F2)
- **Decisión:** `MAX_INTENTOS_TRABAJO = 5` y `PUENTE_MAX_INTENTOS` por defecto 5, como dice la §7. Al agotarlos, la recepción queda `FALLIDA_DEFINITIVA` (estado V4 derivado de `FALLIDO_REINTENTABLE` + trabajo detenido, D-52) y se recupera con «Reintentar». El arranque en frío de Render sigue cubierto: cada llamada espera hasta 75 s cuando el otro sistema lleva más de 10 minutos sin responder (D-46), y la medición del 29/10 dio entre 65 y 92 s.
- **Alternativa descartada:** mantener 10 (contradice la especificación).

## D-58 · El CV se borra al completar cuando el ATS ya lo tiene; la retención aplica a lo que el Puente conserva

- **Fecha:** 2026-11-02 (F2)
- **Decisión:** como en la v2 (y lo afirma `tests/recorrido.test.ts`), al completar con el CV entregado al ATS el Puente borra su copia: es más estricto que la §7 (minimización de datos). La tarea de retención (`src/modules/retencion.ts`, ciclo «retencion» del worker, `RETENCION_CV_DIAS` = 30) borra el binario que el Puente sí conserva (p. ej., «CV no enviado: el ATS no lo admite por API») 30 días después de completar, deja el SHA-256 y los metadatos, y registra el evento y la auditoría. Descartar y «borrar datos del candidato» lo borran de inmediato.
- **Alternativa descartada:** conservar todos los CV 30 días (rompería una prueba existente y guarda más datos personales sin necesidad).

## D-59 · Tokens de fuente y límite de frecuencia

- **Fecha:** 2026-11-02 (F2)
- **Decisión:** token `pf_<prefijo de 10 hex>.<32 bytes base64url>`; se guarda el SHA-256 y el prefijo; se autentica buscando por prefijo y comparando el hash con `timingSafeEqual`. Rotar el token invalida el anterior; revocar desactiva la fuente. Límite de 60 peticiones por minuto por fuente **en memoria** (`src/entradas/generica/limite.ts`): con varias instancias cada una cuenta aparte (en Render gratuito hay una). `apply-connect` es una fuente del sistema sin token (usa la firma HMAC).
- **Alternativa descartada:** contador en PostgreSQL (más carga; innecesario con una instancia).

## D-60 · Correspondencias genéricas sin cambiar la clave existente

- **Fecha:** 2026-11-02 (F2)
- **Decisión:** `Correspondencia` suma `fuente` y `vacanteExterna` con `UNIQUE(fuente, vacanteExterna)`, y `externalJobId` sigue siendo único como referencia: la vacante tal cual para `apply-connect` (las pruebas existentes la buscan así) y `<fuente>:<vacante>` para las demás. `vacanteExterna` es opcional: en las filas antiguas de Apply Connect se usa `externalJobId`. La migración pasa las existentes a la fuente `apply-connect`.
- **Alternativa descartada:** reemplazar la clave única por la pareja (obligaba a cambiar pruebas existentes).

## D-61 · Revisión humana y posible duplicado

- **Fecha:** 2026-11-02 (F2)
- **Decisión:** una recepción sin correo, sin CV, con datos extraídos sin confirmar o con posible duplicado se guarda en `REQUIERE_REVISION` (con su motivo) y su trabajo queda **detenido**: el worker no la toma. Completar (correo o CV) no aprueba sola; aprobar exige correo y CV y devuelve el trabajo a la cola; descartar no envía nada y borra el CV. Posible duplicado = el mismo correo normalizado en el mismo **proceso del ATS** desde otra fuente (las vacantes de cada fuente tienen ids distintos; el proceso es lo que comparten). Se compara contra recepciones ya asociadas a ese proceso (las de Apply Connect lo reciben al procesarse). En Apply Connect, una entrega válida que cae en revisión responde 200 a Vínculo (no debe reintentarla).
- **Alternativa descartada:** fusionar automáticamente (la §2.5 lo prohíbe).

## D-62 · Librería para leer el texto de los PDF: unpdf 1.9.0

- **Fecha:** 2026-11-02 (F3)
- **Decisión:** `unpdf` **1.9.0** (MIT, sin dependencias; incluye pdf.js; JavaScript puro, funciona en Node y en Render sin binarios nativos), publicada el 2026-10-15. Se marca en `serverExternalPackages` de Next. Si el PDF no tiene texto (escaneado) o no se puede leer, el importador no lanza: la fila queda sin sugerencias y, sin correo, la recepción va a revisión.
- **Alternativas descartadas:** `pdf-parse` (sin mantenimiento, pdf.js antiguo), `pdfjs-dist` directo (más configuración del worker en servidor), `unpdf` 2.x (publicada hace menos de dos semanas).

## D-63 · El importador acepta CSV, no XLSX

- **Fecha:** 2026-11-02 (F3)
- **Decisión:** solo CSV (separador «,» o «;», comillas dobles, columnas `archivo, nombres, apellidos, correo, telefono` con alias `nombre`, `email`, `teléfono`). La exportación de Recruiter se guarda como CSV desde Excel.
- **Alternativa descartada:** XLSX. `xlsx` (SheetJS) en npm está desactualizado y con avisos de seguridad (la versión mantenida se distribuye fuera de npm) y `exceljs` agrega muchas dependencias para un caso opcional.

## D-64 · Importación en dos pasos con lote temporal

- **Fecha:** 2026-11-02 (F3)
- **Decisión:** la subida va a `POST /api/importador/lotes` (ruta con verificación de sesión, porque 20 PDF de 5 MB superan el límite de las acciones de servidor) y guarda un `LoteImportacion` con los PDF y lo sugerido. La persona revisa y confirma en `/importar/<lote>`; cada fila confirmada entra por `registrarRecepcion()` con `fuente = importador`, `idExterno = <proceso>:<sha256>`, `vacanteExterna = <proceso>`, el proceso elegido y `origenDatos = confirmado-por-persona`. Los bytes del lote se borran al confirmar; los lotes sin confirmar se borran a las 24 h (ciclo de retención). La fuente `importador` es del sistema (sin token: actúa la persona con sesión). En el ATS la fuente visible es «Importador manual del Puente».
- **Alternativa descartada:** mantener los archivos en el navegador y reenviarlos al confirmar (doble subida y sin trazabilidad del lote).

> Actualizado por Claude Code (2026-11-02, V4 F4-V: bot con perfil Vínculo, PROMPT_BOT_VINCULO.md).

## D-65 · El bot se organiza por perfiles de sitio

- **Fecha:** 2026-11-02 (F4-V)
- **Decisión:** `apps/bot-linkedin` separa lo común (navegación con un `Navegador` abstracto sobre el contexto persistente de Playwright, guardias, mapeo a la canónica, envío con reintentos, pausas con reloj inyectable) de lo propio de cada sitio (`PerfilSitio`: rutas, selectores, pausas y horario por defecto, detección de bloqueo y extracción de HTML a datos). `BOT_SITIO=vinculo|linkedin` elige el perfil. La extracción son funciones puras HTML → datos, probadas con páginas guardadas. El perfil `linkedin` es un esqueleto con selectores vacíos marcados «pendiente de la Puerta 0» y `cargarPerfil` se niega con «perfil LinkedIn pendiente de la Puerta 0» mientras no esté listo y no haya páginas anonimizadas.
- **Alternativa descartada:** un bot escrito directamente para LinkedIn (no se puede construir ni probar sin la Puerta 0 y sin páginas reales) o uno solo para Vínculo (habría que reescribirlo para LinkedIn).

## D-66 · Vínculo primero, con pausas cortas

- **Fecha:** 2026-11-02 (F4-V)
- **Decisión:** el primer perfil completo es Vínculo (red simulada del proyecto): permite probar el bot de punta a punta (E2E con las tres apps reales) sin tocar LinkedIn. Para eso Vínculo gana la ficha del postulante en el panel del reclutador (`/reclutador/postulaciones/<id>`, con atributos `data-campo` estables) y el enlace «Ver ficha». Pausas por defecto: Vínculo 800–1500 ms y horario libre (es local y nuestro); LinkedIn 3000–8000 ms y 07–19. El tope de 25 por ejecución es igual para ambos. Las páginas de prueba de Vínculo se capturaron del sitio en local con datos ficticios.
- **Alternativa descartada:** esperar la Puerta 0 para construir algo (no habría demo ni pruebas del adaptador).

## D-67 · node-html-parser 9.0.4 para extraer datos del HTML

- **Fecha:** 2026-11-02 (F4-V)
- **Decisión:** `node-html-parser` 9.0.4 (MIT, JavaScript puro, selectores CSS) para las funciones de extracción, que así se prueban sin navegador. Playwright (misma versión 1.64.1 del repositorio) solo navega y descarga con la sesión. `dotenv` 18.0.9 (ya usado en el repositorio) lee `apps/bot-linkedin/.env`.
- **Alternativa descartada:** extraer con `page.locator` (exige un navegador en cada prueba unitaria) o `cheerio` (más dependencias).

## D-68 · VINCULO_API_HABILITADA: Vínculo sin API por defecto

- **Fecha:** 2026-11-02 (F4-V, ajuste pedido por el equipo)
- **Decisión:** para la empresa, el LinkedIn real no tiene API; el simulador debe comportarse igual. Vínculo lee `VINCULO_API_HABILITADA` (por defecto **false**; `true` o `1` la prenden). Apagada: no aparecen «Desarrolladores», «API para integradores» ni «Integraciones»; `/developers` y `/reclutador/integraciones` responden 404 (también sus acciones; `src/proxy.ts` asegura el estado HTTP 404, porque con `loading.tsx` la página sale en streaming con 200); OAuth (`/oauth/v2/accessToken`), `/api/v1/*` y `/api/openapi.json` responden 404; no se crean entregas de webhook al postular, el despachador no envía nada y la vacante no ofrece «Entregar a un ATS conectado». Prendida: todo como antes. El código de la API y sus pruebas se conservan: Vitest de Vínculo y Playwright la prenden explícitamente, y `tests/api-apagada.test.ts` verifica el caso apagado. El adaptador Apply Connect del Puente no cambia (es la vía oficial futura). `npm run demo:bot` la deja apagada (además conecta solo Talentia en el Puente) y `npm run vinculo:api -- on|off|estado` la cambia en `apps/vinculo/.env` (hay que reiniciar las apps).
- **Consecuencia:** con la API apagada, `npm run demo:conectar` falla en el paso de Vínculo (404): primero `npm run vinculo:api -- on` y reiniciar. `render.yaml` la declara en `false` (D-71).
- **Alternativa descartada:** borrar la API de Vínculo (se pierde la demostración de la vía oficial y sus pruebas de contrato).

## D-69 · Scripts de base de datos con --if-present

- **Fecha:** 2026-11-02 (F4-V)
- **Decisión:** el bot es un cuarto workspace sin base de datos; `db:migrate`, `db:seed` y `demo:reset` de la raíz usan `--if-present` para no fallar en él. `test`, `typecheck` y `build` sí lo incluyen (el `build` del bot es `tsc --noEmit`).
- **Alternativa descartada:** dejar el bot fuera de los workspaces (no compartiría las versiones exactas ni entraría en la puerta de calidad).

## D-70 · El bot espera la página final y se detiene ante una página del panel incompleta

- **Fecha:** 2026-11-02 (F4-V)
- **Decisión:** Vínculo envía sus páginas en streaming y, con la sesión vencida (por ejemplo, después de `demo:reset`, que vuelve a crear las cuentas), redirige al ingreso desde el cliente. El navegador del bot espera, además de `load`, a que la red quede quieta (máximo 15 s) antes de leer la página. Y el perfil de Vínculo trata como bloqueo `pagina_inesperada` cualquier página bajo `/reclutador` sin el menú del panel: el bot se detiene con «Se requiere intervención humana» en lugar de informar «0 vacantes». Se encontró en el ensayo de la demo en local.
- **Alternativa descartada:** esperas fijas (lentas y frágiles) o aceptar el panel vacío (oculta una sesión vencida).

> Actualizado por Claude Code (2026-11-03, auditoría F4-V).

## D-71 · render.yaml declara VINCULO_API_HABILITADA=false

- **Fecha:** 2026-11-03 (auditoría F4-V)
- **Decisión:** `render.yaml` declara `VINCULO_API_HABILITADA="false"` en el servicio de Vínculo, para que lo desplegado sea igual que en local (sin API, como el LinkedIn real para la empresa). No se desplegó. Ojo: al redesplegar, `demo:conectar` contra Render deja de funcionar hasta poner `"true"` en ese servicio.
- **Alternativa descartada:** no declararla. Daba el mismo resultado (por defecto es false), pero de forma implícita.

## D-72 · Opciones de los comandos que sobreviven a PowerShell

- **Fecha:** 2026-11-03 (auditoría F4-V)
- **Decisión:** en PowerShell, el envoltorio `npm.ps1` quita el `--` y npm se queda con las opciones `--seco`, `--vacante`, `--reiniciar`, `--proceso` y `--publicar` (las exporta como `npm_config_<nombre>`). Se comprobó que `npm run bot -w apps/bot-linkedin -- --seco` **enviaba**. El bot (`src/argumentos.ts`) y los scripts de la raíz (`scripts/argumentos.mjs`) leen las dos formas. `--vacante` sin código se rechaza.
- **Alternativa descartada:** documentar `npm.cmd` o variables de entorno en lugar de los comandos (fácil de olvidar en vivo; un `--seco` ignorado envía datos).

## D-73 · Segunda instancia de Vínculo sin API en las E2E

- **Fecha:** 2026-11-03 (auditoría F4-V)
- **Decisión:** `e2e/vinculo-sin-api.spec.ts` arranca, con el supervisor, una segunda instancia del mismo build de Vínculo en el puerto 3214, con `VINCULO_API_HABILITADA=false` y sobre la misma base E2E. Así se prueba la interfaz sin API (menú, pie, 404, Integraciones, vacante antes conectada y Solicitud sencilla), y la instancia de 3211 sigue con la API para el resto de las pruebas.
- **Alternativa descartada:** apagar la API en la instancia principal a mitad de la suite (habría que reiniciarla y las pruebas quedarían dependientes del orden).

## D-74 · Nombres visibles «Simulador LinkedIn» y «Simulador BUK»

> Actualizado por Claude Code (2026-11-03). Decisión del equipo del 03/11/2026 (paso 0 de PROMPT_BOT_VINCULO.md). Reemplaza la regla de nombres de CLAUDE.md («sin … nombres … de LinkedIn, BUK») y, en lo visible, el texto de fuente de D-19.

- **Fecha:** 2026-11-03 (F4-V)
- **Decisión:** en la interfaz, Vínculo se llama **«Simulador LinkedIn»** y Talentia **«Simulador BUK»**: título de pestaña, menú, encabezados, pantallas de ingreso, textos, mensajes de error, mensajes de los scripts y del bot, y la documentación OpenAPI. Siempre con la palabra «Simulador». La franja dice «Entorno de simulación · No es LinkedIn ni BUK: simulación académica. Datos ficticios.» en las tres apps. En el Puente, las fuentes se rotulan con `etiquetaFuente()` (`apps/puente/src/nucleo/fuentes.ts`): `vinculo-bot` → «LinkedIn (bot, simulador)», `importador` → «Importador manual», `apply-connect` → «Simulador LinkedIn (Apply Connect)»; esa misma etiqueta llega como fuente a la postulación del ATS. El ATS activo se informa como «ATS Simulador BUK activo».
- **Lo que NO cambia:** carpetas (`apps/vinculo`, `apps/talentia`), paquetes, esquemas, URL, variables (`VINCULO_API_HABILITADA`, `ATS_DESTINO=talentia`…), identificadores de fuente (`vinculo-bot`, `apply-connect`, `importador`), cookies y código interno. Sin logos, colores ni tipografías de LinkedIn o BUK (se mantienen la paleta y la marca propias). Lo desplegado en Render no se tocó.
- **Motivo:** la demostración se entiende mejor y queda más cerca de lo real (el reclutador reconoce los sistemas que usa), y el rótulo «Simulador» más la franja impiden presentarlo como conexión real. Sigue prohibido afirmar conexión, certificación o compatibilidad con LinkedIn o BUK.
- **Pruebas:** `e2e/nombres-visibles.spec.ts` recorre las pantallas principales de las tres apps y falla si aparece «Vínculo» o «Talentia» en el texto, el título de la pestaña o un atributo visible, o si falta la franja. `apps/puente/tests/nombres-visibles.test.ts` fija las etiquetas de las fuentes y `e2e/bot.spec.ts` (BV-4) verifica «LinkedIn (bot, simulador)» en Operaciones.
- **Alternativa descartada:** mantener «Vínculo» y «Talentia» (decisión anterior, D-19 y CLAUDE.md): obligaba a explicar en la demo qué sistema real representa cada uno.

# Estado del proyecto

> Mantenido por Claude Code en modo autónomo. Cada fase agrega su sección; para retomar, usar el prompt RETOMAR.

## Fase P1: Investigación de contratos y recorrido vertical (2026-10-25)

### Plan (en modo autónomo no se esperó aprobación; queda registrado aquí)

1. Verificar los contratos de LinkedIn y BUK → `docs/contratos.md`.
2. Registrar la diferencia con la ficha y las decisiones → `docs/decisiones.md`.
3. Base técnica: Next.js 16 (App Router) + React 19 + TS 5.9 + Zod 4 + Prisma 7/PostgreSQL (esquemas `origen`, `puente`, `ats`) + Vitest 5 + Playwright. PostgreSQL local del proyecto (no hay Docker).
4. Recorrido vertical: origen (catálogo, detalle, formulario y outbox) → despachador firmado → webhook del puente (firma, Zod, recepción y trabajo) → worker (CV, candidato, documento, postulación) → ATS simulado (API con Idempotency-Key y tablero).
5. Pruebas: firma, challenge, validación del payload, recorrido en proceso con hash y E2E en navegador.

Estructura:

```
prisma/            schema.prisma (3 esquemas), migraciones, seed y datos-demo
src/app/           origen/, ats/, puente/ (UI) · api/origen, api/puente, api/ats/v1 (HTTP)
src/modules/       origen/ (postulación, despachador) · puente/ (webhook, procesador, cliente ATS) · ats/ (servicio, fallos)
src/lib/           config (Zod), db, firma, archivos, privacidad, fechas
worker/            proceso del worker
scripts/           setup-env, pg-local, demo-reset, generar-cv
tests/             Vitest (PostgreSQL real, route handlers reales en proceso)
e2e/               Playwright (app :3200 y worker arrancados por la prueba)
fixtures/cv/       3 CV ficticios generados y 1 archivo que no es PDF
```

### Qué se hizo

- **Contratos verificados** el 2026-10-25 contra 7 fuentes, con URL, fecha y versión (`docs/contratos.md`). Se confirmó la discrepancia de firma entre F1 y F2 y se eligió F2 (D-04). Hallazgo: la integración nativa BUK↔LinkedIn publica la vacante por XML y redirige al formulario de BUK (alternativa sin desarrollo, para P6).
- **Decisiones** D-01 a D-12 en `docs/decisiones.md`. D-01 (simular ambos extremos) tiene la aceptación de la empresa y del mentor **PENDIENTE**.
- **Origen:** catálogo, detalle y formulario sin cuenta (nombre, apellido, correo, teléfono opcional, ciudad, CV PDF), con validación en servidor (Zod y firma `%PDF-`) y mensajes en español. Postulación, archivo y outbox se guardan en **una transacción**. El CV tiene URL privada (`/api/origen/media/{id}`) con Bearer y expiración de 30 días.
- **Despachador:** outbox con `FOR UPDATE SKIP LOCKED`, firma `X-LI-Signature`, reintentos con backoff y jitter (máx. 6) y registro de cada intento.
- **Puente:** `GET` challenge; `POST` con firma sobre el cuerpo crudo, Zod, códigos de error de LinkedIn, deduplicación y `Recepcion` + `Trabajo` en la misma escritura, con respuesta 200 inmediata. El worker procesa por pasos confirmados: descarga solo desde `ORIGEN_BASE_URL/api/origen/media/`, sin seguir redirecciones, con límite de tamaño y validación de PDF; calcula el SHA-256, resuelve la correspondencia y llama al ATS con Idempotency-Key.
- **ATS simulado:** API documentada como contrato del simulador; valida el SHA-256 recibido. Interfaz: lista de procesos, tablero por columnas, tarjeta en «Postulantes» con «Sin calificar», fuente y fecha, aviso «1 postulante nuevo fue agregado al proceso», detalle del candidato y descarga del CV con su SHA-256.
- **Seeds ficticios:** procesos 9001 y 9002, vacantes RT-2026-101 → 9001 y RT-2026-102 → 9002, y RT-2026-103 publicada pero **sin vincular** (para mostrar `JOB_POSTING_CLOSED`). 3 CV PDF generados con pdf-lib.

### Comandos ejecutados y resultado real (2026-10-25)

| Comando | Resultado |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0, sin advertencias |
| `npm test` | exit 0: **4 archivos, 20 pruebas pasadas** (firma ×6, webhook ×11, recorrido ×2, zona horaria ×1) |
| `npm run test:e2e -- --project=escritorio` | exit 0: build correcto y **2 pruebas E2E pasadas** (recorrido principal con hash; rechazo de formulario inválido) |

Problemas encontrados y corregidos en la fase:

- Fechas desplazadas 5 h: el adaptador pg con la zona de la sesión. Se corrigió con `timestamptz` y sesión UTC; prueba de regresión agregada (D-10).
- `pg_ctl start` dejaba colgado el script en Windows; se corrigió lanzándolo desacoplado.
- `npm install vitest@4.1.12` fallaba con un error interno de npm; se usó la 5.0.5 (D-03).

### Lo que no se pudo ejecutar o verificar

- **Docker:** no está instalado. Se usa el PostgreSQL local del proyecto (D-05); `docker-compose.yml` no se probó.
- **`prisma migrate reset`:** Prisma lo bloquea cuando lo ejecuta un agente de IA sin consentimiento explícito. No se forzó; se crearon bases nuevas (`tb_*`). Las antiguas `talentbridge*` siguen en el clúster local y se pueden borrar a mano.

### Pendientes y riesgos

- **PENDIENTE (equipo):** `CLAUDE.md` y `docs/referencia-ats.md` no estaban en la carpeta. Se creó un `CLAUDE.md` nuevo y las etapas son un supuesto (`docs/referencia-ats-supuesta.md`, D-11).
- **PENDIENTE (empresa y mentor):** aceptación de simular ambos extremos (D-01).
- **Riesgo:** la firma sigue F2; si LinkedIn aclara F1 de otra forma, el cambio está aislado en `src/lib/firma.ts`.

## Fase P2: Fiabilidad y panel del puente (2026-10-25)

### Verificación previa

Antes de avanzar se ejecutaron las pruebas de P1: `npm test` dio 20/20 y el E2E 2/2.

### Qué se hizo

| # | Requisito | Implementación | Prueba (Vitest, PostgreSQL real) |
|---|---|---|---|
| 1 | Mismo `jobApplicationId` reenviado | 200 `DUPLICADO`, sin escrituras; `duplicadosEvitados` +1 | `P2.1` |
| 2 | Entregas simultáneas | Restricción única en `Recepcion.jobApplicationId` y `Trabajo.recepcionId`; reserva con `FOR UPDATE SKIP LOCKED` + lease | `P2.2` (5 POST concurrentes; 3 workers reclamando a la vez) |
| 3 | Misma persona, dos vacantes | El ATS busca candidato por correo → 1 candidato, 2 postulaciones | `P2.3` |
| 4 | Vacante sin correspondencia o cerrada | `JOB_POSTING_CLOSED` en la entrada (o `RECHAZADO` si se desvincula después); nunca se adivina | `P2.4` ×2 |
| 5 | Datos incompletos, PDF inválido o grande, firma inválida | Código documentado y cero escrituras en el ATS | `P2.5` ×4 y `webhook.test.ts` |
| 6 | ATS 5xx o timeout | Backoff con jitter, progreso por paso conservado; Idempotency-Key evita duplicados tras un timeout | `P2.6` ×3 |
| 7 | Reinicio del worker a mitad | Lease vencido → otro worker retoma desde el último paso; candidato no duplicado | `P2.7` ×2 |
| 8 | Respuesta perdida tras escribir | Consulta por referencia externa antes de reescribir; si no se puede saber → `REQUIERE_VERIFICACION` y reconciliación desde el panel | `P2.8` ×3 |

- **Controles de fallos del simulador** (`ats.FalloSimulado`): NO_DISPONIBLE, PERDER_RESPUESTA, LENTO y CREDENCIALES por operación. Solo se activan con `SIMULADOR_MODO_PRUEBA=true` en host local (D-12). La pantalla `/puente/pruebas` no existe fuera de ese modo (404).
- **Panel del puente** (`/puente`): lista de operaciones con estado, fecha, vacante → proceso, referencia corta y postulante con nombre, inicial del apellido y correo enmascarado; filtros por estado; actualización automática. Detalle con pasos, línea de tiempo de eventos e intentos, errores en español («qué pasó / qué hacer»), botón **Reintentar** solo en FALLIDO_REINTENTABLE detenido y **Reconciliar con el ATS** solo en REQUIERE_VERIFICACION.
- **Correspondencias** (`/puente/correspondencias`): vincular, desvincular y activar. El proceso se valida contra el ATS por HTTP.
- **Rechazos en la entrada** (`/puente/rechazos`).
- **Métricas medidas**: recibidas, completadas, rechazadas (entrada y procesamiento), duplicados evitados, requieren atención y tiempo de recepción a completado (mediana y p95 con `percentile_cont`, con n).
- **Autenticación de demo** (D-13): `/ingresar`, cookie firmada, `proxy.ts` y verificación en el servidor. Si falta configuración o el host no es local, falla de forma segura.

### Comandos ejecutados y resultado real (2026-10-25)

| Comando | Resultado |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0, sin advertencias |
| `npm test` | exit 0: **6 archivos, 46 pruebas pasadas** (firma 6, webhook 11, recorrido 2, zona horaria 1, fiabilidad 20, sesión 6) |
| `npm run test:e2e -- --project=escritorio` | exit 0: build correcto y **7 pruebas E2E pasadas** (recorrido 2 y panel 5: acceso sin sesión, operación completada con métricas, vacante desvinculada, ATS caído con reintento, respuesta perdida → verificación → reconciliación) |

Problemas encontrados y corregidos:

- El fetch en proceso de las pruebas ignoraba el `AbortSignal`, así que el timeout no se podía probar. Se corrigió para que se comporte como un fetch real.
- Las pruebas E2E buscaban la operación por apellido, pero el panel lo oculta a propósito. Ahora se busca por `jobApplicationId`.

### Pendientes y riesgos

- El caso «ATS lento» (LENTO) tarda 12 s por defecto. En la demo conviene NO_DISPONIBLE, que es inmediato.
- La reconciliación depende de la consulta por referencia externa, que es **capacidad del simulador**. En un ATS real habría que confirmar que existe un equivalente (ver docs/contratos.md §3).

## Fase P3: Pulido y demostración del 29/10 (2026-10-25)

### Auditoría de los criterios del 29/10 (con pruebas, no con resúmenes)

Cada criterio tiene una prueba de Playwright en `e2e/criterios-29oct.spec.ts`, ejecutada contra la app compilada y el worker reales. Resultado: **8/8 cumplen** (ejecutado 3 veces: dos en este repositorio y una en la instalación limpia).

| # | Criterio | Resultado | Cómo se verifica |
|---|---|---|---|
| 1 | Preparar una vacante en origen y destino y vincularlas | **Cumple** | Publica la vacante en `/origen/admin`, crea el proceso en `/ats/procesos/nuevo` y la vincula en `/puente/correspondencias` (validada contra el ATS por HTTP) |
| 2 | Postular una persona ficticia con un PDF | **Cumple** | Formulario del portal con `fixtures/cv/*.pdf` |
| 3 | Ver la transferencia sin copiar nada | **Cumple** | La confirmación cambia sola a «Entregada»; el panel muestra Completado y los 4 pasos (se actualiza solo) |
| 4 | Ver la postulación en «Postulantes» del proceso correcto | **Cumple** | Tarjeta en la primera columna del proceso nuevo, «Sin calificar», fuente, aviso «1 postulante nuevo…»; ausente en 9001 y 9002 |
| 5 | Descargar el CV y comprobar el hash | **Cumple** | SHA-256 del archivo descargado = SHA-256 del original |
| 6 | Reenviar el evento sin duplicar | **Cumple** | «Reenviar evento» → `HTTP 200 · DUPLICADO`; una sola tarjeta; evento en la línea de tiempo |
| 7 | Rechazo controlado de entradas inválidas | **Cumple** | Formulario (no PDF) y 6 casos de la consola: 401 SIGNATURE_MISMATCH, 400 MISSING_REQUIRED_RESPONSE, 400 INPUT_VALIDATION_FAILED ×3, 422 JOB_POSTING_CLOSED |
| 8 | Reiniciar app y worker sin perder datos ni operaciones pendientes | **Cumple** | a) worker caído → postulación pendiente en la outbox; b) se mata la app → al volver sigue pendiente; c) vuelve el worker → entrega y tarjeta; d) se matan app y worker **a mitad de una llamada al ATS** (ya escribió el documento) → al volver termina con un solo documento (Idempotency-Key) |

Verificación a mano: prueba de humo con `npm run dev` + `npm run worker` en el puerto 3100 y un navegador real (entrega, tarjeta en Postulantes de 9002 y hash idéntico). El guion completo (`docs/guion-demo.md`) **no** lo ensayó una persona: queda PENDIENTE para el equipo.

### Pulido

- **Escritorio y móvil:** proyecto `movil` (Pixel 7) sin desbordes horizontales; el tablero del ATS se desplaza dentro de su propio contenedor.
- **Teclado:** enlace «Saltar al contenido», orden de tabulación del formulario y foco al primer campo con error (con pruebas).
- **Accesibilidad:** axe WCAG 2.1 AA en 21 pantallas sin violaciones serias ni críticas. Se corrigió el contraste del botón del panel (3,76 → 5,5) y de los encabezados de tabla (4,34 → más de 7).
- **Estados:** `loading.tsx` en los tres módulos, `error.tsx` global, `not-found.tsx` y estados vacíos en todas las listas.
- **Aviso «Entorno de simulación»** en el layout raíz, presente en todas las pantallas.
- **Identidad visual:** origen «Vitrina Empleo» (claro, verde azulado, redondeado); ATS «Selecta» (barra lateral índigo, denso); panel del puente (pizarra con acento verde).
- **demo:reset:** borra y re-siembra solo `demo = true`; se niega con `NODE_ENV=production` o base no local (con pruebas).
- `setup-env` elige un puerto libre de PostgreSQL desde 5433.
- `next.config.ts`: `agentRules: false` para que `next dev` no genere `AGENTS.md` en el repositorio.

### Documentos

`README.md`, `docs/arquitectura.md` (diagramas Mermaid), `docs/mapeo-datos.md`, `docs/guion-demo.md`, `docs/uso-ia.md`, `docs/resultados-pruebas.md`.

### Instalación limpia (siguiendo solo el README)

Se copiaron los archivos versionables (sin `.env`, `node_modules`, `.pgdata` ni la ficha) a una carpeta nueva del directorio temporal y se ejecutó: `npm install` (exit 0), `npm run setup` (exit 0; eligió el puerto 5434 porque el 5433 estaba ocupado, creó las 3 bases, migró y sembró), `npx playwright install chromium`, `npm run typecheck` (0), `npm run lint` (0), `npm test` (**50/50**) y `npm run test:e2e` (**20/20**). Luego `npm run pg:stop`.

### Comandos ejecutados y resultado real

Ver `docs/resultados-pruebas.md`: typecheck 0 · lint 0 · Vitest **50/50** · Playwright **20/20** (dos corridas) · instalación limpia en verde.

### Pendientes y riesgos

- **PENDIENTE (equipo):** ensayar el guion a mano en el equipo de la demo y revisar la lista de `docs/uso-ia.md`.
- **Riesgo:** las pruebas solo corren en Chromium.

## Fase P5: Completar casos y edición de vacantes (2026-10-25)

> P4 (retroalimentación del 29/10) y P6 (entrega del 13/11) **no se ejecutaron**, por instrucción: dependen de la retroalimentación y del cierre.

### Qué se hizo

| Requisito | Implementación | Pruebas |
|---|---|---|
| Editar y cerrar vacantes en el origen; al cerrar, las nuevas postulaciones reciben `JOB_POSTING_CLOSED` | `/origen/admin`: editar, cerrar y reabrir. El cierre viaja como evento firmado por la outbox (D-17). El portal deja de mostrarla y de aceptarla; el puente responde `JOB_POSTING_CLOSED` a las posteriores al cierre y respeta las anteriores; los eventos en desorden se ignoran; una desvinculación manual no se reactiva | `tests/p5.test.ts` P5.1 (6 pruebas) · `e2e/p5.spec.ts` (editar, cerrar, «Cerrada en el origen», reabrir) |
| Transferencia del CV interrumpida | Modo `media → INTERRUMPIR`. Detección por bytes ≠ Content-Length o error de lectura → `CV_TRANSFERENCIA_INCOMPLETA`, sin avanzar de paso; reintento automático | P5.2 · E2E «transferencia interrumpida» |
| Error de autenticación entre puente y ATS | 401 del ATS → `ATS_AUTENTICACION`: **un solo intento**, FALLIDO_REINTENTABLE detenido, explicación «Revisa ATS_API_KEY» y botón «Reintentar» | P5.3 · E2E «error de autenticación» |
| Candidato creado pero postulación pendiente (reanudar) | El trabajo retoma en `documento_subido`: no repite candidato ni documento (caída del proceso y fallo del ATS) | P5.4 (2 pruebas) |
| Pruebas de contrato independientes | `tests/contratos/contrato-origen.test.ts`: el origen frente a F1/F2 con un validador escrito a mano y el ejemplo oficial, sin el esquema del puente. `tests/contratos/contrato-puente-y-ats.test.ts`: el puente frente al ejemplo oficial y la tabla de errores de F1, y el challenge de F2; el ATS con HTTP crudo frente a docs/contratos.md §3 | 7 + 9 pruebas |

Migración `cierre_vacantes`: solo agrega columnas (sin pérdida de datos).

### Comandos ejecutados y resultado real (2026-10-25)

| Comando | Resultado |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0, 0 advertencias |
| `npm test` | exit 0: **10 archivos, 76 pruebas pasadas** |
| `npm run test:e2e` (escritorio + móvil) | exit 0: **23 pasadas** (2,4 min); segunda corrida: **23 pasadas** |
| Instalación limpia 2 (copia nueva, migraciones desde cero) | install 0 · setup 0 · typecheck 0 · lint 0 · **76/76** · **23/23** |

Problemas encontrados y corregidos: la limpieza demo de eventos de estado borraba de más (corregida antes de probar); el corte simulado del CV ocurría antes de los encabezados sobre HTTP real (ahora corta después de enviar la mitad); faltaba la ruta nueva en el fetch en proceso de las pruebas.

### Pendientes y riesgos

- **PENDIENTE (empresa y mentor):** aceptación de D-01.
- **PENDIENTE (equipo):** `docs/referencia-ats.md` real (D-11), revisión de `docs/uso-ia.md` y ensayo del guion.
- **PENDIENTE (P4 y P6):** dependen de la retroalimentación del 29/10 y del cierre del 13/11.
- **Riesgo:** el evento de estado de vacante es del simulador; en un caso real el cierre vendría del ATS (habría que confirmarlo con la empresa).

## Ajuste: etapas según la referencia del ATS real (2026-10-25)

- **Etapas** de todos los procesos (sembrados y nuevos): Postulantes · Por contactar · Referidos · Sagrilaft · Prueba técnica · Entrevista técnica · Valoración psicológica · Suspendido · Contratados. Fuente única: `src/modules/ats/etapas.ts`. «Contratados» viene del centro de ayuda de BUK, no de la foto.
- **Tipo de etapa** visible en cada columna (Filtro / Validaciones / Entrevistas; «Etapa final» en Contratados). La asignación por etapa es un **Supuesto pendiente** (D-11 actualizada).
- **«Descartados (n)»** plegable en cada columna, con «Descartar» y «Restaurar». La tarjeta no cambia de etapa. Migración `etapas_tipo_descartados`: solo agrega columnas.
- `CLAUDE.md`: se agregaron las reglas de anonimización, identidad visual propia y etiquetas de certeza.

Comandos y resultado real: `npm run typecheck` 0 · `npm run lint` 0 (0 advertencias) · `npm test` **78/78** (11 archivos) · `npm run test:e2e` **24/24** · `npm run build` 0.

**PENDIENTE (equipo):**
- `docs/referencia-ats.md` y `CLAUDE_equipo.md` no estaban en la carpeta al hacer este ajuste. Agregarlos para:
  - confirmar el tipo de cada etapa;
  - completar la fusión de CLAUDE.md y borrar `CLAUDE_equipo.md` después.

## Cierre del ajuste de etapas (2026-10-25)

- **CLAUDE.md** fusionado con `CLAUDE_equipo.md`: contexto y reglas del equipo, comandos reales y arquitectura implementada con sus diferencias respecto del plan. `CLAUDE_equipo.md` se borró.
- **Tipos de etapa** según la tabla de `docs/referencia-ats.md` (observación directa, 15/10/2026): Postulantes = Entrada · Por contactar = Filtro · Referidos = Validaciones · Sagrilaft = Validaciones · Prueba técnica = Filtro · Entrevista técnica = Entrevistas · Valoración psicológica = Entrevistas · Suspendido = Filtro · Contratados = Etapa final (centro de ayuda de BUK).
- `docs/referencia-ats-supuesta.md` quedó marcado como reemplazado por `docs/referencia-ats.md`.
- Comandos y resultado real: `npm run demo:reset` 0 · `npm run typecheck` 0 · `npm run lint` 0 · `npm test` **78/78** · `npm run test:e2e` **24/24** · `npm run build` 0.
- **PENDIENTE (equipo), D-19:** texto de la fuente («Portal simulado (tipo LinkedIn)» según `referencia-ats.md`, frente a «LinkedIn Easy Apply (simulado)» actual) y campos del proceso observados (prioridad, vigencia, estado «Iniciado»).

## D-19 resuelta (2026-10-25)

- **Fuente visible:** «Portal simulado (tipo LinkedIn)». Ningún texto visible dice «LinkedIn Easy Apply» (prueba E2E que recorre las pantallas principales). El contrato técnico interno conserva los nombres de LinkedIn.
- **Proceso:** prioridad (Alta/Media/Baja), fecha de inicio, vigencia en días y estado «Iniciado» en el encabezado y en la lista. Migración `proceso_prioridad_inicio` (convierte `ABIERTO` → `INICIADO`). Seed: 9001 Alta, hace 10 días; 9002 Media, hace 3 días.
- **Tarjeta:** casilla de selección solo visual; sin ícono de IA; «Sin calificar».
- Comandos y resultado real: `npm run demo:reset` 0 · `npm run typecheck` 0 · `npm run lint` 0 · `npm test` **82/82** (12 archivos) · `npm run test:e2e` **26/26** · `npm run build` 0.
- El pendiente D-19 de la sección anterior queda **cerrado**.

---

# Versión 2 (rama v2)

> Actualizado por Claude Code. Plan: fases F0–F7 de PROMPT_V2.md sobre docs/v2/SOLUCION.md y docs/v2/ESPECIFICACION.md.

## F0 · Monorepo (2026-10-28)

### Qué se hizo

- npm workspaces: `apps/vinculo` (puerto 3001), `apps/talentia` (3002), `apps/puente` (3003). Cada app con su `package.json`, esquema Prisma, migración inicial, cliente generado propio, `.env`, seed, `demo:reset` y pruebas. Ninguna importa código de otra (D-20).
- PostgreSQL local del proyecto en el 5435 (`.pgdata` de esta carpeta), bases `tb2_dev`, `tb2_test`, `tb2_e2e`; un esquema por sistema (D-21). El clúster de la v1 en el 5433 no se tocó.
- `npm run setup` genera `.env` (raíz y por app, con secretos aleatorios), crea el clúster, migra y siembra las tres apps. `npm run dev` arranca PostgreSQL y las tres apps con sus workers dentro del proceso (D-24).
- Fallos inyectables movidos a los conectores del puente (D-23). Talentia y Vínculo ya no tienen código de fallos.
- Pruebas de la v1 adaptadas: por app con PostgreSQL real; el puente con dobles de contrato (D-22). E2E de la v1 adaptadas a tres sistemas como procesos reales (supervisor en `e2e/`).

### Comandos ejecutados y resultado real (2026-10-28)

| Comando | Resultado |
|---|---|
| `npm install` | exit 0 (645 paquetes) |
| `npm run setup` | exit 0: `.env` de la raíz y de cada app, clúster en 5435, 3 migraciones y 3 seeds |
| `npm run lint` | exit 0, 0 advertencias |
| `npm run typecheck` | exit 0 (3 apps) |
| `npm test` | exit 0: Vínculo **20/20** (5 archivos), Talentia **20/20** (5), Puente **57/57** (8) |
| `npm run build` | exit 0 (3 apps) |
| `npx playwright test --project=escritorio` | **25/25** (2,8 min), incluidos los 8 criterios del 29/10 y el reinicio a mitad de llamada |
| `npx playwright test --project=movil` | **1/1** |

### Pendientes y riesgos

- Transitorio (D-25): contratos y secretos de la v1 hasta F1–F3.
- `docker-compose.yml` actualizado al 5435 pero sin probar (no hay Docker en la máquina).

## F1 · Talentia completo (2026-10-28)

### Qué se hizo

- **Autenticación con roles** (Better Auth, D-27): administradora `admin@andina.demo.test` y reclutador `reclutador@andina.demo.test`, contraseña `Demo2026!`, visibles en `/ingresar`. Cookie `tal_sesion`. El menú de Administración y sus páginas solo existen para el rol ADMIN (verificado en el servidor).
- **Pantallas:** menú Desarrollo organizacional → Selección → Procesos, Postulantes, Plantillas («Próximamente»), Configuraciones; lista de procesos; nuevo proceso; tablero del proceso con encabezado, pestañas (Información general y Proceso activas, el resto deshabilitadas), **Vista columna** con las 9 etapas, tipo, contador y «Descartados (n)», **Vista tabla**, mover tarjetas con un selector, aviso de nuevos; base de postulantes con búsqueda y paginación; ficha con datos, procesos, CV con SHA-256 e **historial** de movimientos; `/admin/api-keys`; `/admin/actividad-api`; `/apidocs` (Swagger UI local).
- **API v1** (D-29) con permisos, límite, errores uniformes, Idempotency-Key y OpenAPI 3.1 generado desde Zod.
- **Encabezado:** `auth_token`, Supuesto pendiente (D-26).
- **Datos de demo:** 6 procesos (9001–9006) y 15 postulantes repartidos en etapas.
- **Puente:** conector actualizado a la nueva API (D-30).

### Comandos ejecutados y resultado real (2026-10-28)

| Comando | Resultado |
|---|---|
| `npm run lint` | exit 0, 0 advertencias |
| `npm run typecheck` | exit 0 |
| `npm test` | exit 0: Vínculo **20/20**, Talentia **30/30** (6 archivos: api, contrato-openapi, procesos, etapas, demo, sesión), Puente **57/57** |
| `npm run build` | exit 0 (3 apps) |
| `npx playwright test` (escritorio + móvil) | **30/30** (2,3 min) |

Problemas encontrados y corregidos: las etiquetas ocultas de los selectores del tablero (posición absoluta) ensanchaban la página; `/apidocs.js` quedaba detrás del control de sesión; el reclutador sin permiso volvía a `/` y perdía el aviso; la utilidad E2E navegaba a `/ingresar` con sesión vigente.

### Criterios

- **2 · Cumple.** `apps/talentia/tests/api.test.ts` (llave una vez con hash; 201 con Modificación; 403 con solo Lectura; 401 revocada) y `e2e/talentia.spec.ts` (lo mismo desde la interfaz y con HTTP real).
- **3 · Cumple para Talentia.** `apps/talentia/tests/contrato-openapi.test.ts` (ejemplos válidos contra su esquema, ejemplos ejecutados contra la API y respuestas validadas con Ajv contra el documento) y `e2e/talentia.spec.ts` (`/apidocs` carga sin sesión). `/developers/docs` de Vínculo queda para F2.

### Pendientes y riesgos

- **PENDIENTE (empresa):** confirmar el nombre del encabezado de la API Key de BUK (D-26).
- Transitorio (D-25/D-30): la llave del puente llega por `.env` hasta F3.

## F2 · Vínculo completo (2026-10-28)

### Qué se hizo

- **Autenticación por rol** con Better Auth (D-27): registro público de candidatos (crea su perfil `/in/[slug]`), reclutadores de una empresa, cookie `vin_sesion`; cuentas de demostración visibles en `/ingresar` (D-39).
- **Pantallas:** portada con buscador y vacantes recientes; `/empleos` (texto, ciudad, modalidad, nivel, empresa, paginado); detalle con «Solicitud sencilla» o «Postularse en el sitio de la empresa»; Solicitud sencilla en dos pasos (contacto y CV del perfil o nuevo, PDF ≤ 5 MB); confirmación; `/mis-postulaciones` con estados; `/in/[slug]`; `/mi-perfil` (datos, CV, experiencia, educación); `/empresas/[slug]`; panel del reclutador (vacantes, postulantes, **descarga manual del CV**, crear/editar/publicar/cerrar); `/reclutador/integraciones` (Conectar ATS por Client ID, estado del webhook, revocar, últimos envíos sin datos personales completos); `/developers` (aplicaciones, Client Secret una vez, regenerar, revocar, webhook con desafío, entregas con «Reenviar», consola de pruebas); `/developers/docs` (Swagger UI con ajustes de contraste).
- **API** (D-32, D-33): token, jobPostings, close, autorizaciones, media, lifecycle, salud y OpenAPI.
- **Entrega firmada** por outbox con el secreto de cada aplicación, 6 intentos en unos 15 minutos (D-36). SSRF (D-37). Secreto cifrado (D-31).
- **Datos de demo** (D-39): 6 empresas, 18 vacantes (6 de Andina con Solicitud sencilla sin ATS y 12 solicitudes), 40 candidatos con perfil y CV PDF.
- **Puente:** conector de Vínculo con token por client credentials cacheado y nueva ruta del CV.
- **Transitorio (D-25):** si el `.env` trae las credenciales del puente, la siembra registra su aplicación, Andina la autoriza y publica RT-2026-101/102/103 hacia su webhook, para que el recorrido completo siga funcionando hasta F3.

### Comandos ejecutados y resultado real (2026-10-28)

| Comando | Resultado |
|---|---|
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm test` | exit 0: Vínculo **26/26** (integradores, entrega, seguridad, contrato OpenAPI), Talentia **30/30**, Puente **57/57** |
| `npm run build` | exit 0 (3 apps) |
| `npx playwright test` (escritorio + móvil) | **33/33** tras corregir 3 fallos (ver abajo) |

Problemas encontrados y corregidos: el `aria-label` del logo no incluía su texto visible; Swagger UI tenía contraste insuficiente, enlaces dentro de botones y un selector sin nombre (hoja `swagger-accesible.css`, sin *deep linking*); en las E2E, una URL leída antes de terminar la navegación y un ingreso sin esperar.

### Criterios

- **4 · Cumple.** `apps/vinculo/tests/integradores.test.ts` (secreto cifrado y visible una vez, token con client credentials, 401 con secreto malo, regenerar y revocar invalidan) y `e2e/vinculo.spec.ts` (desde `/developers` y con HTTP real).
- **3 · Cumple también para Vínculo.** `apps/vinculo/tests/contrato-openapi.test.ts` y `e2e/vinculo.spec.ts` (`/developers/docs`).
- **Pruebas de contrato contra docs/contratos.md:** `apps/vinculo/tests/entrega.test.ts` valida la entrega con un validador escrito a mano desde F1 y la firma con la fórmula de F2.
- **8 · Parcial:** el estado «CV descargado» ya se ve (descarga manual del reclutador y API de ciclo de vida probada); el aviso automático del puente llega en F3.

### Pendientes y riesgos

- **PENDIENTE (equipo):** revisar la lista de nombres generados (D-39).
- La revalidación del webhook cada 2 h de LinkedIn no se simula (D-33).

## F3 · Puente completo (2026-10-29)

> Actualizado por Claude Code (2026-10-29).

### Qué se hizo

- **Conexiones en pantalla (`/conexiones`, D-41):** asistente de 3 pasos (Vínculo: URL, Client ID y Client Secret; Talentia: URL y API Key; webhook del puente para copiar). Los secretos se guardan cifrados (AES-256-GCM) y solo se muestran como `••••abcd`. «Probar conexión» obtiene el token y la empresa que autorizó la aplicación, o los permisos de la llave y los procesos visibles; muestra «Despertando…» si tarda (arranque en frío).
- **Better Auth en el puente (D-42):** cuentas `admin@puente.demo.test` (ADMIN) y `operador@puente.demo.test` (OPERADOR), contraseña `Demo2026!`; cookie `pue_sesion`.
- **Webhook en `/api/webhooks/vinculo` (D-43):** desafío y firma con el Client Secret guardado; 503 si aún no hay conexión.
- **`/procesos` (D-44):** lista los procesos por la API de Talentia; «Publicar en Vínculo», «Cerrar en Vínculo» y «Publicar de nuevo»; publicación automática opcional. Las postulaciones se asocian al proceso por la publicación (`externalJobId` = id del proceso) o por correspondencia manual para vacantes creadas en Vínculo.
- **Transferencia:** pasos `cv_descargado → postulante_listo → documento_subido → postulacion_creada` con Idempotency-Key por paso; 401 y 403 de Talentia detienen con mensaje claro; 429 respeta Retry-After; 10 intentos; esperas de 75 s / 20 s según el último contacto (D-45, D-46). Si Vínculo invalida el token al descargar el CV, se pide uno nuevo una vez (error encontrado con la prueba nueva).
- **Aviso RESUME_DOWNLOADED** en un ciclo aparte del worker, con reintentos; visible en la operación (D-47).
- **Métricas** en `/metricas`; **controles de prueba** solo con `PUENTE_MODO_PRUEBAS=1` y para ADMIN.
- **`npm run demo:conectar`** y la preparación de las E2E conectan los tres sistemas por procesos, cada app con su `.env` (D-48). Se eliminó la siembra transitoria de D-25.

### Comandos ejecutados y resultado real (2026-10-29)

| Comando | Resultado |
|---|---|
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm test` | exit 0: Vínculo **26/26**, Talentia **30/30**, Puente **70/70** (nuevo `tests/conexiones.test.ts`: 20 pruebas) |
| `npm run test:e2e` (build + escritorio + móvil) | 1.ª ejecución: build fallido por tipos viejos en `.next` del puente; 2.ª: 32/37 (5 fallos de la limpieza `afterEach` y un texto) |
| `npx playwright test` tras corregir | **37/37** (4,1 min); después `e2e/panel.spec.ts` con la comprobación del criterio 1: **5/5** |
| `npm run demo:conectar` con `npm run dev` | exit 0: llave creada, aplicación autorizada, conexiones probadas, 9001 y 9002 publicadas con Solicitud sencilla, webhook validado |

Problemas encontrados y corregidos: la redirección de `/` del puente ocurría en pleno *streaming* (el navegador navegaba por su cuenta y rompía las auditorías): pasó a `redirects` de `next.config.ts`. Un fallo simulado que quedaba activo tras una prueba fallida contaminaba las siguientes: `afterEach` que quita los fallos.

### Criterios

- **1 · Cumple.** `e2e/panel.spec.ts` (sin sesión no se entra; con sesión en el puente, Talentia y Vínculo piden su ingreso y no hay cookies `tal_`/`vin_`).
- **5 · Cumple.** `tests/conexiones.test.ts` («Probar conexión», secreto incorrecto, permisos, desafío con el secreto guardado) y `e2e/tres-sistemas.spec.ts` (conexión configurada solo por pantallas y webhook validado desde el portal de Vínculo).
- **6 · Cumple.** `tests/conexiones.test.ts` (publicación, idempotencia, proceso no iniciado, automática) y `e2e/tres-sistemas.spec.ts` (proceso nuevo publicado desde `/procesos`).
- **7 · Cumple.** `e2e/tres-sistemas.spec.ts` (Postulantes en < 30 s, SHA-256 igual) y `e2e/recorrido.spec.ts`.
- **8 · Cumple.** `e2e/tres-sistemas.spec.ts` («CV descargado» en Mis postulaciones) y `tests/conexiones.test.ts` (aviso con reintentos).
- **9 y 10 · Cumplen.** `tests/fiabilidad.test.ts` (P2.2 entregas simultáneas, P2.3 misma persona en dos vacantes) y `e2e/criterios-29oct.spec.ts` (C6).
- **11 · Cumple.** `tests/fiabilidad.test.ts`, `tests/p5.test.ts`, `e2e/panel.spec.ts` y `e2e/criterios-29oct.spec.ts` (C8).
- **12 · Cumple.** `tests/conexiones.test.ts` y `e2e/tres-sistemas.spec.ts` (llave revocada en Talentia → detenido con «La API Key de Talentia fue revocada o no es válida.»; llave nueva + «Reintentar» completa).
- **13 · Cumple.** `tests/webhook.test.ts`, `tests/p5.test.ts` (vacante cerrada), `e2e/criterios-29oct.spec.ts` (C7) y la prueba de PDF inválido en Vínculo.

### Pendientes y riesgos

- `e2e/tres-sistemas.spec.ts` regenera el Client Secret de la aplicación demo del puente y crea llaves nuevas en Talentia: corre con `workers: 1` y deja las conexiones funcionando para las pruebas que siguen.
- Siguiente paso: F4 (realismo de datos, pulido visual, estados vacíos y de carga, capturas revisadas).

## F4 · Realismo y pulido visual (2026-10-29)

> Actualizado por Claude Code (2026-10-29).

### Qué se hizo

- **Capturas revisadas a mano:** `e2e/capturas.spec.ts` (solo con `CAPTURAS=1`) guarda 31 pantallas por proyecto (escritorio y Pixel 7) en `capturas/` (ignorada por git). Se revisaron portada, buscador, vacante, Solicitud sencilla, Mis postulaciones y portal de desarrolladores de Vínculo; tablero, ficha y API Keys de Talentia; operaciones, conexiones y procesos del puente.
- **Datos de demostración:** los postulantes sembrados en Talentia ya tienen CV PDF ficticio y fechas de historial coherentes (D-49); las cuentas demo de Vínculo tienen historial (Valentina: «CV descargado» y «Vista por la empresa»; Santiago: «Enviada»), así «Mis postulaciones» no se ve vacío en la demo.
- **Ajustes visuales:** puente sin franja entre la barra y el aviso de modo prueba; «Conexiones» con separación entre estado y formulario y los botones «Guardar y probar» / «Probar conexión» en una fila; sin la nota de webhook desactualizada; plural correcto («1 postulación»). Talentia: contador de columna alineado; en el teléfono el menú lateral es una fila compacta y el usuario ocupa una línea.
- Ya estaban: estados de carga (`loading.tsx`), error (`error.tsx`) y no encontrado (`not-found.tsx`) en las tres apps; estados vacíos con texto guía; «Entorno de simulación» en todas las pantallas; identidades propias (Vínculo verde azulado, Talentia índigo, puente grafito y ámbar).

### Comandos ejecutados y resultado real (2026-10-29)

| Comando | Resultado |
|---|---|
| `npm run lint` / `npm run typecheck` | exit 0 / exit 0 (antes, un error de tipos en `cv-demo.ts` rompía el build de Talentia; corregido) |
| `npm test` | Vínculo **26/26**, Talentia **30/30**, Puente **70/70**. Dos pruebas contaban filas de toda la tabla y fallaron con la siembra nueva; ahora cuentan solo las filas que crean (misma afirmación, más precisa) |
| `npm run test:e2e` | **37/37** (escritorio + móvil), incluidas la auditoría axe (WCAG 2.1 A/AA) de las pantallas principales y la de desbordes en móvil |
| `CAPTURAS=1 npx playwright test e2e/capturas.spec.ts` | 2/2 (capturas en escritorio y móvil) |

### Criterios

- **14 · Cumple.** `e2e/accesibilidad.spec.ts` (axe sin violaciones serias ni críticas en Vínculo, Talentia y el puente; navegación por teclado) y `e2e/movil.spec.ts` (sin desborde horizontal), más la revisión de capturas.

### Pendientes y riesgos

- **PENDIENTE (equipo):** revisar a ojo las capturas de `capturas/` y la lista de nombres generados (D-39).
- Siguiente paso: F5 (documentación).

## F5 · Documentación (2026-10-29)

> Actualizado por Claude Code (2026-10-29).

### Qué se hizo

- **README.md** reescrito para la v2 (lo había escrito Claude Code en la v1): instalación, arranque, `demo:conectar`, cuentas demo, demo en 7 pasos, comandos, Docker, despliegue y problemas frecuentes.
- **Plantillas de entorno:** `.env.example` (raíz, solo PostgreSQL) y `apps/<app>/.env.example`, sin valores reales. La plantilla raíz de la v1 quedó reemplazada.
- **Secciones v2 agregadas** (sin borrar lo de la v1) en `docs/arquitectura.md` (componentes, secuencia y estados en Mermaid), `docs/contratos.md` (§5 Vínculo frente a Apply Connect, §6 Talentia frente a BUK, §7 lo que expone el puente, cada punto etiquetado), `docs/mapeo-datos.md`, `docs/guion-demo.md` (7 minutos, local y Render, plan B), `docs/resultados-pruebas.md` (suites y prueba de cada criterio) y `docs/uso-ia.md`.
- **Nuevos:** `docs/manuales/` (índice y 7 manuales: candidato, reclutador de Vínculo, desarrollador, admin y reclutador de Talentia, admin y operador del puente) y `docs/seguridad.md` (llaves, cifrado, sesiones, integraciones, Ley 1581 como Supuesto pendiente, retención y borrado).
- **CLAUDE.md** actualizado: reglas del equipo sin cambios (más la regla de no importar dominio entre apps), arquitectura v2 y comandos reales.
- **Ajustes de código encontrados al documentar:** aviso de tratamiento de datos en `/registro` y en el paso 2 de la Solicitud sencilla de Vínculo; las URL de «Conexiones» del puente aceptan solo http/https (antes `z.url()` admitía cualquier esquema; prueba ampliada en `tests/conexiones.test.ts`).
- `docs/despliegue.md` se escribe en F7 junto con `render.yaml`. `docs/v2/` no se modificó.

### Comandos ejecutados y resultado real (2026-10-29)

| Comando | Resultado |
|---|---|
| `npm run lint` / `npm run typecheck` | exit 0 / exit 0 |
| `npm test` | Vínculo 26/26 · Talentia 30/30 · Puente 70/70 |
| `npm run test:e2e` | 37/37 (2,9 min) |

### Pendientes

- **PENDIENTE (equipo):** la lista de revisión de `docs/uso-ia.md` (v2).
- Siguiente paso: F6 (auditoría, doble ejecución e instalación limpia).

## F6 · Auditoría, doble ejecución e instalación limpia (2026-10-29)

> Actualizado por Claude Code (2026-10-29).

### Auditoría

| Revisión | Resultado |
|---|---|
| Falsos «completado» | `COMPLETADO` se escribe en un solo lugar (`completar` en `apps/puente/src/modules/procesador.ts`), siempre con el id de la postulación que Talentia devolvió (creación o reconciliación). RECIBIDO ≠ COMPLETADO. Sin cambios. |
| Duplicados | Restricción única por `jobApplicationId`, `Idempotency-Key` por paso y búsqueda por `referencia_externa` al reconciliar; cubierto por `fiabilidad.test.ts` (entregas simultáneas) y E2E C6. Sin cambios. |
| Secretos y datos personales en registros | **Corregido:** dos `console.error` del puente imprimían el objeto de error completo (un error de Prisma puede incluir valores de la consulta, como un correo); ahora solo la primera línea del mensaje. El resto de registros solo cuenta elementos o muestra mensajes. |
| Secretos en respuestas | La API Key y el Client Secret solo se muestran al crearlos; `/api/v1/api-key` devuelve el prefijo; «Conexiones» muestra `••••` + 4 caracteres; las pruebas de conexión muestran el prefijo de la llave. Sin cambios. |
| Rutas sin autorización | Revisadas las 25 rutas `route.ts`: API v1 de Talentia con `conApi` (llave y permiso); API de Vínculo con `conAplicacion` o token (media: solo la aplicación dueña, 403/410); descargas de CV con sesión y alcance por empresa; salud y OpenAPI públicas a propósito y sin datos. Las acciones de servidor comprueban sesión y rol, y las de Vínculo además el dueño (aplicaciones) o la empresa (vacantes, postulaciones). Sin cambios. |
| SSRF | Vínculo (webhooks) y el puente (URL de «Conexiones») usan `motivoUrlNoPermitida`: fuera de local, solo https y sin redes privadas, loopback ni enlace local; las descargas no siguen redirecciones. **Corregido en F5:** las URL de «Conexiones» aceptan solo http/https. Riesgo residual: *DNS rebinding* entre la validación y la llamada (aceptable para el prototipo). |
| Cookies compartidas | Nombres distintos por app (`vin_sesion`, `tal_sesion`, `pue_sesion`); prueba E2E del criterio 1. Sin cambios. |
| Nombre de la empresa retadora | `git grep -i` en los archivos versionados y `git log --all -G` (insensible a mayúsculas) en todo el historial: **0 coincidencias**. La única aparición en disco es el nombre del PDF en `docs/ficha/` (ignorada por git) y una secuencia casual dentro de un binario base64 del cliente Prisma generado (ignorado). |
| Avisos de Node | `DEP0190` (argumentos con `shell: true`) en `demo:conectar`, `dev.mjs` y la preparación E2E: ahora se pasa una sola cadena de comando con argumentos fijos. |

### Doble ejecución (detección de pruebas inestables)

| Comando | Ronda 1 | Ronda 2 |
|---|---|---|
| `npm test` | 26/26 · 30/30 · 70/70 | 26/26 · 30/30 · 70/70 |
| `npm run build` + `npx playwright test` | 37/37 (3,5 min) | 37/37 (3,1 min) |

### Instalación limpia siguiendo solo el README

En `.instalacion-limpia/` (clon de la rama `v2` en el commit `0946410`, dentro de esta carpeta e ignorada por git; borrada al terminar):

| Paso del README | Resultado |
|---|---|
| `npm install` | exit 0, 0 vulnerabilidades |
| `npm run setup` | exit 0; el 5435 estaba ocupado por el PostgreSQL de esta carpeta y eligió el **5436**, como dice el README; migró y sembró las tres apps |
| `npm run dev` | las tres `/api/salud` en `ok`; portada, empleos, `/developers/docs`, `/apidocs` e ingresos responden 200 (el puente redirige `/` con 307) |
| `npm run demo:conectar` | exit 0: llave, aplicación autorizada, conexiones probadas, 9001 y 9002 publicadas, webhook validado |
| `npx playwright install chromium` + `npm run test:e2e` | **37/37** (2,9 min) |
| `npm test` / `npm run lint` | 26/26 · 30/30 · 70/70 / 0 errores |

Observación: si `npm run dev` se interrumpe matando solo el proceso padre (no con Ctrl+C en la terminal), en Windows los `next` hijos pueden quedar vivos ocupando 3001–3003; con Ctrl+C se detienen todos.

### Criterios

- **15 (parte local) · Cumple:** instalación limpia desde el README con todas las pruebas en verde. La validación de `render.yaml` va en F7.

### Pendientes

- Siguiente paso: F7 (Render, verificación de `.gitignore`, repositorio privado y push).

## F7 · Render, repositorio y entrega (2026-10-29)

> Actualizado por Claude Code (2026-10-29).

### Qué se hizo

- **`render.yaml`** (plan gratuito): 3 servicios web (`vinculo-simulado`, `talentia-simulado`, `puente-postulaciones`) y 1 base (`puente-postulaciones-db`); `DB_SCHEMA` por app; secretos con `generateValue` (sin `sync: false`); workers en el proceso web; `startCommand` con `prisma migrate deploy` + siembra `--si-vacio` + `next start -p $PORT`; `healthCheckPath: /api/salud`; `PUENTE_MODO_PRUEBAS=0`; 75 s por intento de entrega para el arranque en frío.
- **Cambios para Render:** claves de cifrado que aceptan el valor de `generateValue` (D-50, prueba `apps/puente/tests/cifrado.test.ts`); siembra idempotente `--si-vacio` en las tres apps (D-51).
- **`docs/despliegue.md`:** paso a paso, conexión de los sistemas por pantallas, límites del plan gratuito y cómo despertar los servicios antes de presentar.
- **Verificaciones:** `.gitignore` excluye `.env` (raíz y apps), `.pgdata`, `docs/ficha`, `capturas/`, `test-results/` y los clientes generados; solo se versionan las plantillas `.env.example`. Ni la contraseña real de PostgreSQL ni ningún secreto de los `.env` aparece en archivos versionados ni en el historial (`git log --all -p`). El nombre de la empresa retadora: 0 coincidencias en archivos y en el historial (F6, repetido antes del push).

### Comandos ejecutados y resultado real (2026-10-29)

| Comando | Resultado |
|---|---|
| `render blueprints validate render.yaml -w <workspace>` | `"valid": true` (1 base, 3 servicios, 4 acciones). Sin `-w` la CLI pedía un workspace por defecto; se fijó el único de la cuenta con `render workspace set` |
| `render services` | `null`: la cuenta no tiene servicios ni bases (el cupo de base gratuita está libre) |
| `npm run lint` / `npm run typecheck` | 0 / 0 |
| `npm test` | Vínculo 26/26 · Talentia 30/30 · Puente 73/73 (incluye `cifrado.test.ts`) |
| `npm run test:e2e` | 37/37 (3,1 min) |

### Despliegue

- La CLI de Render (v2.33.0) **no puede crear Blueprints** (`render blueprints` solo tiene `validate`). **Paso manual pendiente:** Render → **New** → **Blueprint** → repositorio **puente-postulaciones-sena**, rama **v2** → **Deploy Blueprint**; después conectar los sistemas por pantallas (docs/despliegue.md, paso 3).

### Criterios

- **15 · Cumple:** instalación limpia desde el README (F6) y `render blueprints validate` sin errores.

### Repositorio

- `gh repo create puente-postulaciones-sena --private` → https://github.com/xEmi23/puente-postulaciones-sena (**privado**). `--source .` no funcionó porque esta carpeta es un *worktree* (`.git` es un archivo); el remoto `origin` se agregó a mano con la misma URL.
- `git push -u origin v2`: rama `v2` publicada; es la **única** rama del remoto. Comprobado en GitHub: sin `.env`, sin `docs/ficha/`, con `render.yaml` en la raíz.

### Pendientes que dependen del equipo o la empresa

- Crear el Blueprint en Render (paso manual de arriba) y conectar los sistemas por pantallas.
- D-26: encabezado real de la API Key de BUK. D-39: revisar los nombres generados. Ley 1581: revisión de `docs/seguridad.md`. Lista de revisión de `docs/uso-ia.md`.

## Render: verificación y prueba de humo (2026-10-29)

> Actualizado por Claude Code (2026-10-29). El equipo creó el Blueprint.

### Servicios

- `render services -o json`: 3 servicios web **free** (`vinculo-simulado`, `talentia-simulado`, `puente-postulaciones`, rama `v2`) y la base **free** `puente-postulaciones-db` (disponible; **vence el 2026-11-28**).
- `render deploys list <servicio>`: los tres despliegues del commit `d706ddd` están **live** al primer intento (11:19 → 11:21–11:22 UTC). No hubo que corregir código ni `render.yaml`.
- `/api/salud` → `ok` en los tres. URLs: https://vinculo-simulado.onrender.com · https://talentia-simulado.onrender.com · https://puente-postulaciones.onrender.com.

### Prueba de humo

- Nueva `e2e/humo-render.spec.ts` con su propia configuración (`playwright.render.config.ts`, sin global-setup; excluida de la suite local con `testIgnore`). Recorre por las pantallas: API Key en Talentia → aplicación en Vínculo autorizada por Andina → conexiones del puente → webhook validado → publicar 9001 → Solicitud sencilla con un PDF → Completado en el puente, tarjeta en Postulantes y mismo SHA-256 → «CV descargado».
- **Resultado:** todos los pasos pasaron contra Render (detalle por ejecución en docs/resultados-pruebas.md). El único fallo fue de la prueba (la candidata demo tiene CV en su perfil y el formulario lo preselecciona); se corrigió la prueba.
- **Incidente y reparación:** al documentar, un comando de shell interpretó texto entre comillas invertidas y volvió a ejecutar la prueba de humo **completa**: creó una segunda aplicación en Vínculo y una segunda API Key, y dejó el puente con la aplicación nueva, mientras la vacante 9001 seguía siendo de la primera (las entregas a 9001 habrían fallado la firma). Se reparó por las pantallas con un script puntual de Playwright (fuera del repositorio): se revocó la aplicación sobrante, se regeneró el secreto de la original, se guardó en el puente («Token obtenido… autorizada por Andina») y Vínculo revalidó el webhook; también se revocó la API Key que quedó sin uso. Verificación posterior con `santiago.mejia@demo.test`: 4/4. Desde entonces, los documentos se editan solo con las herramientas de edición, no con la shell.

### Arranque en frío

- Medido tras 17 minutos sin tráfico, con `curl` a `/api/salud`: **Talentia 83 s**, **Puente 92 s**, **Vínculo 65 s** (el primer intento a Vínculo falló al instante por un fallo de DNS de esta máquina, `HTTP 000` en 0,08 s, no del servicio; se repitió). Los tres respondieron `200` al despertar.
- Consecuencia: las esperas del sistema (75 s por llamada si el otro lleva más de 10 minutos sin responder, más los reintentos: unos 13 minutos en el puente y unos 15 en Vínculo) cubren el despertar, pero **un solo intento puede vencerse** si el servicio tarda más de 75 s (el puente tardó 92 s); el reintento siguiente lo encuentra despierto. Para la demo: despertar los tres 15 minutos antes, como dice docs/despliegue.md.

### Comandos

| Comando | Resultado |
|---|---|
| `render services -o json` / `render deploys list` | 3 web free + 1 base free; 3 despliegues `live` |
| `RENDER_HUMO=1 npx playwright test -c playwright.render.config.ts` | 6 ✓, 1 ✗ (prueba), 2 sin ejecutar |
| `… -g "(0 ·\|6 ·\|7 ·\|8 ·)"` (Valentina) | 4/4 ✓ |
| `RENDER_CANDIDATO=santiago … -g "(0 ·\|6 ·\|7 ·\|8 ·)"` (tras la reparación) | 4/4 ✓ |
| `npx playwright test --list` (suite local) | la prueba de humo no aparece (excluida) |

### Pendientes

- Ensayar la demo en Render despertando los servicios 15 minutos antes (docs/despliegue.md) y usar otro proceso (p. ej. 9003): 9001 ya tiene postulaciones de prueba.
- La base gratuita vence el **2026-11-28**: para una presentación posterior, recrearla y volver a conectar.
- Siguen los pendientes del equipo: D-26, D-39, Ley 1581, lista de `docs/uso-ia.md`.

---

# V4 (desde el 2026-11-02)

> Actualizado por Claude Code (2026-11-02). Especificación: `docs/v4/ESPECIFICACION_V4.md`. Rama `v4` (desde `v2` `f1b7c4c`). Modo nocturno autónomo (PROMPT_NOCHE_V4.md): F0 → F1 → F2 → F3 → F5 (solo documentación). F4 (bot) no se hace: la Puerta 0 está pendiente.

## V4 F0 · Auditoría (2026-11-02)

- Línea base: lint 0 · typecheck 0 · Vitest 129/129 · Playwright 37/37 (**166**). Informe: `docs/v4/INFORME_F0.md`; reporte: `docs/v4/REPORTE_F0.md`.
- Siguiente paso: F1 (contrato canónico, `registrarRecepcion`, `ConectorATS`).

## V4 F1 · Núcleo y ConectorATS (2026-11-02)

- Contrato canónico v1, `registrarRecepcion()`, `ConectorATS` (Talentia activo y simulado; BUK deshabilitado), `ATS_DESTINO`, webhook de Vínculo mapeado a la canónica, procesador sin conocer la fuente ni el ATS. Migración `20261102120000_v4_f1_fuente`. Decisiones D-52 a D-56. Reporte: `docs/v4/REPORTE_F1.md`.
- Puerta de calidad: lint 0 · typecheck 0 · Vitest 26 + 30 + 110 · Playwright 37/37 (**203**).
- Siguiente paso: F2 (entrada genérica, fuentes y tokens, revisión, auditoría, retención).

## V4 F2 · Entrada genérica (2026-11-02)

- Fuentes con token (pantalla Fuentes), `POST /api/entradas/v1/postulaciones` y `GET /api/entradas/v1/vacantes`, correspondencias por fuente, `REQUIERE_REVISION` (sin correo, sin CV, datos sin confirmar, posible duplicado), acciones de revisión, borrar datos del candidato, `EventoAuditoria`, retención, logs con `idRecepcion` y correos enmascarados, métricas por fuente, 5 intentos. Migración `20261102180000_v4_f2_entrada_generica`. Decisiones D-57 a D-61. Reporte: `docs/v4/REPORTE_F2.md`.
- Puerta de calidad: lint 0 · typecheck 0 · Vitest 26 + 30 + 129 · Playwright 41/41 (**226**).
- Siguiente paso: F3 (importador manual).

## V4 F3 · Importador manual (2026-11-02)

- Página Importar (proceso o correspondencia, hasta 20 PDF y CSV opcional), lectura de texto con unpdf 1.9.0, sugerencia de correo y teléfono sin IA, tabla de revisión y confirmación por `registrarRecepcion()` (fuente `importador`, `idExterno = <proceso>:<sha256>`), lotes temporales borrados a las 24 h. Migración `20261103000000_v4_f3_importador`. Decisiones D-62 a D-64. Manual `docs/manuales/importador.md`. Reporte: `docs/v4/REPORTE_F3.md`.
- Puerta de calidad: lint 0 · typecheck 0 · Vitest 26 + 30 + 142 · Playwright 45/45 (**243**).
- Siguiente paso: F5 (solo documentación esta noche; sin despliegue).

## V4 F5 · Documentación (2026-11-02, sin despliegue)

- README, arquitectura (capas V4), seguridad, guion V4, resultados, uso de IA y comandos de despliegue preparados. `render.yaml` con las variables V4 del Puente (validado). **No** se desplegó ni se hizo merge a `v2`. Reporte: `docs/v4/REPORTE_F5.md`. Informe de la noche: `docs/v4/INFORME_NOCHE.md`.
- Pendientes del equipo: Puerta 0 (`docs/v4/PUERTA0.md`), F4 si «Bot = sí», aprobación del despliegue (PROMPT F5 con «APROBADO PARA DESPLEGAR»).

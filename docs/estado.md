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

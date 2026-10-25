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

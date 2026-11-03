# talent-bridge: contexto permanente para Claude Code

## ⚠ Versión vigente: V4 (desde el 02/11/2026)

Antes de cualquier tarea lee **`docs/v4/CONTEXTO_V4.md`** (historia, hechos y forma de trabajo) y **`docs/v4/ESPECIFICACION_V4.md`** (fuente de verdad, incluida su sección R de reglas comunes). Los prompts por fase están en `PROMPTS_V4.md` (F0 → F5); se ejecuta **una fase por prompt** y luego te detienes. `docs/v3/` es historia: no se construye.
Excepción acotada a la regla «sin automatizar sesiones reales»: solo el adaptador experimental `apps/bot-linkedin` de la fase F4 y solo si `docs/v4/PUERTA0.md` dice «Bot = sí». Claude Code nunca abre LinkedIn real.

> Fusión de `CLAUDE_equipo.md` (contexto original del equipo) con el CLAUDE.md de Claude Code. Actualizado por Claude Code (2026-10-29) para la **v2** (tres apps independientes, `docs/v2/`).

## Qué es

Prototipo académico (reto SENA, Innovación Abierta 2026-2). Reduce el trabajo manual de trasladar postulaciones desde un portal de empleo tipo LinkedIn a un ATS tipo BUK.
Hoy el reclutador entra a cada vacante en LinkedIn, descarga todos los CV y los sube al ATS; ahí una IA los califica y empieza el proceso por etapas. Este proyecto elimina ese traslado por vacante.

No hay acceso a APIs reales de LinkedIn ni de BUK. En la v2 son **tres sistemas independientes**:

1. **Vínculo** (en pantalla «Simulador LinkedIn», `apps/vinculo`, puerto 3001, esquema `vinculo`): red profesional **simulada** (empleos, perfiles, «Solicitud sencilla», panel del reclutador, portal de desarrolladores y API modelada sobre Apply Connect).
2. **Talentia** (en pantalla «Simulador BUK», `apps/talentia`, puerto 3002, esquema `talentia`): ATS **simulado** (procesos por etapas, postulantes, API Keys con permisos de Selección, API v1 y `/apidocs`).
3. **Puente** (`apps/puente`, puerto 3003, esquema `puente`): **el producto**. Conexiones configurables y cifradas, publicación en Vínculo, recepción del webhook, transferencia a Talentia, aviso «CV descargado», operaciones, rechazos y métricas.

## Reglas que nunca se rompen

- Nunca afirmar conexión, certificación ni compatibilidad comprobada con LinkedIn o BUK. Todo lo externo se llama «simulado».
- Cada pantalla muestra discretamente «Entorno de simulación · No es LinkedIn ni BUK: simulación académica». **Nombres visibles (D-74, decisión del equipo del 03/11/2026, reemplaza la regla anterior):** el origen se muestra como «Simulador LinkedIn» y el ATS como «Simulador BUK», siempre con la palabra «Simulador»; la fuente del bot como «LinkedIn (bot, simulador)» y el importador como «Importador manual». Por dentro (carpetas, paquetes, esquemas, URL, variables, identificadores) siguen siendo `vinculo` y `talentia`. **Identidad visual propia:** sin logos, colores ni tipografías de LinkedIn, BUK o la empresa. El origen y el ATS deben sentirse como productos distintos.
- Sin *scraping*, sin automatizar sesiones reales, sin llamadas a servicios externos reales.
- Solo datos y CV ficticios (`@demo.test`). Nunca usar nombres reales de candidatos, tampoco los de capturas de pantalla.
- **No usar el nombre de la empresa retadora** en código, seeds, UI ni documentos publicables (la ficha exige publicación anonimizada).
- No inventar endpoints oficiales. Si no está verificado en documentación oficial, es «contrato del simulador» (docs/contratos.md §3 y §5–§7). No atribuir a BUK lo que no está verificado.
- **Etiquetar todo en los documentos** como **Verificado** (con URL y fecha), **Decisión interna** (registrada en `docs/decisiones.md`) o **Supuesto pendiente**.
- Un acuse de recepción (200) no es una transferencia completada. En el puente, RECIBIDO ≠ COMPLETADO; solo `postulacion_creada` en el ATS cuenta como transferido.
- No desactivar ni debilitar pruebas para que pasen. Reportar exactamente qué se ejecutó y con qué resultado.
- No poner secretos en el repositorio: los `.env` se generan con `npm run setup` y están ignorados. La ficha del reto (`docs/ficha/`) no se publica.
- Documentos del equipo en `docs/` (incluido `docs/v2/`): no sobrescribirlos; agregar secciones «Actualizado por Claude Code (fecha)».
- Textos de la interfaz en español.
- **v2:** prohibido importar código de dominio entre apps (si algo se comparte, se duplica o va a `packages/` solo si no es dominio). Cada app toca solo su esquema; entre apps solo HTTP.

## Arquitectura (v2: npm workspaces, tres apps Next.js 16)

Detalle y diagramas Mermaid en `docs/arquitectura.md` (sección «v2»).

- `apps/<app>/src/app/…` UI y rutas de API · `src/modules/…` lógica · `src/lib/…` configuración, base, sesión, cifrado · `prisma/` esquema, migración, siembra · `tests/` Vitest · `worker/` (Vínculo y puente).
- Cada app: su `package.json`, su `.env` (secretos propios), su esquema (`DB_SCHEMA`, por defecto el nombre de la app; `_prisma_migrations` dentro del esquema) y Better Auth con cookie propia (`vin_sesion`, `tal_sesion`, `pue_sesion`).
- **Workers dentro del proceso web** con `WORKER_EN_PROCESO=1` (`instrumentation.ts`): despachador de webhooks de Vínculo; procesador, avisos y publicación automática del puente. En E2E corren aparte.
- **Puente ↔ sistemas:** credenciales en `puente.Conexion` (cifradas, `PUENTE_CLAVE_CIFRADO`), configuradas en `/conexiones` o con `npm run demo:conectar`. Clientes HTTP aislados: `src/modules/vinculo-cliente.ts` (token client credentials, publicación, media, ciclo de vida) y `src/modules/ats-cliente.ts` (API v1 de Talentia, `auth_token`, `Idempotency-Key`). Webhook: `/api/webhooks/vinculo`.
- Pasos de una recepción: `cv_descargado → postulante_listo → documento_subido → postulacion_creada`. Proceso destino: publicación del puente (`externalJobId` = id del proceso) o correspondencia manual.
- Etapas de Talentia: `apps/talentia/src/modules/etapas.ts`, según `docs/referencia-ats.md`.
- Pruebas: Vitest por app contra PostgreSQL real; el puente usa **dobles de contrato** (`apps/puente/tests/dobles.ts`); Playwright arranca las tres apps compiladas y sus workers como procesos reales (`e2e/supervisor.mjs`, puertos 3211–3213).

## Comandos

| Comando | Qué hace |
|---|---|
| `npm install` | Instala dependencias de los tres workspaces (versiones exactas). |
| `npm run setup` | `.env` raíz (PostgreSQL) y `apps/<app>/.env` con secretos aleatorios; PostgreSQL local en `.pgdata` (puerto 5435 o siguiente libre; bases `tb2_dev`/`tb2_test`/`tb2_e2e`); migra y siembra las tres apps. |
| `npm run pg:start` / `pg:stop` / `pg:status` | PostgreSQL local del proyecto. **No tocar el 5433 (v1).** |
| `npm run dev` / `npm start` | Las tres apps (3001, 3002, 3003) con sus workers dentro del proceso. |
| `npm run demo:conectar` | Con las apps encendidas: API Key en Talentia, aplicación autorizada en Vínculo, conexiones del puente probadas, 9001 y 9002 publicadas, webhook validado. |
| `npm run demo:bot` | V4 F4-V: demo del bot sobre Vínculo (vacante VIN-DEMO-BOT con 3 postulaciones, fuente «vinculo-bot» y token en `apps/bot-linkedin/.env`, correspondencia → 9005, conexión con Talentia) y deja `VINCULO_API_HABILITADA=false`. |
| `npm run vinculo:api -- on|off|estado` | API tipo Apply Connect de Vínculo (D-68, apagada por defecto). `demo:conectar` la necesita prendida. Reiniciar las apps tras cambiarla. |
| `npm run bot:login -w apps/bot-linkedin` / `npm run bot -w apps/bot-linkedin` | Bot asistido experimental (perfil `vinculo`; `linkedin` se niega hasta la Puerta 0). |
| `npm run demo:reset` | Borra y re-siembra solo datos `demo = true` en las tres apps (en el puente también conexiones y publicaciones). Se niega con `NODE_ENV=production` o base no local. |
| `npm run lint` | ESLint (raíz). |
| `npm run typecheck` | `prisma generate` + `tsc --noEmit` en cada app. |
| `npm test` | Vitest de cada app contra `tb2_test`. Una sola app: `npm test -w apps/<app>`. |
| `npm run test:e2e` | `next build` de las tres + Playwright escritorio y móvil contra `tb2_e2e`. Capturas para revisión: `CAPTURAS=1 npx playwright test e2e/capturas.spec.ts`. |
| `npm run build` | Compilación de producción de las tres apps. |
| `npm run db:migrate` / `db:seed` | Migraciones (`prisma migrate deploy`) y siembra de las tres apps. |
| `npm run cv:generar` | Regenera los CV ficticios en `fixtures/cv/`. |

Docker (alternativa, no probada en esta máquina): `PG_PASSWORD=<la del .env raíz> docker compose up -d` expone PostgreSQL en el 5435 con las mismas bases.

Despliegue: Render, plan gratuito, `render.yaml` (ver `docs/despliegue.md`).

## Más contexto

- `docs/v2/SOLUCION.md` y `docs/v2/ESPECIFICACION.md`: lo que pide el equipo para la v2 (no reescribir).
- `docs/referencia-ats.md`: cómo luce y funciona el ATS que usa la empresa (base de Talentia).
- `docs/contratos.md`: contratos verificados y contratos del simulador (v2: §5–§7).
- `docs/decisiones.md`: decisiones con alternativa descartada y motivo (v2 desde D-20).
- `docs/estado.md`: estado por fase, pruebas ejecutadas, riesgos y siguiente paso. Leerlo al empezar cada sesión y actualizarlo al terminar.
- `docs/arquitectura.md`, `docs/mapeo-datos.md`, `docs/seguridad.md`, `docs/despliegue.md`, `docs/guion-demo.md`, `docs/resultados-pruebas.md`, `docs/uso-ia.md`, `docs/manuales/`.

# CLAUDE.md: talent-bridge

> Creado por Claude Code (2026-10-25). **Pendiente:** fusionar con `CLAUDE_equipo.md` (contexto original del equipo), que no está en la carpeta. Mientras tanto se agregaron aquí las reglas del equipo que se conocen.

## Qué es

Prototipo para el Reto #1 SENA (Innovación Abierta 2026-2). Hoy el reclutador descarga cada CV de LinkedIn y lo sube al ATS. El prototipo demuestra un **puente** que recibe postulaciones con el contrato de LinkedIn Apply Connect y las registra en un ATS sin intervención manual. Los dos extremos están **simulados**: no hay acceso a las APIs de LinkedIn ni de BUK.

- `/origen`: portal de empleo simulado «Vitrina Empleo». Postulación sin cuenta, outbox y despachador firmado.
- `/puente` y `/api/puente/*`: el puente. Webhook, trabajos persistentes, panel y correspondencias.
- `/ats` y `/api/ats/v1/*`: ATS simulado «Selecta». API del simulador y tablero por etapas.
- `worker/`: despachador del origen y procesador del puente.

## Reglas del proyecto

- Nunca usar servicios reales de LinkedIn o BUK, hacer *scraping* ni usar datos o nombres reales. Los datos de prueba son ficticios (`@demo.test`).
- No atribuir a BUK rutas o capacidades no verificadas. La API del ATS es «contrato del simulador» (docs/contratos.md §3).
- No poner secretos en el repositorio: `.env` se genera con `npm run setup` y está ignorado.
- La ficha del reto (`docs/ficha/`) no se publica. Está en `.gitignore`.
- Documentos del equipo en `docs/`: no sobrescribirlos; agregar secciones «Actualizado por Claude Code (fecha)».
- Los esquemas `origen`, `puente` y `ats` no se leen entre sí; se comunican por HTTP.
- Textos de la interfaz en español. Aviso «Entorno de simulación» en cada pantalla.
- **No usar el nombre de la empresa retadora ni nombres de personas reales** en código, datos, interfaz ni documentos publicables (la ficha exige publicación anonimizada). Los datos de prueba usan nombres evidentemente ficticios.
- **Identidad visual propia:** ningún módulo copia logos, colores ni marcas de LinkedIn, BUK ni de la empresa. El origen («Vitrina Empleo») y el ATS («Selecta») deben sentirse como productos distintos.
- **Etiquetas de certeza** en toda afirmación sobre contratos o sistemas externos: **Verificado** (lo dice una fuente consultada, con URL y fecha), **Decisión interna** (lo elegimos nosotros, registrado en `docs/decisiones.md`) o **Supuesto pendiente** (falta confirmar).
- Las etapas del ATS simulado vienen de `docs/referencia-ats.md` (observación del ATS de la empresa, 15/10/2026). Fuente única en código: `src/modules/ats/etapas.ts`.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm install` | Instala dependencias (versiones exactas). |
| `npm run setup` | Crea `.env` con secretos aleatorios, inicializa PostgreSQL local (`.pgdata`, puerto 5433, bases `tb_dev`/`tb_test`/`tb_e2e`), migra y siembra. |
| `npm run pg:start` / `pg:stop` / `pg:status` | Arranca, detiene o consulta el PostgreSQL local del proyecto. |
| `npm run dev` | App en http://localhost:3100 (los tres módulos). |
| `npm run worker` | Worker (despachador del origen y procesador del puente). Necesario para que las postulaciones fluyan. |
| `npm run lint` | ESLint. |
| `npm run typecheck` | `prisma generate` + `tsc --noEmit`. |
| `npm test` | Vitest contra PostgreSQL real (`tb_test`), recorrido completo en proceso. |
| `npm run test:e2e` | `next build` + Playwright (app en :3200 y worker contra `tb_e2e`, arrancados por la prueba). |
| `npm run build` | `prisma generate` + `next build`. |
| `npm run db:migrate` | Aplica migraciones (`prisma migrate deploy`) y genera el cliente. |
| `npm run db:seed` | Siembra los datos de demostración. |
| `npm run demo:reset` | Borra y re-siembra solo datos `demo = true`. Se niega si `NODE_ENV=production` o la base no es local. |
| `npm run cv:generar` | Regenera los CV ficticios en `fixtures/cv/`. |

Docker (alternativa): `PG_PASSWORD=<la de .env> docker compose up -d` expone PostgreSQL en el 5433 con las mismas bases.

## Estado

Ver `docs/estado.md`. Decisiones: `docs/decisiones.md`. Contratos: `docs/contratos.md`.

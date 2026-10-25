# talent-bridge: contexto permanente para Claude Code

> Fusión de `CLAUDE_equipo.md` (contexto original del equipo) con el CLAUDE.md de Claude Code. Actualizado por Claude Code (2026-10-25).

## Qué es

Prototipo académico (reto SENA, Innovación Abierta 2026-2). Reduce el trabajo manual de trasladar postulaciones desde un portal de empleo tipo LinkedIn a un ATS tipo BUK.
Hoy el reclutador entra a cada vacante en LinkedIn, descarga todos los CV y los sube al ATS; ahí una IA los califica y empieza el proceso por etapas. Este proyecto elimina ese traslado por vacante.

No hay acceso a APIs reales de LinkedIn ni de BUK. Construimos cuatro piezas:

1. **Origen simulado** (portal de empleo «Vitrina Empleo», `/origen`): vacantes, postulación con CV PDF y envío de eventos con el contrato documentado de Apply Connect.
2. **Puente** (`/api/puente/*` + worker): recibe, valida, deduplica y transfiere datos y CV al destino. Es el producto real.
3. **Destino simulado** (ATS «Selecta», `/ats`): procesos de selección por etapas, candidatos y documentos.
4. **Panel del puente** (`/puente`): operaciones, pasos, errores, reintentos, correspondencias y métricas.

## Reglas que nunca se rompen

- Nunca afirmar conexión, certificación ni compatibilidad comprobada con LinkedIn o BUK. Todo lo externo se llama «simulado».
- Cada pantalla muestra discretamente «Entorno de simulación». **Identidad visual propia:** sin logos, nombres ni colores de LinkedIn, BUK o la empresa. El origen y el ATS deben sentirse como productos distintos.
- Sin *scraping*, sin automatizar sesiones reales, sin llamadas a servicios externos reales.
- Solo datos y CV ficticios (`@demo.test`). Nunca usar nombres reales de candidatos, tampoco los de capturas de pantalla.
- **No usar el nombre de la empresa retadora** en código, seeds, UI ni documentos publicables (la ficha exige publicación anonimizada).
- No inventar endpoints oficiales. Si no está verificado en documentación oficial, es «contrato del simulador» (docs/contratos.md §3). No atribuir a BUK lo que no está verificado.
- **Etiquetar todo en los documentos** como **Verificado** (con URL y fecha), **Decisión interna** (registrada en `docs/decisiones.md`) o **Supuesto pendiente**.
- Un acuse de recepción (200) no es una transferencia completada. En el puente, RECIBIDO ≠ COMPLETADO; solo `postulacion_creada` en el ATS cuenta como transferido.
- No desactivar ni debilitar pruebas para que pasen. Reportar exactamente qué se ejecutó y con qué resultado.
- No poner secretos en el repositorio: `.env` se genera con `npm run setup` y está ignorado. La ficha del reto (`docs/ficha/`) no se publica.
- Documentos del equipo en `docs/`: no sobrescribirlos; agregar secciones «Actualizado por Claude Code (fecha)».
- Textos de la interfaz en español.

## Arquitectura (un repositorio, una app Next.js + un worker)

Tal como está construida. Las diferencias con el plan original del equipo están en la tabla de abajo.

- `src/app/origen/…` UI del portal simulado · `src/app/api/origen/…` su API (URL privada del CV).
- `src/app/ats/…` UI del ATS simulado · `src/app/api/ats/v1/…` su API (contrato del simulador).
- `src/app/puente/…` panel · `src/app/api/puente/…` webhook y estado de vacantes.
- `src/modules/<origen|puente|ats>/` lógica de cada módulo · `src/modules/contrato-apply-connect.ts` contrato externo (adaptador del formato de LinkedIn).
- `worker/` proceso aparte (`npm run worker`): despachador del origen y procesador de trabajos persistentes del puente.
- PostgreSQL con esquemas separados `origen`, `puente` y `ats`. Cada módulo solo toca su esquema.
- El puente habla con los simuladores **solo por HTTP** (URLs base en variables de entorno), nunca leyendo sus tablas.
- Modelo interno normalizado en el puente (`puente.Recepcion`); los formatos externos viven solo en el contrato y en el cliente del ATS.
- Etapas del ATS: configuración editable en `src/modules/ats/etapas.ts`, según `docs/referencia-ats.md`.

| Plan del equipo | Implementado | Motivo |
|---|---|---|
| Grupos de rutas `(origen)`, `(ats)`, `(puente)` | Segmentos `/origen`, `/ats`, `/puente` | Cada módulo tiene su propia URL visible en la demo y su propio layout e identidad (D-02) |
| `domain/application/infrastructure` por módulo | Módulos planos por responsabilidad (`postulacion`, `despachador`, `webhook`, `procesador`, `servicio`…) | Tamaño de prototipo; las fronteras entre sistemas se mantienen por esquema y por HTTP |
| Documentos en `storage/origen` y `storage/ats` | CV como `bytea` en el esquema de cada módulo (`origen.ArchivoCv`, `ats.Documento`) | Sobrevive a reinicios, viaja en la misma transacción que la postulación y se borra con el reset demo. Nunca en `public/`; separados por módulo |

## Comandos

| Comando | Qué hace |
|---|---|
| `npm install` | Instala dependencias (versiones exactas). |
| `npm run setup` | Crea `.env` con secretos aleatorios, inicializa PostgreSQL local (`.pgdata`, primer puerto libre desde 5433, bases `tb_dev`/`tb_test`/`tb_e2e`), migra y siembra. |
| `npm run pg:start` / `pg:stop` / `pg:status` | Arranca, detiene o consulta el PostgreSQL local del proyecto. |
| `npm run dev` | App en http://localhost:3100 (los tres módulos). |
| `npm start` | App compilada en el puerto 3100 (después de `npm run build`). |
| `npm run worker` | Worker (despachador del origen y procesador del puente). Necesario para que las postulaciones fluyan. |
| `npm run lint` | ESLint. |
| `npm run typecheck` | `prisma generate` + `tsc --noEmit`. |
| `npm test` | Vitest contra PostgreSQL real (`tb_test`): recorrido completo en proceso, fiabilidad y contratos independientes. |
| `npm run test:e2e` | `next build` + Playwright, escritorio y móvil (app en :3200 y worker contra `tb_e2e`, gestionados por `e2e/supervisor.mjs`). |
| `npm run build` | `prisma generate` + `next build`. |
| `npm run db:migrate` | Aplica migraciones (`prisma migrate deploy`) y genera el cliente. |
| `npm run db:seed` | Siembra los datos de demostración. |
| `npm run demo:reset` | Borra y re-siembra solo datos `demo = true`. Se niega si `NODE_ENV=production` o la base no es local. |
| `npm run cv:generar` | Regenera los CV ficticios en `fixtures/cv/`. |

Docker (alternativa, no probada en esta máquina): `PG_PASSWORD=<la de .env> docker compose up -d` expone PostgreSQL en el 5433 con las mismas bases.

## Más contexto

- `docs/referencia-ats.md`: cómo luce y funciona el ATS que usa la empresa (base del simulador de destino).
- `docs/contratos.md`: contratos verificados y contratos del simulador.
- `docs/decisiones.md`: decisiones con alternativa descartada y motivo.
- `docs/estado.md`: estado actual, pruebas ejecutadas, riesgos y siguiente paso. Leerlo al empezar cada sesión y actualizarlo al terminar.
- `docs/arquitectura.md`, `docs/mapeo-datos.md`, `docs/guion-demo.md`, `docs/resultados-pruebas.md`, `docs/uso-ia.md`.

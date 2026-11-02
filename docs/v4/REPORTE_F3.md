# Reporte F3 — Importador manual

> Claude Code, 2026-11-02, rama `v4`. Modo nocturno: el reporte reemplaza la espera de revisión.

## Qué cambió

**Nuevo (apps/puente):**
- `src/entradas/importador/{sugerencias,csv,servicio,http}.ts`: lectura del texto del PDF con **unpdf 1.9.0** (D-62), sugerencia de correo y teléfono por expresiones regulares (sin IA), nombre desde el CSV o el nombre del archivo, CSV opcional (D-63), lote temporal y confirmación (D-64).
- Ruta `POST /api/importador/lotes` (con verificación de sesión) y páginas **Importar** (`/importar`) y **Revisar** (`/importar/<lote>`); enlace «Importar» en el menú.
- Migración `prisma/migrations/20261103000000_v4_f3_importador` (tablas `LoteImportacion` y `ArchivoImportacion`; reversión en el SQL). Fuente del sistema `importador` en la siembra.
- Pruebas: `tests/importador.test.ts` (13, con PDF ficticios generados con pdf-lib) y `e2e/importador.spec.ts` (4).
- Manual: `docs/manuales/importador.md` con capturas de la versión local (`docs/manuales/img/importador-*.png`, datos ficticios).

**Modificado:** `next.config.ts` (`unpdf` en `serverExternalPackages`), `src/worker/ciclo.ts` (el ciclo de retención también borra los lotes sin confirmar a las 24 h), `prisma/datos-demo.ts`, `apps/puente/package.json` (`unpdf` 1.9.0 y `pdf-lib` 1.17.1 de desarrollo, versiones exactas).

No se creó otro camino hacia el ATS: cada fila confirmada entra por `registrarRecepcion()`.

## Criterios

| # | Criterio | Resultado | Prueba |
|---|---|---|---|
| I-1 | Tres PDF con correo en el texto llegan a Postulantes del proceso elegido en Talentia | ✓ | `tests/importador.test.ts` «I-1»; `e2e/importador.spec.ts` «I-7» (con el SHA-256 del CV descargado) |
| I-2 | Importar el mismo PDF otra vez en el mismo proceso da DUPLICADA | ✓ | «I-2» (Vitest y E2E) |
| I-3 | Un PDF sin texto queda en REQUIERE_REVISION | ✓ | «I-3» |
| I-4 | El CSV completa los nombres y gana sobre lo sugerido | ✓ | «I-4» |
| I-5 | Un archivo que no es PDF o de más de 5 MB se rechaza con un mensaje claro | ✓ | «I-5» (Vitest y E2E) |
| I-6 | Solo usuarios con sesión pueden importar | ✓ | «I-6» (Vitest: 401 sin sesión; E2E: redirección a ingresar y 401 en la API) |
| I-7 | E2E con Playwright del recorrido completo | ✓ | `e2e/importador.spec.ts` |
| I-8 | Regresión completa en verde | ✓ | puerta de calidad abajo |

## Comprobar en local

1. `npm run dev` y `npm run demo:conectar`.
2. Puente → **Importar** → proceso `9003` → adjuntar 3 PDF ficticios (`fixtures/cv/cv-camila-ejemplo.pdf`, `cv-andres-prueba.pdf`, `cv-sofia-demo.pdf`) → **Leer y sugerir datos** → revisar → **Confirmar e importar**.
3. Talentia → proceso 9003 → **Postulantes**: las tres tarjetas con fuente «Importador manual del Puente».
4. Repetir con el mismo PDF y el mismo proceso: la fila dice «Duplicada (ya estaba)».

## Decisiones

D-62 (unpdf 1.9.0), D-63 (solo CSV), D-64 (lote temporal y confirmación).

## Pendientes

- **Hipótesis (§8.2):** que los PDF reales descargados de LinkedIn tengan texto legible; se verifica con la Puerta 0 (P0-3).
- El nombre sugerido desde el archivo es aproximado (`cv-andrea-lopez.pdf` → Andrea / Lopez, sin tildes): la persona lo corrige en la tabla.

## Puerta de calidad (2026-11-02)

| Comando | Resultado |
|---|---|
| `npm run lint` | 0 errores |
| `npm run typecheck` | 0 errores |
| `npm test` | Vínculo 26/26 · Talentia 30/30 · Puente **142/142** |
| `npm run test:e2e` (build + Playwright) | **45/45** (3,1 min) |

Total: **243 pruebas en verde** (198 Vitest + 45 Playwright). Durante la fase, G-7 falló una vez porque la tarea de retención sumaba los lotes de importación borrados; se separó en el ciclo del worker y la aserción no cambió.

# Reporte F1 — Contrato canónico, servicio de recepción y ConectorATS

> Claude Code, 2026-11-02, rama `v4`. Modo nocturno: el reporte reemplaza la espera de revisión.

## Qué cambió

**Nuevo (apps/puente):**
- `src/nucleo/contrato/canonica.ts`: `PostulacionCanonica v1` (Zod), entrada sin `fuente`, normalización de correo, teléfono (E.164, +57 por defecto) y nombres.
- `src/nucleo/recepcion/registrar.ts`: `registrarRecepcion(canonica, cv, actor)`, única puerta de entrada al núcleo (valida, deduplica por `UNIQUE(fuente, idExterno)`, resuelve el proceso, verifica el PDF si llega en bytes, guarda y encola).
- `src/nucleo/{errores,estados,fuentes}.ts`: error de procesamiento, estado V4 derivado (D-52) y etiqueta visible de cada fuente.
- `src/salidas/conector-ats.ts` (interfaz y `ErrorConectorATS`), `src/salidas/talentia/` (traslado del cliente de la v2), `src/salidas/buk/` (esqueleto deshabilitado, sin rutas de BUK), `src/salidas/index.ts` (`ATS_DESTINO`, `estadoDestino`, `conectorATS`).
- `src/entradas/apply-connect/{mapeo,cv}.ts` (entrega → canónica; descarga del CV por mediaUrl) y `src/entradas/index.ts`.
- Migración `prisma/migrations/20261102120000_v4_f1_fuente` (columnas `fuente`, `idExterno`, `vacanteExterna`, `advertencia`; relleno de los existentes como `apply-connect`; reversión documentada en el SQL).
- Pruebas: `tests/canonica.test.ts` (17), `tests/conector-ats.test.ts` (11), `tests/nucleo-salidas.test.ts` (9).

**Modificado:** `src/modules/webhook.ts` (mapea y llama a `registrarRecepcion`), `src/modules/procesador.ts` (usa `ConectorATS`; CV por el adaptador de la fuente; omite el documento si el ATS no lo admite), `src/modules/{operaciones,prueba-conexion,publicacion}.ts`, `src/app/(app)/{procesos,correspondencias}/page.tsx`, `src/app/api/salud/route.ts`, `src/worker/ciclo.ts` (no arranca el procesador sin ATS implementado; esperas interrumpibles), `prisma/schema.prisma`, `tests/dobles.ts` (filtro `proceso_id`, que la API real de Talentia ya tiene), `eslint.config.mjs` (regla F1-6). **Eliminado:** `src/modules/ats-cliente.ts`. `apps/talentia` y `apps/vinculo` no se tocaron.

## Criterios

| # | Criterio | Resultado | Prueba |
|---|---|---|---|
| F1-1 | Todas las pruebas anteriores pasan sin cambiar sus aserciones | ✓ 73/73 del Puente sin cambios en aserciones (solo se agregó el filtro `proceso_id` al doble) | `npm test -w apps/puente` |
| F1-2 | Contrato: válidos, inválidos y normalización | ✓ | `tests/canonica.test.ts` |
| F1-3 | Contrato de ConectorATS contra Talentia | ✓ | `tests/conector-ats.test.ts` |
| F1-4 | Con `ATS_DESTINO=buk` el procesador no arranca y `/api/salud` dice «ATS buk no implementado» | ✓ | `tests/nucleo-salidas.test.ts` |
| F1-5 | Una postulación de Vínculo sigue llegando a Postulantes de Talentia | ✓ E2E 37/37 | `e2e/recorrido.spec.ts`, `e2e/tres-sistemas.spec.ts` |
| F1-6 | Nadie fuera de `salidas/` importa el cliente de Talentia | ✓ regla de lint + prueba | `eslint.config.mjs`, `tests/nucleo-salidas.test.ts` |

## Comprobar

```powershell
git switch v4
npm run db:migrate
npm run lint; npm run typecheck; npm test; npm run test:e2e
```

## Decisiones

D-52 (estados V4 derivados), D-53 (ubicación de la estructura), D-54 (`extra` opcional en ConectorATS), D-55 (`ATS_DESTINO` y salud), D-56 (teléfono E.164 en todas las fuentes).

## Pendientes

Ninguno bloqueante. `procesoAtsId` sigue siendo entero (Talentia usa ids numéricos); un ATS con ids de texto necesitará otra columna (deuda registrada en el informe final).

## Puerta de calidad (2026-11-02)

| Comando | Resultado |
|---|---|
| `npm run lint` | 0 errores (incluye la regla nueva `no-restricted-imports`) |
| `npm run typecheck` | 0 errores |
| `npm test` | Vínculo 26/26 · Talentia 30/30 · Puente **110/110** (73 anteriores + 37 nuevas) = 166 pruebas Vitest |
| `npm run test:e2e` (build + Playwright) | **37/37** (3,0 min) |

Total: **203 pruebas en verde** (166 anteriores + 37 nuevas).

# Reporte F2 — Entrada genérica, fuentes, revisión, auditoría y retención

> Claude Code, 2026-11-02, rama `v4`. Modo nocturno: el reporte reemplaza la espera de revisión.

## Qué cambió

**Nuevo (apps/puente):**
- Migración `prisma/migrations/20261102180000_v4_f2_entrada_generica`: estado `REQUIERE_REVISION` (+ `motivoRevision`), `correo`/`mediaUrl`/`mediaUrn` opcionales, `cvBorradoEn`, `datosBorradosEn`, modelos `Fuente` y `EventoAuditoria`, correspondencias genéricas (`fuente`, `vacanteExterna`; las existentes pasan a `apply-connect`) y la fuente del sistema `apply-connect`. Reversión en el SQL.
- `src/entradas/generica/{fuentes,limite,servicio}.ts` y rutas `src/app/api/entradas/v1/{postulaciones,vacantes}/route.ts`.
- `src/nucleo/auditoria.ts` (eventos con actor, sin datos personales; logs con `idRecepcion`), `src/modules/revision.ts` (completar, aprobar, descartar, borrar datos del candidato), `src/modules/retencion.ts` (ciclo «retencion» del worker).
- Pantalla **Fuentes** (`src/app/(app)/fuentes/`, solo ADMIN): crear fuente, generar/rotar el token (se ve una vez), revocar, último uso.
- Pruebas: `tests/entrada-generica.test.ts` (19) y `e2e/entrada-generica.spec.ts` (4).

**Modificado:** `registrarRecepcion` (revisión y posible duplicado, proceso elegido por una persona, auditoría), `src/modules/destino.ts` (correspondencias por fuente), `procesador.ts` (5 intentos, auditoría de cada cambio de estado, logs enmascarados), `operaciones.ts` (actor en reintentar/reconciliar, métricas por fuente), `webhook.ts` (revisión = 200 a Vínculo), páginas Operaciones (filtro y columna de fuente), detalle de operación (revisión, borrar datos, estado V4, auditoría), Correspondencias (fuente), Métricas (por fuente), menú (Fuentes para ADMIN), `prisma/datos-demo.ts`, `src/lib/privacidad.ts`, estilos.

## Criterios

| # | Criterio | Resultado | Prueba |
|---|---|---|---|
| G-1 | Válida con token → 202 RECIBIDA y llega a Talentia | ✓ | `tests/entrada-generica.test.ts` «G-1», `e2e/entrada-generica.spec.ts` |
| G-2 | Repetirla → 200 DUPLICADA, no crea nada | ✓ | «G-2», E2E paso 4 |
| G-3 | Sin correo o sin CV → 202 REQUIERE_REVISION; no llega al ATS hasta aprobarla | ✓ | «G-3» (correo, CV, datos sin confirmar, descartar), E2E paso 4 |
| G-4 | 401 token inválido/revocado · 422 sin correspondencia · 415 no PDF · 413 > 5 MB · 429 > 60/min | ✓ | «G-4» |
| G-5 | Mismo correo por dos fuentes en la misma vacante → posible duplicado | ✓ | «G-5» (Apply Connect + bot al proceso 9001) |
| G-6 | Cinco fallos temporales → FALLIDA_DEFINITIVA; «reintentar» la recupera | ✓ | «G-6» |
| G-7 | La retención borra el binario y conserva el hash (reloj simulado) | ✓ | «G-7» (+ borrar datos del candidato) |
| G-8 | Cada acción manual deja un evento con actor | ✓ | «G-8» |
| G-9 | Los logs no contienen el correo ni el nombre de prueba | ✓ | «G-9» |
| G-10 | Regresión completa en verde | ✓ | puerta de calidad abajo |

## Probar la entrada genérica en local (PowerShell)

1. `npm run dev` y, en otra terminal, `npm run demo:conectar`.
2. Puente (`http://localhost:3003`, `admin@puente.demo.test` / `Demo2026!`) → **Fuentes** → crear `linkedin-bot` → **Generar token** → copiarlo.
3. **Correspondencias** → Fuente `linkedin-bot`, código `VAC-1`, proceso `9001` → Guardar.
4. En PowerShell, desde la carpeta del proyecto:

```powershell
$env:TOKEN = "pf_…"   # el token copiado
'{"version":"1","idExterno":"prueba-1","vacanteExterna":"VAC-1","candidato":{"nombres":"Ana","apellidos":"Ejemplo Ficticia","correo":"ana.ejemplo@demo.test","telefono":"300 123 4567"}}' | Set-Content -Encoding utf8NoBOM datos.json
curl.exe -s -X POST http://localhost:3003/api/entradas/v1/postulaciones -H "Authorization: Bearer $env:TOKEN" -F "datos=<datos.json" -F "cv=@fixtures/cv/cv-camila-ejemplo.pdf;type=application/pdf"
```

Respuesta: `{"estado":"RECIBIDA","idRecepcion":"…"}` (202). Repetir el mismo comando: `{"estado":"DUPLICADA",…}` (200). Sin el campo `correo`: `{"estado":"REQUIERE_REVISION","motivos":["sin_correo"]}`. En **Operaciones** se ve con la fuente `linkedin-bot`; en Talentia → proceso 9001 → Postulantes aparece la tarjeta. `curl.exe -s http://localhost:3003/api/entradas/v1/vacantes -H "Authorization: Bearer $env:TOKEN"` lista las vacantes de la fuente.

## Decisiones

D-57 (5 intentos), D-58 (CV y retención), D-59 (tokens y límite en memoria), D-60 (correspondencias genéricas), D-61 (revisión y posible duplicado). Contrato: `docs/contratos.md` §8 y §9.

## Pendientes

- El límite de 60/min es por proceso (una instancia en Render gratuito).
- El posible duplicado compara contra recepciones ya asociadas a un proceso: dos llegadas casi simultáneas de fuentes distintas antes de procesarse no se marcan (riesgo bajo; la deduplicación del ATS por correo evita el postulante repetido).

## Puerta de calidad (2026-11-02)

| Comando | Resultado |
|---|---|
| `npm run lint` | 0 errores |
| `npm run typecheck` | 0 errores |
| `npm test` | Vínculo 26/26 · Talentia 30/30 · Puente **129/129** |
| `npm run test:e2e` (build + Playwright) | **41/41** (1.ª ejecución 36/40: tres acciones del detalle fallaban porque las acciones de servidor capturaban funciones locales y una etiqueta ambigua en la prueba nueva; corregido y repetido) |

Total: **226 pruebas en verde** (185 Vitest + 41 Playwright).

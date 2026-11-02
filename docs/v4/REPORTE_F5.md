# Reporte F5 — Documentación y preparación del despliegue (sin desplegar)

> Claude Code, 2026-11-02, rama `v4`. Esta noche F5 es solo documentación y preparación (PROMPT_NOCHE_V4.md, punto e): **no** se hizo merge a la rama del Blueprint (`v2`), **no** se aplicaron migraciones en Render y **no** se desplegó. No hubo resultados del equipo que reproducir (importador en local y bot: pendientes).

## Qué cambió

- `README.md`: arquitectura V4 (el Puente como producto, entradas y salida), cómo probar cada entrada, cuentas y problemas frecuentes nuevos.
- `docs/arquitectura.md`: «V4 · Capas» (Mermaid de capas y de estados V4, tabla de responsabilidades).
- `docs/contratos.md`: §8 entrada genérica y §9 ConectorATS (escritos en F2).
- `docs/seguridad.md`: «V4 · Fuentes, revisión, auditoría y retención» y obligaciones pendientes de la empresa (sin afirmar cumplimiento).
- `docs/guion-demo.md`: guion V4 de unos 5 minutos (§15.3) y plan B.
- `docs/resultados-pruebas.md`: resultados reales por fase (166 → 243).
- `docs/uso-ia.md`: uso de IA en la V4 y lista de revisión del equipo.
- `docs/despliegue.md`: «V4 · Cómo desplegar (preparado, NO ejecutado)» con los comandos exactos.
- `render.yaml` (Puente: `ATS_DESTINO`, `RETENCION_CV_DIAS`, `PUENTE_MAX_INTENTOS`; `render blueprints validate` → `valid: true`) y `apps/puente/.env.example`.
- `docs/decisiones.md` (D-52 a D-64) y `docs/estado.md` ya estaban al día por fase.

## Revisión de honestidad (punto 4 del PROMPT F5)

`grep` de afirmaciones de conexión real con LinkedIn o BUK en el código del Puente, los reportes, el manual del importador y el README: ninguna. Talentia y Vínculo se nombran como simulados; el adaptador de BUK aparece siempre como deshabilitado; todas las pantallas muestran «Entorno de simulación».

## Comandos de despliegue y verificación (para cuando el equipo apruebe)

Ver `docs/despliegue.md`, sección «V4 · Cómo desplegar». En resumen: revisión local → `git switch v2; git merge --ff-only v4; git push origin v2` (o cambiar la rama del Blueprint a `v4`) → las migraciones las aplica el `startCommand` → verificar `/api/salud` de los tres y una importación con un PDF ficticio.

## Qué está desplegado, qué es simulado, qué es experimental y qué falta para BUK real

| | Estado |
|---|---|
| Desplegado en Render | La **v2** (rama `v2`, commit `f1b7c4c`). La V4 está lista en la rama `v4`, sin desplegar |
| Simulado | Talentia (ATS tipo BUK) y Vínculo (red tipo LinkedIn con Apply Connect) |
| Experimental | El bot de LinkedIn: **no construido** (Puerta 0 pendiente) |
| Falta para BUK real | La exportación de `/apidocs` y una API Key de pruebas de la empresa; escribir `src/salidas/buk` contra esa documentación; pasar `tests/conector-ats.test.ts`; cambiar `ATS_DESTINO=buk` |

## Puerta de calidad

Sin cambios de código de aplicación desde F3: lint 0, typecheck 0; la última ejecución completa es la de F3 (Vitest 198 y Playwright 45, **243** en verde).

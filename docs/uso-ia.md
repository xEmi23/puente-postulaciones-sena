# Uso de inteligencia artificial generativa

> Creado por Claude Code (2026-10-25). La ficha (rúbrica, rigor metodológico) pide declarar el uso de IA generativa y la trazabilidad de las decisiones.

## Herramienta

- **Claude Code** (modelo Claude Opus 5.5, de Anthropic) en modo autónomo, en la máquina del equipo, el 25/10/2026, siguiendo los prompts P1, P2, P3 y P5 de `PROMPTS_CLAUDE_CODE.md`.
- No se cargó información confidencial: la ficha se leyó en local; no hay credenciales reales ni datos de personas reales.

## Qué hizo la IA

| Área | Trabajo de la IA | Evidencia |
|---|---|---|
| Investigación | Consultó y resumió 7 fuentes (Microsoft Learn/LinkedIn, términos de la API, centro de ayuda de BUK) con fecha y versión; detectó la discrepancia de firma y propuso la decisión | `docs/contratos.md` |
| Decisiones | Registró D-01 a D-14 con alternativa descartada y motivo | `docs/decisiones.md` |
| Código | Escribió el origen, el puente, el ATS simulado, el worker, el panel, los scripts y el esquema de datos | historial de git (`fase P1…`, `fase P2…`, …) |
| Pruebas | Escribió las pruebas de Vitest (PostgreSQL real) y Playwright (8 criterios, accesibilidad, móvil), las ejecutó y corrigió los fallos | `tests/`, `e2e/`, `docs/resultados-pruebas.md` |
| Documentación | README, arquitectura, mapeo, guion, estado | `docs/` |

Errores que la IA cometió y corrigió con evidencia de las pruebas: fechas desplazadas 5 h por zona horaria (D-10), timeout no probado por un doble de pruebas incompleto, contraste insuficiente detectado por axe y procesos de E2E que morían al cambiar de proyecto. Todo está registrado en `docs/estado.md`.

## Qué debe revisar el equipo (PENDIENTE)

La IA no puede sustituir estas revisiones. Marquen cada una con nombre y fecha cuando la hagan:

- [ ] **D-01**: confirmar con la empresa y el mentor que simular ambos extremos es aceptable.
- [ ] **Etapas del ATS** (D-11): reemplazar el supuesto por `docs/referencia-ats.md`.
- [ ] **Contratos**: releer `docs/contratos.md` contra las fuentes (la IA resume; puede equivocarse).
- [ ] **Firma** (D-04): validar la elección entre F1 y F2.
- [ ] **Seguridad**: revisar `src/lib/firma.ts`, `src/lib/sesion.ts`, `descargarCv` y la protección por host local (D-12).
- [ ] **Demo**: ensayar el guion completo a mano en el equipo que se usará el 29/10.
- [ ] **Textos**: revisar redacción y tono de la interfaz.
- [ ] **Datos**: confirmar que ningún nombre ficticio coincide con alguien real del entorno.

## Cómo se usó (método)

1. Prompts por fase con criterios verificables (P1, P2, P3, P5).
2. Puerta de calidad en cada fase: typecheck, lint, pruebas y build; no se avanza con fallos y no se debilitan pruebas.
3. Commit por fase y estado en `docs/estado.md` para retomar.

---

## v2 (28 y 29/10/2026)

> Actualizado por Claude Code (2026-10-29).

- **Herramienta:** Claude Code (Claude Opus 5.5) en modo autónomo, siguiendo el «PROMPT PRINCIPAL» de `PROMPT_V2.md` sobre `docs/v2/SOLUCION.md` y `docs/v2/ESPECIFICACION.md` (documentos del equipo, que la IA no reescribió).
- **Qué hizo:** separó la v1 en tres apps independientes (F0), construyó Talentia (F1), Vínculo (F2) y el puente con conexiones configurables (F3), pulió datos y pantallas revisando capturas (F4) y escribió esta documentación (F5). Registró D-20 a D-49 en `docs/decisiones.md` y el estado de cada fase, con comandos y resultados reales, en `docs/estado.md`.
- **Investigación:** buscó en el centro de ayuda público de BUK el encabezado de la API Key; encontró los permisos y recursos de Selección pero no el nombre del encabezado, así que usó `auth_token` y lo dejó como **Supuesto pendiente** (D-26).
- **Errores que cometió y corrigió con evidencia de las pruebas (v2):** el puente no renovaba el token de Vínculo al descargar el CV tras regenerar el secreto (lo encontró una prueba nueva, D-45); una redirección hecha en pleno *streaming* rompía las auditorías E2E; un fallo simulado que quedaba activo contaminaba otras pruebas; desbordes en móvil del tablero de Talentia; contraste de Swagger UI. Detalle en `docs/estado.md`.

### Qué debe revisar el equipo en la v2 (PENDIENTE)

- [ ] **D-26:** confirmar con la empresa el encabezado real de la API Key en el `/apidocs` de su cuenta de BUK.
- [ ] **Contratos v2:** releer `docs/contratos.md` §5–§7; en especial qué es **Verificado** y qué es **contrato del simulador**.
- [ ] **Seguridad:** `docs/seguridad.md`, la sección de datos personales (Ley 1581) es un supuesto que requiere revisión.
- [ ] **Nombres generados** (D-39) y **capturas** de `capturas/` (`CAPTURAS=1 npx playwright test e2e/capturas.spec.ts`).
- [ ] **Demo:** ensayar el guion v2 (`docs/guion-demo.md`) en local y en Render, despertando los servicios antes.
- [ ] **Manuales:** `docs/manuales/` contra las pantallas reales.

---

## V4 (02/11/2026, noche)

> Actualizado por Claude Code (2026-11-02).

- **Herramienta:** Claude Code (Claude Opus 5.5), modo autónomo nocturno (`PROMPT_NOCHE_V4.md`), fases F0, F1, F2, F3 y F5 (solo documentación) de `PROMPTS_V4.md` sobre `docs/v4/ESPECIFICACION_V4.md` (documento del equipo, no se reescribió).
- **Qué hizo:** auditoría del código (`docs/v4/INFORME_F0.md`), contrato canónico, servicio de recepción único, `ConectorATS` con Talentia y BUK deshabilitado, entrada genérica con tokens, revisión humana, auditoría, retención, importador manual con lectura de PDF sin IA, pruebas (77 nuevas) y documentación. Decisiones D-52 a D-64.
- **Qué NO hizo:** no construyó el bot (Puerta 0 pendiente), no abrió LinkedIn, no escribió rutas de BUK, no desplegó ni hizo merge a la rama de Render.
- **Errores que cometió y corrigió con las pruebas:** una migración que obligaba a cambiar pruebas existentes (se rehízo sin cambiar la clave única), acciones de servidor que capturaban funciones locales (fallaban en el navegador), una prueba nueva con un fallo temporal que en realidad era ambiguo («requiere verificación»), la retención que sumaba lotes de importación.

### Qué debe revisar el equipo en la V4 (PENDIENTE)

- [ ] Las decisiones D-52 (estados V4 derivados), D-57 (5 intentos), D-58 (CV y retención) y D-61 (posible duplicado por proceso).
- [ ] Probar el importador con CV reales descargados en la Puerta 0 (¿tienen texto legible?).
- [ ] Revisar los textos de las pantallas nuevas (Importar, Fuentes, revisión) y `docs/manuales/importador.md`.

---

## Entrega final (11/11/2026)

> Actualizado por Claude Code (2026-11-11). Versión para evaluadores, con prompts por fase y lo que decidió el equipo: [docs/entrega/08_uso_de_ia.md](entrega/08_uso_de_ia.md).

- **Herramienta:** Claude Code (modelo Claude Opus), modo autónomo, prompt «ENTREGA FINAL» del equipo.
- **Qué hizo:** recuperó el repositorio local (el `.git` apuntaba a un worktree que ya no existía) clonando el remoto privado, corrió dos veces la puerta de calidad completa, probó el flujo final, la entrada JSON (cada código de respuesta), el importador y Render; escribió y ejecutó `scripts/medir-criterios.mjs` (criterios de éxito), `scripts/probar-ejemplos.mjs` (ejemplos de Postman) y `scripts/capturas-entrega.mjs`; redactó `docs/entrega/` y revisó que nada sensible se publicara.
- **Qué NO hizo:** no tocó la rama `v4` ni Render (salvo leer `/api/salud` y la prueba de humo del formulario), no abrió LinkedIn real, no cambió el código del producto salvo defectos reales (ver [docs/estado.md](estado.md)).
- **Qué debe revisar el equipo:** [docs/entrega/EVIDENCIA_PENDIENTE.md](entrega/EVIDENCIA_PENDIENTE.md).

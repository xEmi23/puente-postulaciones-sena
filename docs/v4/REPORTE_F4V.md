# Reporte V4 F4-V · Bot con perfil Vínculo

> Actualizado por Claude Code (2026-11-03). Prompt: `PROMPT_BOT_VINCULO.md` más el ajuste «Vínculo sin API». Rama `v4`. Sin despliegue y sin abrir LinkedIn real.

## Qué se construyó

- **`apps/bot-linkedin`** (cuarto workspace, experimental), organizado por **perfiles de sitio** (D-65):
  - **Común:** navegación con el contexto persistente de Playwright, guardias, mapeo a `PostulacionCanonica v1`, envío a la entrada genérica con reintentos (2, 4, 8, 16, 30, 30, 30 s y `Retry-After` en 429), pausas con reloj inyectable y la línea `RESUMEN {json}`.
  - **Perfil `vinculo`** completo: 800–1500 ms y horario libre, como pide D-66.
  - **Perfil `linkedin`:** esqueleto con selectores vacíos («pendiente de la Puerta 0») que se niega a correr.
  - **Variables y comandos:** `BOT_SITIO`, `BOT_URL_SITIO`, `bot:login`, `bot`, `-- --vacante <id>` y `-- --seco`. Ventana visible por defecto, máximo 25 por ejecución y sin modo programado.
- **Guardias:**
  - pantalla de ingreso: `sesion_cerrada`;
  - verificación o captcha: `verificacion`;
  - página del panel incompleta: `pagina_inesperada` (D-70).
  - En los tres casos el bot se detiene con «Se requiere intervención humana» (código de salida 3).
  - El bot espera a que la red quede quieta antes de leer la página: Vínculo envía las páginas en streaming y, con la sesión vencida, redirige al ingreso desde el cliente.
- **Vínculo:**
  - ficha del postulante en el panel del reclutador (`/reclutador/postulaciones/<id>`, con `data-campo`) y enlace «Ver ficha»;
  - **`VINCULO_API_HABILITADA`** (D-68), apagada por defecto. Así no hay portal de desarrolladores ni Integraciones, y OAuth, `/api/v1` y OpenAPI responden 404. Tampoco se generan ni se envían webhooks. Prendida, todo funciona como antes.
- **Scripts:**
  - `npm run demo:bot` crea:
    - la vacante VIN-DEMO-BOT con 3 postulaciones ficticias y su CV;
    - la fuente «vinculo-bot» con su token (se muestra una vez y queda en `apps/bot-linkedin/.env`);
    - la correspondencia → 9005;
    - la API Key de Talentia y la conexión del Puente **solo** con Talentia.
    - Además deja la API de Vínculo apagada.
  - `npm run vinculo:api -- on|off|estado` prende, apaga o consulta la API de Vínculo.
  - `demo:conectar` explica qué hacer si la API está apagada.
  - `db:migrate`, `db:seed` y `demo:reset` usan `--if-present` (D-69).
- **El adaptador Apply Connect del Puente no cambió.**

## Criterios

| Criterio | Resultado | Dónde |
|---|---|---|
| BV-1 extracción sobre el HTML de Vínculo | ✔ | `apps/bot-linkedin/tests/bot.test.ts` (páginas reales del panel, guardadas en local con datos ficticios) |
| BV-2 guardias ante ingreso y verificación | ✔ (más «panel incompleto») | `bot.test.ts` |
| BV-3 E2E: el bot llega a Postulantes de Talentia con el mismo SHA-256 | ✔ | `e2e/bot.spec.ts` |
| BV-4 segunda corrida = DUPLICADA | ✔ | `e2e/bot.spec.ts` |
| BV-5 `--seco` no envía | ✔ | `bot.test.ts` y `e2e/bot.spec.ts` |
| BV-6 `BOT_SITIO=linkedin` se niega con «perfil LinkedIn pendiente de la Puerta 0» | ✔ | `bot.test.ts` y `e2e/bot.spec.ts` |
| BV-7 regresión completa en verde | ✔ (ver puerta de calidad) | — |
| API de Vínculo apagada: sin API ni webhooks | ✔ | `apps/vinculo/tests/api-apagada.test.ts` |

## Puerta de calidad (última ejecución)

- `npm run lint` 0 · `npm run typecheck` 0 (incluido el bot) · `tsc` de `e2e/` 0.
- Vitest: Vínculo 29 · Talentia 30 · Puente 142 · bot 16 (**217**).
- Playwright (`npm run test:e2e`, incluye `npm run build` de las tres apps): **50 pasaron**, 2 omitidas (`capturas.spec.ts`, solo con `CAPTURAS=1`). Incluye las 5 del bot.
- Total **267** (antes 243). Las pruebas existentes no se debilitaron: Vínculo y E2E prenden la API explícitamente; el doble de navegador de `bot.test.ts` suma el menú del panel que tiene toda página real.

## Ensayo en local (base de desarrollo, apps de `npm run dev`)

1. `npm run demo:reset`, luego `npm run demo:bot -- --reiniciar`, luego iniciar sesión en el perfil del bot.
2. Bot: «3 recibida(s)», las 3 en `COMPLETADO` y 3 postulantes en Talentia 9005.
3. Segunda corrida: «3 duplicada(s)», y Talentia sigue con 3.
4. Con la API apagada: `/developers` y `/reclutador/integraciones` dan 404, OAuth, `/api/v1` y OpenAPI también dan 404, y el menú no muestra «Desarrolladores».
5. Con la sesión vencida después de `demo:reset`, el bot se detuvo con «Se requiere intervención humana» (código 3).

## Riesgos y pendientes

- `npm audit`: 16 avisos moderados de `minimatch` en las herramientas de ESLint (solo desarrollo). No se forzó la corrección.
- `render.yaml` declara `VINCULO_API_HABILITADA="false"` (D-71, auditoría).
- En Talentia, la fuente del bot se ve como «Puente · fuente «vinculo-bot»». Si se quiere un texto propio, se agrega en `apps/puente/src/nucleo/fuentes.ts`.
- LinkedIn real sigue bloqueado por la Puerta 0 (`docs/manuales/bot.md`, «Qué falta»).

> Actualizado por Claude Code (2026-11-03): la auditoría final (`docs/v4/AUDITORIA_F4V.md`) corrigió cinco defectos y dejó la puerta en **284** pruebas (Vitest 231, Playwright 53), sin pruebas inestables.

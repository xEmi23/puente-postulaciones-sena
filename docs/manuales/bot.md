# Manual · Bot asistido del Puente (experimental)

> Actualizado por Claude Code (2026-11-02, V4 F4-V). El bot es un **adaptador experimental** del Puente (ESPECIFICACION_V4 §8.3). Hoy funciona **solo contra Vínculo**, la red profesional **simulada** del proyecto. El perfil de LinkedIn es un esqueleto que **se niega a correr** hasta que la Puerta 0 diga «Bot = sí» (`docs/v4/PUERTA0.md`). Todos los datos son ficticios (`@demo.test`).

## Qué hace

Una persona lo ejecuta (no hay modo programado), con la ventana del navegador visible. En cada corrida el bot:

1. pide al Puente las vacantes que la fuente «vinculo-bot» tiene vinculadas a un proceso del ATS;
2. abre en el sitio el panel del reclutador, entra a cada una de esas vacantes y a la ficha de cada postulante (con pausas);
3. descarga el CV (con la sesión que la persona inició a mano) y lo envía al Puente por la **entrada genérica** (`POST /api/entradas/v1/postulaciones`);
4. el Puente lo lleva a Talentia (ATS simulado), a la etapa Postulantes. Si ya se había enviado, el Puente responde «Duplicada» y no crea nada.

El bot no conoce el ATS, no guarda contraseñas y no tiene ninguna técnica de evasión.

## Salvaguardas (§8.3)

- **Sin contraseñas:** la sesión se inicia a mano con `bot:login` y queda en el perfil del navegador del bot (`apps/bot-linkedin/.bot-perfil-<sitio>/`, ignorado por git).
- **Guardias:** si una página pide iniciar sesión, muestra una verificación (captcha, «actividad inusual», etc.) o no tiene la estructura esperada, el bot se **detiene** con «Se requiere intervención humana» (código de salida 3). No intenta resolver nada.
- **Límites:** máximo 25 postulantes por ejecución; pausas aleatorias entre páginas (Vínculo 800–1500 ms; LinkedIn 3000–8000 ms) y horario (LinkedIn 07–19).
- **Solo vacantes vinculadas:** si el Puente no tiene correspondencia para la vacante, el bot no la abre.
- **`--seco`:** recorre y muestra lo que enviaría, sin enviar nada.

## Usarlo contra Vínculo en Windows (PowerShell)

Requisitos: haber ejecutado `npm install` y `npm run setup` una vez, y tener Chromium de Playwright (`npx playwright install chromium`).

```powershell
cd "$HOME\Desktop\talent-bridge-v2"
npm run pg:start
npm run dev                      # deja esta ventana abierta (Vínculo 3001, Talentia 3002, Puente 3003)
```

En otra ventana de PowerShell:

```powershell
cd "$HOME\Desktop\talent-bridge-v2"
npm run demo:reset               # opcional: deja la demo como nueva (después hay que repetir bot:login)
npm run demo:bot -- --reiniciar  # vacante VIN-DEMO-BOT con 3 postulaciones, fuente «vinculo-bot», token y conexión con Talentia
npm run bot:login -w apps/bot-linkedin
```

Se abre una ventana: inicia sesión **a mano** como `reclutadora@andina.demo.test` / `Demo2026!` y, cuando veas el panel del reclutador, **cierra la ventana**. Luego:

```powershell
npm run bot -w apps/bot-linkedin                          # recorre y envía
npm run bot -w apps/bot-linkedin -- --seco                # solo muestra lo que enviaría
npm run bot -w apps/bot-linkedin -- --vacante VIN-DEMO-BOT
```

Al terminar imprime, por ejemplo: `Listo: 3 vista(s), 3 enviada(s) → 3 recibida(s), 0 duplicada(s)…`. En Talentia (reclutador, proceso 9005) aparecen los 3 postulantes con su CV. Una segunda corrida da `3 duplicada(s)`.

`npm run demo:bot -- --reiniciar` borra las postulaciones de VIN-DEMO-BOT en Vínculo y vuelve a crear las 3 (para repetir la demo; en el Puente seguirán como duplicadas a menos que también se reinicie con `npm run demo:reset`).

### Variables (`apps/bot-linkedin/.env`, lo escribe `demo:bot`)

| Variable | Por defecto | Para qué |
|---|---|---|
| `BOT_SITIO` | `vinculo` | Perfil de sitio: `vinculo` (simulado) o `linkedin` (se niega a correr). |
| `BOT_URL_SITIO` | `http://localhost:3001` | Dirección del sitio. |
| `PUENTE_URL` / `PUENTE_BOT_TOKEN` | — | Entrada genérica del Puente y token de la fuente (Puente → Fuentes; se ve una vez). |
| `BOT_MAX_POR_EJECUCION` | `25` | Tope por corrida (nunca más de 25). |
| `BOT_PAUSA_MIN_MS` / `BOT_PAUSA_MAX_MS` | del perfil | Pausas entre páginas. |
| `BOT_HORARIO` | del perfil | Por ejemplo `07-19`. |
| `BOT_HEADLESS` | `false` | Ventana visible. `true` solo en pruebas automáticas contra Vínculo. |

### Si algo falla

| Mensaje | Qué hacer |
|---|---|
| «Se requiere intervención humana: … pantalla de ingreso» o «… panel del reclutador completo» | La sesión venció (siempre pasa después de `npm run demo:reset`, que vuelve a crear las cuentas): `npm run bot:login -w apps/bot-linkedin` y vuelve a correr. |
| «Falta PUENTE_BOT_TOKEN» | Ejecuta `npm run demo:bot`. |
| «El Puente rechazó el token de la fuente (401)» | El token fue rotado: `npm run demo:bot` genera uno nuevo. |
| «El Puente no tiene vacantes vinculadas a esta fuente» | Falta la correspondencia en el Puente (la crea `demo:bot`, o Puente → Correspondencias con la fuente «vinculo-bot»). |
| Los postulantes no llegan a Talentia | Revisa Puente → Conexiones (Talentia) y Operaciones. |

## La API de Vínculo y el bot

Para la empresa, el LinkedIn real **no tiene API**. Por eso Vínculo arranca sin su API tipo Apply Connect (`VINCULO_API_HABILITADA=false`, D-68): sin portal de desarrolladores, sin OAuth ni `/api/v1` (404) y sin webhooks. `demo:bot` la deja apagada, y en la demo los candidatos solo llegan al ATS por el bot o por el importador. Para mostrar Apply Connect como «vía oficial futura»: `npm run vinculo:api -- on`, reiniciar las apps y `npm run demo:conectar`. Para apagarla otra vez: `npm run vinculo:api -- off` y reiniciar.

## Qué falta para usarlo con LinkedIn real

Nada de esto se hace mientras la Puerta 0 no diga «Bot = sí». Claude Code no abre LinkedIn real.

1. **Puerta 0** (`docs/v4/PUERTA0.md`): revisión de los términos de uso y visto bueno escrito del equipo y de la empresa; cuenta de reclutador propia de la empresa.
2. **Páginas de referencia anonimizadas:** guardar a mano (en `apps/bot-linkedin/fixtures/linkedin/originales/`, carpeta ignorada por git: nunca se versiona) las páginas de la lista de vacantes, la lista de postulantes y la ficha; anonimizarlas y copiarlas a `apps/bot-linkedin/fixtures/linkedin/anonimizadas/`.
3. **Selectores:** completar `SELECTORES_LINKEDIN` en `apps/bot-linkedin/src/sitios/linkedin/index.ts` (hoy vacíos y marcados «pendiente de la Puerta 0») y las funciones de extracción y de bloqueo, con pruebas sobre esas páginas anonimizadas.
4. **Prueba controlada:** con `--seco` y una sola vacante, pausas de 3–8 s, horario 07–19 y máximo 25 por ejecución.
5. Si LinkedIn muestra una verificación, el bot se detiene: no se agregan evasiones de ningún tipo.

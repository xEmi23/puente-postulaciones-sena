# Manual · Bot asistido del Puente (experimental)

> Actualizado por Claude Code (2026-11-02, V4 F4-V). El bot es un **adaptador experimental** del Puente (ESPECIFICACION_V4 §8.3). Hoy funciona **solo contra Vínculo**, la red profesional **simulada** del proyecto. El perfil de LinkedIn es un esqueleto que **se niega a correr** hasta que la Puerta 0 diga «Bot = sí» (`docs/v4/PUERTA0.md`). Todos los datos son ficticios (`@demo.test`).

> Actualizado por Claude Code (2026-11-03, D-74). En pantalla, Vínculo se ve como **«Simulador LinkedIn»** y Talentia como **«Simulador BUK»**; en el Puente la fuente del bot aparece como **«LinkedIn (bot, simulador)»** (su identificador sigue siendo `vinculo-bot`, el que usan `.env`, comandos y filtros por URL). Los mensajes del bot dicen «El Simulador LinkedIn muestra…». Este manual usa los nombres internos para carpetas y comandos.

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

`npm run demo:bot -- --reiniciar` borra las postulaciones de VIN-DEMO-BOT en Vínculo y vuelve a crear las 3. Son postulaciones nuevas (el Puente las recibe), pero si no hiciste antes `npm run demo:reset`, esas personas ya están en Talentia y no se ven llegar. Para repetir la demo desde cero: `npm run demo:reset`, `npm run demo:bot -- --reiniciar` y otra vez `bot:login`. Sin `--reiniciar`, el bot da «duplicada».

Las opciones funcionan igual en PowerShell, cmd y bash. En PowerShell, npm se queda con `--seco` y `--vacante`, y el bot las lee igual (D-72). Al empezar, el bot confirma «Modo seco: … NO envía nada» o «Solo la vacante «…»».

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
| «Se requiere intervención humana: … pantalla de ingreso» o «… panel del reclutador completo» | La sesión venció (siempre pasa después de `npm run demo:reset`, que vuelve a crear las cuentas) o hay otra ventana del bot abierta: ciérrala, `npm run bot:login -w apps/bot-linkedin` y vuelve a correr. |
| «El Simulador LinkedIn muestra «Algo salió mal»» | Error del sitio: mira la ventana de `npm run dev`. Si es la base de datos, `npm run pg:start`. |
| «Falta PUENTE_BOT_TOKEN» | Ejecuta `npm run demo:bot`. |
| «El Puente rechazó el token de la fuente (401)» | El token fue rotado: `npm run demo:bot` genera uno nuevo. |
| «El Puente no tiene vacantes vinculadas a esta fuente» | Falta la correspondencia en el Puente (la crea `demo:bot`, o Puente → Correspondencias con la fuente «LinkedIn (bot, simulador)», identificador `vinculo-bot`). |
| Los postulantes no llegan a Talentia | Revisa Puente → Conexiones (Talentia) y Operaciones. |

## Si algo falla en la demo

> Actualizado por Claude Code (2026-11-03, auditoría F4-V). Casos ensayados en local; en cada uno el bot termina con un mensaje en español. Lo ya enviado queda en el Puente y, al repetir, sale como «duplicada» (no se duplica en Talentia).

| Qué pasa | Qué muestra | Qué hacer |
|---|---|---|
| Se cierra la ventana del bot a mitad de la corrida | «Se cerró la ventana del bot antes de terminar…» | Vuelve a ejecutar `npm run bot -w apps/bot-linkedin`. Lo enviado sale «duplicada» y sigue con lo que faltaba. |
| Quedó abierta la ventana de `bot:login`, o hay otra corrida con el mismo perfil | «Se requiere intervención humana: … (si hay otra ventana del bot abierta, ciérrala primero)» o «El perfil del bot ya está abierto en otra ventana…» | Cierra la otra ventana del bot y vuelve a ejecutar. Dos corridas a la vez no duplican nada en Talentia (probado). |
| Otra pestaña de Vínculo abierta con la misma cuenta, en tu navegador normal | Nada: es otro navegador y otra sesión | Puedes dejarla abierta para mostrar la vacante. No cierres sesión en ella durante la demo (no se ensayó si afecta la sesión del bot). |
| La sesión del bot venció (por ejemplo, después de `demo:reset`) | «Se requiere intervención humana: El Simulador LinkedIn muestra la pantalla de ingreso…» | `npm run bot:login -w apps/bot-linkedin`, inicia sesión a mano y cierra la ventana. |
| Los puertos 3001, 3002 o 3003 están ocupados al hacer `npm run dev` | «✖ El puerto 3001 (vinculo) ya está en uso…» | Ya hay otra ventana con `npm run dev` o `npm start`: úsala, o ciérrala con Ctrl+C. Para ver qué programa es: `netstat -ano | findstr :3001`. |
| PostgreSQL apagado | `npm run dev` lo enciende solo. `demo:bot` dice «PostgreSQL no responde…»; el sitio muestra «Algo salió mal» y el bot se detiene diciendo qué revisar | `npm run pg:start` y repite el paso. |
| Las apps están apagadas | Bot: «El sitio no responde (http://localhost:3001)…»; `demo:bot`: «Simulador LinkedIn no responde en …» | Abre la ventana 1 con `npm run dev` y espera a que diga las tres URL. |
| El Puente está apagado mientras corre el bot | «… el Puente no responde; reintento en 2 s…» (hasta unos 2 minutos) y luego «No se pudo contactar al Puente…» | Ctrl+C, enciende las apps y vuelve a ejecutar. |
| El computador entró en suspensión y volvió (no ensayado) | `npm run dev` y PostgreSQL siguen corriendo; si una página se quedó a medias, «El sitio tardó demasiado…» | Recarga las pestañas; si algo no responde, Ctrl+C en la ventana 1 y `npm run dev` otra vez. Repite `bot:login` solo si el bot lo pide. |
| Falta Chromium de Playwright (otro computador) | «Falta el navegador Chromium de Playwright…» | `npx playwright install chromium` (necesita internet). |

## La API de Vínculo y el bot

Para la empresa, el LinkedIn real **no tiene API**. Por eso Vínculo arranca sin su API tipo Apply Connect (`VINCULO_API_HABILITADA=false`, D-68): sin portal de desarrolladores, sin OAuth ni `/api/v1` (404) y sin webhooks. `demo:bot` la deja apagada, y en la demo los candidatos solo llegan al ATS por el bot o por el importador. Para mostrar Apply Connect como «vía oficial futura»: `npm run vinculo:api -- on`, reiniciar las apps y `npm run demo:conectar`. Para apagarla otra vez: `npm run vinculo:api -- off` y reiniciar.

## Qué falta para usarlo con LinkedIn real

Nada de esto se hace mientras la Puerta 0 no diga «Bot = sí». Claude Code no abre LinkedIn real.

1. **Puerta 0** (`docs/v4/PUERTA0.md`): revisión de los términos de uso y visto bueno escrito del equipo y de la empresa; cuenta de reclutador propia de la empresa.
2. **Páginas de referencia anonimizadas:** guardar a mano (en `apps/bot-linkedin/fixtures/linkedin/originales/`, carpeta ignorada por git: nunca se versiona) las páginas de la lista de vacantes, la lista de postulantes y la ficha; anonimizarlas y copiarlas a `apps/bot-linkedin/fixtures/linkedin/anonimizadas/`.
3. **Selectores:** completar `SELECTORES_LINKEDIN` en `apps/bot-linkedin/src/sitios/linkedin/index.ts` (hoy vacíos y marcados «pendiente de la Puerta 0») y las funciones de extracción y de bloqueo, con pruebas sobre esas páginas anonimizadas.
4. **Prueba controlada:** con `--seco` y una sola vacante, pausas de 3–8 s, horario 07–19 y máximo 25 por ejecución.
5. Si LinkedIn muestra una verificación, el bot se detiene: no se agregan evasiones de ningún tipo.

# Auditoría final F4-V: bot, Vínculo sin API y demo

> Actualizado por Claude Code (2026-11-03). Rama `v4`. Sin despliegue y sin abrir LinkedIn real. Cada punto se comprobó en el código o con un comando. «No verificado» quiere decir que no se pudo comprobar.

## 1. Lista de comprobación

| # | Requisito (fuente) | Estado | Evidencia |
|---|---|---|---|
| 1 | Panel del reclutador de Vínculo con vacantes, postulantes, ficha con contacto y descarga del CV (PROMPT_BOT_VINCULO, «Qué construir» 1) | Cumplido | `apps/vinculo/src/app/reclutador/postulaciones/[id]/page.tsx` (ficha con `data-campo`) y enlace «Ver ficha» en `reclutador/vacantes/[id]/page.tsx`. E2E `e2e/bot.spec.ts` «el panel del reclutador…» |
| 2 | `PerfilSitio` en `sitios/tipos.ts` y perfil `vinculo` completo (2) | Cumplido | `apps/bot-linkedin/src/sitios/tipos.ts`, `sitios/vinculo/index.ts` y `selectores.ts` |
| 3 | Perfil `linkedin` solo como esqueleto, con selectores vacíos «pendiente de la Puerta 0», sin selectores inventados (2) | Cumplido | `sitios/linkedin/index.ts`. La prueba BV-6 exige que todos los selectores estén vacíos |
| 4 | `BOT_SITIO` (vinculo por defecto) y `BOT_URL_SITIO` (http://localhost:3001 por defecto) (2) | Cumplido | `src/config.ts` y `src/cli.ts` (`process.env.BOT_SITIO \|\| "vinculo"`) |
| 5 | Navegación, guardias, mapeo y envío comunes a todos los sitios (2) | Cumplido | `src/navegacion`, `src/guardias`, `src/mapeo`, `src/envio`: ninguno importa nada de `sitios/vinculo` |
| 6 | `bot:login` con perfil propio `.bot-perfil-<sitio>/`, `bot`, `--vacante` y `--seco` (2) | **Corregido** | En PowerShell, `--seco` **enviaba** las postulaciones y `--vacante` se perdía (D-72). Commit `7d8969b`; prueba `tests/argumentos.test.ts`; nuevo ensayo en PowerShell: `--seco` → 0 enviadas |
| 7 | Ventana visible por defecto (2) | Cumplido | `config.ts`: headless solo si `BOT_HEADLESS="true"`. `demo:bot` escribe `BOT_HEADLESS="false"` |
| 8 | Sin modo programado (2, §8.3) | Cumplido | No hay cron, `setInterval` ni tareas programadas en `apps/bot-linkedin/src`: la búsqueda solo encuentra el comentario que lo prohíbe. `cli.ts` hace una sola corrida |
| 9 | Pausas de 800–1500 ms en Vínculo y de 3000–8000 ms en LinkedIn; `BOT_PAUSA_MIN_MS`/`MAX` (2) | Cumplido | `sitios/vinculo/index.ts` y `sitios/linkedin/index.ts`. Prueba «máximo 25… pausa antes de cada página» (26 pausas en [800, 1500]) |
| 10 | Máximo 25 por corrida (2, §8.3) | Cumplido | `config.ts` (tope de 25 aunque se pida más) y la prueba del tope |
| 11 | Sin contraseñas guardadas (§8.3) | Cumplido | En el código solo aparece `input[type="password"]` en la detección del ingreso. El `.env` del bot no tiene claves de Vínculo. El perfil del navegador guarda solo la cookie de sesión y no se versiona (`.gitignore`: `.bot-perfil-*/`) |
| 12 | Sin evasión (§8.3) | Cumplido | Chromium normal. No hay `stealth`, cambio de user agent, proxies ni resolución de captchas (la búsqueda solo encuentra comentarios y las señales que detectan las guardias) |
| 13 | Se detiene ante una verificación o una sesión cerrada con «Se requiere intervención humana» (§8.3) | Cumplido y **ampliado** | BV-2. Ahora también se detiene ante una página del panel incompleta o la página de error del sitio (D-70, commits `a86ebdd` y `1603f01`) |
| 14 | Solo vacantes propias y vinculadas (§8.3) | Cumplido | `recorrido.ts` filtra por lo que el Puente devuelve en `GET /api/entradas/v1/vacantes` para el token |
| 15 | Selectores en un solo archivo y extracción con funciones puras probadas con páginas guardadas (§8.3) | Cumplido | `selectores.ts` y BV-1 sobre `fixtures/vinculo/*.html` |
| 16 | `demo:bot`: fuente, token mostrado una vez y guardado en `apps/bot-linkedin/.env`, correspondencia y 3 postulaciones con CV (3) | Cumplido | Ensayo en PowerShell (sección 3). `git check-ignore`: `apps/bot-linkedin/.env` está ignorado |
| 17 | BV-1 extracción | Cumplido | `tests/bot.test.ts` |
| 18 | BV-2 guardias | Cumplido | `tests/bot.test.ts` y `tests/fallos.test.ts` |
| 19 | BV-3 E2E con el mismo SHA-256 | Cumplido | `e2e/bot.spec.ts`. En desarrollo, los SHA-256 de los 3 CV coinciden entre Vínculo y Talentia |
| 20 | BV-4 segunda corrida = DUPLICADA | Cumplido | `e2e/bot.spec.ts` y el ensayo |
| 21 | BV-5 `--seco` | Cumplido (**corregido en PowerShell**) | `e2e/bot.spec.ts`, `tests/bot.test.ts` y `tests/argumentos.test.ts` |
| 22 | BV-6 `linkedin` se niega | Cumplido | Prueba más ejecución real: se niega en 0,5 s, sin abrir navegador ni red, y no crea el directorio del perfil |
| 23 | BV-7 regresión completa | Cumplido | Sección 4 |
| 24 | API apagada por defecto, también sin la variable o con un valor inválido | Cumplido | `src/lib/config.ts` (`apiHabilitada`); `tests/api-apagada.test.ts` cubre «vacía», «yes», «on» y otros |
| 25 | Con la API apagada no aparecen «Desarrolladores», «API para integradores» ni «Integraciones» | Cumplido y **corregido** | Los menús y el pie ya cumplían. Una vacante antes conectada decía «entregada a…» y la Solicitud sencilla mencionaba «ATS conectado»: commit `5d61d4e`, prueba `e2e/vinculo-sin-api.spec.ts` |
| 26 | Rutas del portal, OAuth, `/api/v1` y OpenAPI responden 404; no sale ningún webhook | Cumplido | `src/proxy.ts`, `modules/api/http.ts`, `postulacion.ts`, `despachador.ts`. Vitest `api-apagada.test.ts` y E2E `vinculo-sin-api.spec.ts` (estado HTTP 404 real) |
| 27 | Con la API prendida, todo igual que antes | Cumplido | El resto de Vitest y E2E corre con `VINCULO_API_HABILITADA=true` |
| 28 | `vinculo:api -- estado\|on\|off`; desarrollo, pruebas y demo respetan el valor | Cumplido | Probado en PowerShell. `npm run dev` toma el cambio sin reiniciar (se comprobó: 200 con on, 404 con off). Las pruebas fijan el valor explícito y `demo:bot` lo apaga |
| 29 | El adaptador Apply Connect del Puente no cambia | Cumplido | `git diff 06f33fd HEAD -- apps/puente/src` está vacío: el código del Puente no cambió en F4-V (solo sus scripts y pruebas) |
| 30 | Nombres visibles «Simulador LinkedIn» y «Simulador BUK»; franja «No es LinkedIn ni BUK: simulación académica»; fuente «LinkedIn (bot, simulador)» | **Pendiente (pregunta)** | Ese ajuste no existe en el código ni en ningún documento del repositorio: nunca llegó a esta sesión. Además contradice CLAUDE.md («sin logos, nombres ni colores de LinkedIn, BUK»). No se hizo. Hoy se ven «Vínculo», «Talentia», la franja «Entorno de simulación · Datos ficticios. No hay conexión con LinkedIn ni con BUK.» y la fuente «Puente · fuente «vinculo-bot»» |
| 31 | Sin logos, colores ni tipografías de esas marcas | Cumplido | `vinculo.css` (paleta verde azulado `#0f766e`, marca propia) y `talentia.css`. No hay colores de LinkedIn (`#0a66c2`, `#0077b5`) |
| 32 | Token, `.env`, perfil del navegador, cookies o CV reales sin versionar; fixtures sin rutas locales ni usuarios de Windows | Cumplido | `git ls-files`: solo `.env.example`. En todo el historial solo aparece `pf_0000000000.no-es-un-token-valido-0000`. Los únicos PDF son `fixtures/cv/*` (ficticios). Los fixtures del bot no tienen `<script>` ni rutas locales (en el historial, 0 resultados de la ruta local) |
| 33 | Nombre de la empresa en el repositorio versionado y en el historial | Cumplido | `git grep -i` en HEAD: 0 resultados. `git log --all -S` (sin mayúsculas): 0 resultados |
| 34 | Idempotencia y concurrencia | Cumplido | Corrida cortada tras 1 y repetida: 2 recibidas y 1 duplicada. Dos corridas a la vez: 3 en Talentia. Nueva prueba con 4 envíos simultáneos: 1 RECIBIDA y 3 DUPLICADA (`apps/puente/tests/entrada-generica.test.ts`) |
| 35 | Importador después de los cambios | Cumplido | En desarrollo, 3 PDF → 9001: «Enviada al ATS» ×3 en 7 s; en Talentia 9001 → Postulantes, fuente «Importador manual del Puente». E2E `importador.spec.ts` |
| 36 | Entrada genérica por curl: 202, 200, 401 y 422 | Cumplido | curl contra desarrollo: 202 RECIBIDA, 200 DUPLICADA, 401 NO_AUTORIZADO y 422 VACANTE_SIN_CORRESPONDENCIA |
| 37 | «Operaciones» muestra las del bot completadas | Cumplido (el guion se precisó) | Columnas: REFERENCIA, FUENTE, ESTADO, ÚLTIMO PASO, RECIBIDA, VACANTE → PROCESO, POSTULANTE. Las 3 filas: `vinculo-bot` · Completado · Postulación creada · VIN-DEMO-BOT → 9005 · «Mariana Q. · ma•••@demo.test». Filtro «Filtrar por fuente». Al pasar el ratón por la fuente: «Puente · fuente «vinculo-bot»» |
| 38 | Robustez de la demo y mensajes de error | **Corregido** | Commits `e45274d`, `a86ebdd` y `1603f01`, más la sección «Si algo falla en la demo» de `docs/manuales/bot.md` |
| 39 | `render.yaml` | Cumplido | Declara `VINCULO_API_HABILITADA="false"` (D-71). `render blueprints validate`: `valid: true`. No se desplegó |
| 40 | Documentos sin contradicciones ni afirmaciones legales | **Corregido** | Guion V4: quitado «cumple los términos de LinkedIn»; Apply Connect marcado como opcional con la API prendida; el bot ya no figura como «no construido»; preparación con `demo:bot`. README, D-68, el reporte y el estado actualizados sobre `render.yaml` |

## 2. Defectos corregidos

| Commit | Defecto | Prueba |
|---|---|---|
| `5d61d4e` | Con la API apagada, Vínculo seguía diciendo «entregada a «…»», «se entregan automáticamente al ATS» y «Si la empresa tiene un ATS conectado…» | `e2e/vinculo-sin-api.spec.ts` (segunda instancia en 3214) |
| `e45274d` | Con el Puente apagado, el bot callaba unos 2 minutos. Los errores de Playwright salían en inglés. «0 vacantes» llegaba sin explicación | `apps/bot-linkedin/tests/fallos.test.ts` y la prueba de concurrencia del Puente |
| `a86ebdd` | La sesión cerrada no decía qué hacer (ni que cerrara otra ventana del bot) | `tests/fallos.test.ts` |
| `7d8969b` | **En PowerShell, `-- --seco` enviaba**, y `--vacante`, `--reiniciar`, `--proceso` y `--publicar` se perdían | `tests/argumentos.test.ts` y el ensayo en PowerShell |
| `1603f01` | Puertos ocupados (EADDRINUSE en inglés), PostgreSQL apagado sin pista, y «Algo salió mal» confundido con una sesión vencida | `tests/fallos.test.ts` |

## 3. Ensayo del guion (PowerShell 7.6, base de desarrollo)

| Paso | Resultado | Tiempo |
|---|---|---|
| `npm run demo:reset` | 3 × «Demostración restablecida» | 4 s |
| `npm run demo:bot -- --reiniciar` | Vacante, fuente, correspondencia, conexión con Talentia y API apagada | 8–9 s |
| Inicio de sesión del bot | **No verificado el inicio manual**: se usó la sesión de pruebas (Playwright llena el formulario) | 7–9 s |
| `npm run bot -w apps/bot-linkedin -- --seco` | 0 enviadas, «Modo seco…» | 13 s |
| `npm run bot -w apps/bot-linkedin` | 3 recibidas | 11 s |
| `npm run bot -w apps/bot-linkedin` (otra vez) | 3 duplicadas | 11 s |
| `npm run demo:bot` sin `--reiniciar` y luego el bot | 3 duplicadas | 8 s + 13 s |
| `npm run demo:bot -- --reiniciar` (2.ª vez) y luego el bot | 3 recibidas en el Puente; en Talentia siguen 3 (las personas ya estaban) | 8 s + 13 s |
| Importador: 3 PDF → 9001 | «Enviada al ATS» ×3 | 7 s |

- Ningún paso pasó de 20 s.
- El ensayo corrió con `BOT_HEADLESS=true` (sin ventana), así que **no se verificó la ventana visible**: con ella puede tardar un poco más.
- La URL y la cuenta de cada paso están en `docs/guion-demo.md`, «V4 · Guion final para PowerShell». Se probaron:
  - Vínculo: `reclutadora@andina.demo.test`;
  - Talentia: `reclutador@andina.demo.test`;
  - Puente: `operador@puente.demo.test`;
  - las tres con la clave `Demo2026!`.

## 4. Puerta de calidad

Dos corridas seguidas desde cero (sin `npm ci`, ver la sección 5): lint, typecheck (4 workspaces más `e2e/`), Vitest, `npm run build` de las tres apps y Playwright. `retries: 0` en `playwright.config.ts`, así que una prueba inestable fallaría.

| Corrida | Lint | Typecheck | Vitest (Vínculo · Talentia · Puente · bot) | Playwright | Total |
|---|---|---|---|---|---|
| 1 (08:24–08:31) | 0 | 0 | 29 · 30 · 143 · 29 = 231 pasaron, 0 fallaron | 53 pasaron, 0 fallaron, 2 omitidas | **284 pasaron** |
| 2 (08:31–08:38) | 0 | 0 | 29 · 30 · 143 · 29 = 231 pasaron, 0 fallaron | 53 pasaron, 0 fallaron, 2 omitidas | **284 pasaron** |

- **Inestables:** ninguna (los mismos resultados en las dos corridas, sin reintentos).
- **Las 2 omitidas** son `e2e/capturas.spec.ts` (escritorio y móvil). Están omitidas a propósito con `test.skip(!process.env.CAPTURAS, "Solo con CAPTURAS=1")`: generan capturas para revisión, no prueban nada.
- **De 267 a 284:**
  - Vitest +14: 9 en `fallos.test.ts`, 3 en `argumentos.test.ts`, 1 de la página de error y 1 de concurrencia en el Puente;
  - Playwright +3: `vinculo-sin-api.spec.ts`.
- **`npm audit --omit=dev`:** 0 vulnerabilidades. `npm audit` completo: 16 moderadas, todas en las herramientas de ESLint (`minimatch`); no afectan lo que se ejecuta.

## 5. No verificado

- **El inicio de sesión manual de `bot:login`** (ventana visible y una persona escribiendo). Se usó la sesión de pruebas.
- **La ventana visible del bot durante la corrida** (las corridas se hicieron sin ventana).
- **Suspensión del computador y vuelta**: no se ensayó.
- **Cerrar la ventana del bot a mano a mitad de la corrida**: solo está probado el mensaje (prueba unitaria con el texto real de Playwright), no el cierre físico.
- **Instalación limpia (`npm ci`)**: no se hizo, porque habría borrado los `node_modules` que usan tus apps de desarrollo abiertas (3001–3003).
- **Dos corridas visibles con el mismo perfil**: sin ventana, la segunda no ve la sesión y se detiene, lo cual es seguro. Con ventana, Chromium puede negarse a abrir el perfil; en ese caso sale el mensaje «perfil … ya está abierto».

## 6. Preguntas

1. **Nombres visibles «Simulador LinkedIn» y «Simulador BUK»** (y la fuente «LinkedIn (bot, simulador)»). No están hechos, y CLAUDE.md los prohíbe. ¿Se cambia la regla? En ese caso harían falta textos en las dos apps, la franja y la etiqueta de fuente en `apps/puente/src/nucleo/fuentes.ts`, más el ajuste de las pruebas que leen esos textos. No es recomendable hacerlo la noche antes de la demo.

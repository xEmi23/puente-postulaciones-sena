# 6. Pruebas y resultados

> Todo lo de este documento se ejecutó el **11/11/2026** en la máquina del equipo (Windows 11, Node 24.2.0, PostgreSQL 16 local en el puerto 5435) y contra Render. Las cifras son las que imprimieron los comandos; lo que no se pudo comprobar dice **«no verificado»**.

## 6.1 Puerta de calidad (dos veces sin cambios, y una tercera tras los arreglos)

Comandos: `npm run lint` · `npm run typecheck` · `npm test` (Vitest de las 4 apps contra PostgreSQL real, base `tb2_test`) · `npm run test:e2e` (`next build` de las tres apps + Playwright escritorio y móvil con las apps compiladas y sus workers como procesos reales, base `tb2_e2e`). Playwright corre con `retries: 0`: una prueba inestable aparecería como fallo.

| Vuelta | Código | Lint | Typecheck | Vitest (Vínculo + Talentia + Puente + bot) | Build | Playwright | Inestables |
|---|---|---|---|---|---|---|---|
| 1 | `6b95cb1` (= `v4`) | 0 errores | 0 | 29 + 30 + 173 + 29 = **261/261** | 0 (3 apps) | **67 pasadas**, 2 omitidas (capturas, solo con `CAPTURAS=1`), 0 fallos · 6,6 min | 0 |
| 2 | `6b95cb1` (= `v4`) | 0 | 0 | **261/261** | 0 | **67 pasadas**, 2 omitidas, 0 fallos · 6,5 min | 0 |
| 3 | `ffcafcf` (con los 2 arreglos de §6.7) | 0 errores | 0 | 29 + 30 + 178 + 29 = **266/266** | 0 | **67 pasadas**, 2 omitidas, 0 fallos · 6,5 min | 0 |

Las vueltas 1 y 2 fueron idénticas. Total por vuelta: 261 + 67 = **328 pruebas** (vuelta 3: 266 + 67 = **333**).

## 6.2 Flujo final en local (formulario → Puente → Simulador BUK)

Con `npm run dev`. Envíos por HTTP como los hace la página (marca de tiempo firmada, espera ≥ 3 s), dentro de `scripts/medir-criterios.mjs`, y por el navegador en `scripts/capturas-entrega.mjs`.

| Comprobación | Resultado | Evidencia |
|---|---|---|
| Envío correcto llega a «Postulantes» con el mismo SHA-256 | **Sí**: 5/5 por HTTP + 1 por el navegador; SHA-256 del documento en el ATS = SHA-256 del PDF enviado; 10/10 campos correctos | [medicion/RESULTADO.md](medicion/RESULTADO.md); figuras 11.6 y 11.7 de [11](11_manual_de_uso.md) |
| Segundo envío con el mismo correo = duplicado | **Sí**: 200 con la **misma referencia** (`A636E1FA`) y **una sola** postulación en el ATS | Fallos provocados de la medición |
| Sin autorización | **Rechazado** (422 `consentimiento`), no llega al ATS | Ídem |
| PDF falso | **Rechazado** (415 `no_pdf`), no llega al ATS | Ídem |
| Demasiado rápido (< 3 s) | **Rechazado** (422 `rapido`), no llega al ATS | Ídem |
| Límite por IP (5 cada 10 min) | No repetido hoy en local por HTTP (el encabezado de IP se varió para no mezclar envíos); cubierto por Vitest `formulario.test.ts` («límite por IP») en las 3 vueltas | Vitest |

## 6.3 Criterios de éxito medidos (Fase 2)

**Método:** 45 envíos válidos + 12 fallos provocados, datos ficticios, local con `npm run dev`, 11/11/2026 21:14–21:15 (Bogotá). Detalle: [medicion/RESULTADO.md](medicion/RESULTADO.md) · datos crudos: [medicion/medicion-20261112021414.json](medicion/medicion-20261112021414.json) · script: [scripts/medir-criterios.mjs](../../scripts/medir-criterios.mjs).

| Criterio de éxito (ficha, evaluación del reto) | Cómo se midió | Resultado |
|---|---|---|
| **Porcentaje de postulaciones simuladas registradas sin error en el ATS** | Postulación presente en «Postulantes» del Simulador BUK **y** recepción «Completado» en el Puente | **45/45 = 100 %**. Las 10 enviadas a la vez recibieron un 429 del ATS (límite de 120/min) y se completaron en el reintento automático, sin duplicar |
| **Tiempo de registro por candidato** | Envío del cliente → `creadaEn` de la postulación en el ATS | Uno a la vez: mediana **1,16 s**, máximo **1,28 s** (n = 30) · formulario: mediana **0,84 s** (n = 5) · 10 a la vez con el 429: mediana **9,6 s**, máximo **10,4 s** |
| **Porcentaje de campos mapeados correctamente** | 10 campos por postulación (nombre, apellido, correo, teléfono E.164, ciudad, referencia externa, proceso, etapa, SHA-256 y tamaño del CV) frente a lo enviado | **450/450 = 100 %** |
| Rechazo de lo inválido | 12 fallos provocados (401, 400 ×2, 413, 415, 422, duplicado 200, revisión 202, formulario ×4) | **12/12** con la respuesta esperada; **0** llegaron al ATS |

**No medido:** el ahorro de horas del reclutador (no hay línea base de la empresa) ni los tiempos contra BUK real o contra Render.

## 6.4 Render

| Comprobación (11/11/2026) | Resultado |
|---|---|
| `GET https://puente-postulaciones.onrender.com/api/salud` | `{"estado":"ok","sistema":"puente","ats":{"destino":"talentia","implementado":true,…}}` a las 20:58, tras ~80 s despertando |
| `GET https://talentia-simulado.onrender.com/api/salud` | `{"estado":"ok","sistema":"talentia"}` a las 21:00, tras 84 s despertando |
| Prueba de humo del formulario (`RENDER_HUMO=1 npx playwright test -c playwright.render-formulario.config.ts`), 21:09 | **5/5** en 53 s: servicios despiertos; el panel exige sesión y muestra el enlace con «Copiar»; un PDF ficticio llega a Postulantes del proceso 9006 con el mismo SHA-256; el segundo envío es duplicado (misma confirmación, una sola postulación); `/privacidad` carga sin sesión, rotulada como borrador |
| Código desplegado en Render | `v4` (`6b95cb1`). **Los dos arreglos de §6.7 NO están en Render** (están en la rama `entrega`; no se hizo push a `v4` por la regla de la entrega) |
| Límite por IP detrás del proxy de Render | **No verificado** (PENDIENTE, D-76) |

## 6.5 Entrada genérica por JSON (Fase 1d) e importador (Fase 1e)

**Entrada genérica:** 19/19 casos con el resultado esperado contra el Puente local, incluidos **202** (`RECIBIDA` y `REQUIERE_REVISION`), **200** (`DUPLICADA`), **400** (6 variantes), **401** (×2), **413**, **415**, **422** y **429** (petición 61 en un minuto, `Retry-After: 59`). El ejemplo válido llegó a «Postulantes» del proceso 9002 con el mismo SHA-256. Tabla completa: [postman/resultados-ejemplos.md](postman/resultados-ejemplos.md) · script: [scripts/probar-ejemplos.mjs](../../scripts/probar-ejemplos.mjs).

**Importador (por las pantallas, operador):** los 3 PDF de `fixtures/cv/` al proceso **9004** → el Puente sugirió nombre, apellido, correo y teléfono de cada uno (sin IA) → «Importación confirmada: 3 enviada(s) al ATS» → los 3 en «Postulantes» del 9004 con fuente «Importador manual» y el mismo SHA-256.

## 6.6 Seguridad antes de publicar (Fase 4)

| Comprobación | Resultado |
|---|---|
| `git check-ignore` de `.env` (raíz y 4 apps), `.env.*`, `docs/ficha/`, `docs/insumos/`, `PROMPT_DOCUMENTACION.md`, `datos.json`, `fixtures/linkedin/originales/`, `.bot-perfil/`, `.bot-perfil-*/`, `.pgdata/`, `capturas/`, configuraciones locales de IA | **Todos ignorados** |
| `git ls-files` | Solo se versionan las plantillas `.env.example` (valores «CAMBIAR») |
| Nombre de la empresa, su identificación, sitio, contacto, teléfono y dirección, en **todo** lo versionado y en **los 35 commits** del historial (incluido el `.docx`, revisado por dentro) | **0 coincidencias** |
| Tokens y llaves (GitHub, OpenAI, AWS, claves privadas, URL de base con contraseña, Render) en todo el historial | **0 coincidencias**; el único token que aparece es el ficticio de las pruebas (`pf_0000000000.…`) |
| Correos que no son `@demo.test` | Solo ejemplos genéricos de documentación (`nombre@dominio.com`, `applicant@linkedin.com` del ejemplo oficial de Apply Connect) |

## 6.7 Defectos encontrados y corregidos hoy

| Commit | Defecto | Cómo se encontró | Prueba |
|---|---|---|---|
| `e7a9871` | La entrada genérica respondía en **inglés** cuando faltaba un obligatorio o sobraba un campo («Invalid input: expected string…», «Unrecognized key…») | Al probar los ejemplos de Postman | `tests/canonica.test.ts` «mensajes de validación en español» (3 pruebas; fallan sin el cambio) |
| `ffcafcf` | Al completar, el Puente programaba el aviso «CV descargado» al Simulador LinkedIn **para cualquier fuente**; en el flujo final el detalle mostraba «Aviso… Fallido» | En la captura del detalle de una operación del formulario | `tests/formulario.test.ts` y `tests/entrada-generica.test.ts` (fallan sin el cambio) |

## 6.8 Problemas del entorno local (no del producto)

| Problema | Causa | Solución |
|---|---|---|
| El formulario respondía 500 en `npm run dev` | La base de desarrollo no tenía las 2 migraciones del 03/11 (`npm run dev` no migra) | `npm run db:migrate` |
| En `npm run dev`, las páginas del Puente se recargaban solas en bucle | El cliente de desarrollo de Next recibía «HMR hash mismatch» (caché de `.next/dev` tras los `next build`) | Detener `npm run dev`, borrar `apps/puente/.next/dev` y volver a arrancar |
| Primer `curl` a Render sin respuesta inmediata | Servicios dormidos (plan gratuito) | Esperar 1–2 minutos |

Ambos quedaron en «Problemas frecuentes» de [docs/README_TECNICO.md](../README_TECNICO.md).

## 6.9 Qué cubren las suites automáticas

| Suite | Qué prueba | Dónde |
|---|---|---|
| Vitest Puente (178) | Contrato canónico, formulario (campos, consentimiento, límites, trampa, tiempo), entrada genérica (cada código), importador, núcleo y `ConectorATS`, fiabilidad (duplicados, concurrencia, reintentos, reconciliación), cifrado, firma, conexiones, zona horaria | `apps/puente/tests/` (dobles de contrato del ATS) |
| Vitest Simulador BUK (30) | API v1, API Keys, límite 429, idempotencia, etapas | `apps/talentia/tests/` |
| Vitest Simulador LinkedIn (29) y bot (29) | Apply Connect simulado, API apagada; bot sobre páginas guardadas | `apps/vinculo/tests/`, `apps/bot-linkedin/tests/` |
| Playwright (67 + 2) | Formulario de punta a punta (escritorio y móvil), entrada genérica, importador, panel y roles, tres sistemas, accesibilidad (axe), móvil | `e2e/` |

Historial de resultados de todas las versiones: [docs/resultados-pruebas.md](../resultados-pruebas.md).

## 6.10 Instalación limpia siguiendo el README

El 11/11/2026 (21:57–22:00) se clonó la rama `entrega` en una carpeta temporal vacía y se siguieron los pasos de «Ejecutarlo en 5 minutos» del [README](../../README.md):

| Paso | Resultado |
|---|---|
| `npm install` | 686 paquetes en 34 s |
| `npm run setup` | `.env` con secretos nuevos, PostgreSQL propio (tomó el puerto **5436** porque el 5435 estaba ocupado), migraciones y datos demo de las 4 apps, en 34 s |
| `npm run dev` | Simulador LinkedIn :3001, Simulador BUK :3002 y Puente :3003 respondiendo (`/api/salud` ok) |
| `npm run demo:bot` | Conexión del Puente con el Simulador BUK guardada y probada, en 11 s |
| Pasos 1–4 por las pantallas (`node scripts/capturas-entrega.mjs`) | «Crear enlace» del proceso 9003 → formulario sin sesión → confirmación → Operaciones «Completado» (4 pasos, 2,5 s) → tarjeta en «Postulantes» del Simulador BUK con el mismo SHA-256 |

No se probó con Docker (no está instalado en esta máquina).

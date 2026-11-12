# Puente de postulaciones (V4) · README técnico

> Actualizado por Claude Code (2026-11-11): este era el README de la raíz hasta la entrega. Se conserva completo como referencia técnica; el README para evaluadores está en la raíz ([../README.md](../README.md)). Sus enlaces se ajustaron a la nueva ubicación.

Prototipo académico para el **Reto #1 SENA · Innovación Abierta 2026-2**: llevar los postulantes a «Postulantes» del proceso correcto del ATS, sin descargar hojas de vida ni volver a digitar datos.

> **Entorno de simulación.** No hay conexión con LinkedIn ni con BUK, ni certificación o compatibilidad comprobada con ellos. **Vínculo** (red profesional) y **Talentia** (ATS) son **simulados**; el **Puente** es el producto que se propone. El adaptador de BUK está **deshabilitado** (sin documentación ni llave). Todos los datos son ficticios (`@demo.test`).

> Actualizado por Claude Code (2026-11-03, D-74). En pantalla, **Vínculo** se llama **«Simulador LinkedIn»** y **Talentia** **«Simulador BUK»** (siempre con «Simulador»; franja «No es LinkedIn ni BUK: simulación académica»). En el Puente la fuente `vinculo-bot` se ve como «LinkedIn (bot, simulador)» y `importador` como «Importador manual». Los nombres de carpetas, esquemas, URL, variables y comandos no cambian: este README los usa como nombres internos.

> Actualizado por Claude Code (2026-11-03, D-75). **Decisión del equipo: el bot queda descartado como vía de entrada.** La entrada nueva es **LinkedIn (oferta con enlace externo) → formulario público del Puente (`/postular/<código>`) → API del ATS (Simulador BUK)**. El enlace de cada vacante está en Puente → **Formulario público** (botón «Copiar»); el aviso de privacidad (borrador pendiente de validación legal) está en `/privacidad`. `apps/bot-linkedin` y Vínculo quedan como están, fuera de esta entrega.

**El producto es el Puente:** un middleware que recibe postulaciones de **cualquier fuente** con un contrato común (`PostulacionCanonica v1`), las valida, evita duplicados, verifica el CV y las registra en el ATS a través de una interfaz (`ConectorATS`), con estados visibles, revisión humana y auditoría. Cambiar de fuente o de ATS no toca el núcleo.

```
ENTRADAS (adaptadores)                       PUENTE :3003 (el producto)                         SALIDA
Importador manual (panel) ───────────┐      ┌──────────────────────────────────────┐
Entrada genérica + token (bots, …) ──┼────▶ │ registrarRecepcion(): canónica v1,   │ ──ConectorATS──▶ Talentia :3002 (simulado, activo)
Apply Connect (Vínculo :3001, sim.) ─┘      │ dedup, revisión, pasos reanudables,  │ ··············▶ BUK (deshabilitado)
                                            │ auditoría, retención, métricas       │
                                            └──────────────────────────────────────┘
```

Más detalle en [docs/arquitectura.md](arquitectura.md) (sección «V4 · capas»). Especificación del equipo: `docs/v4/ESPECIFICACION_V4.md`.

## Cómo probar cada entrada (local)

Con `npm run dev` en marcha y `npm run demo:bot -- --reiniciar` (conecta el Puente con Talentia; ver abajo). Apply Connect necesita además la API de Vínculo prendida (`npm run vinculo:api -- on`, reiniciar y `npm run demo:conectar`):

| Entrada | Cómo | Dónde se ve |
|---|---|---|
| **Formulario público (D-75)** | Puente → **Formulario público** → «Crear enlace» en un proceso → «Copiar» → abrir el enlace sin sesión → nombres, apellidos, correo, teléfono, PDF y la casilla de autorización → «Enviar postulación» | Operaciones (fuente «Formulario público»); Simulador BUK → Postulantes (mismo SHA-256 en la ficha) |
| **Importador manual** | Puente → **Importar** → elegir proceso → adjuntar PDF (p. ej. `fixtures/cv/*.pdf`) → revisar → **Confirmar e importar** ([manual](manuales/importador.md)) | Puente → Operaciones (fuente `importador`); Talentia → Postulantes |
| **Entrada genérica** | Puente → **Fuentes** → crear fuente y **Generar token**; **Correspondencias** → fuente, vacante y proceso; luego `POST /api/entradas/v1/postulaciones` (ejemplo en PowerShell en `docs/v4/REPORTE_F2.md`; contrato en `docs/contratos.md` §8) | Operaciones (fuente propia); sin correo o sin CV queda en «Requiere revisión» |
| **Bot asistido (experimental, solo Vínculo)** | `npm run bot:login -w apps/bot-linkedin` y `npm run bot -w apps/bot-linkedin` ([manual](manuales/bot.md)) | Operaciones (fuente `vinculo-bot`); Talentia 9005 → Postulantes |
| **Apply Connect (simulado, solo con la API prendida)** | Vínculo → «Solicitud sencilla» en una vacante publicada por el Puente | Operaciones (fuente `apply-connect`); el candidato ve «CV descargado» |

`ATS_DESTINO=talentia` (por defecto). Con `ATS_DESTINO=buk` el procesador no arranca y `/api/salud` responde 503 «ATS buk no implementado».

## Requisitos

- **Node.js 22 o superior** (probado con 24.2.0) y npm.
- **PostgreSQL 16 o 17** instalado: solo se usan sus programas (`initdb`, `pg_ctl`, `psql`, `createdb`); el proyecto crea su propio servidor en `.pgdata/`. En Windows se detecta en `C:\Program Files\PostgreSQL\16\bin` (o 17); si está en otra ruta, define `PG_BIN` con esa carpeta. Alternativa: [Docker](#alternativa-con-docker).
- Para las pruebas E2E: `npx playwright install chromium`.

## Instalación desde cero

```bash
npm install          # dependencias con versiones exactas (npm workspaces)
npm run setup        # .env con secretos aleatorios, PostgreSQL local, migraciones y datos demo de las 3 apps
```

`npm run setup` deja:

- `.env` en la raíz (solo PostgreSQL: `PG_PORT`, `PG_USER`, `PG_PASSWORD`) y un `.env` por app (`apps/<app>/.env`) con **sus propios** secretos. Ninguno se versiona ni se comparte entre apps. Plantillas: `.env.example` y `apps/<app>/.env.example`.
- Un PostgreSQL propio en `.pgdata/`, en el **5435** (o el siguiente libre), con las bases `tb2_dev`, `tb2_test` y `tb2_e2e`. Cada app usa su esquema: `vinculo`, `talentia`, `puente`.
- Datos de demostración en las tres apps (ver [Cuentas de demostración](#cuentas-de-demostración)).

Si reinicias el equipo, `npm run dev` vuelve a encender la base (o `npm run pg:start`).

## Ejecutar

```bash
npm run dev            # las tres apps a la vez, cada una con su worker dentro del proceso
```

En otra terminal, **una vez**, conecta los sistemas (equivale a hacerlo a mano en las pantallas, ver la demo):

```bash
npm run demo:conectar  # API Key en Talentia → app en Vínculo autorizada por Andina → conexiones del puente → publica 9001 y 9002
```

> Actualizado por Claude Code (2026-11-02, V4 F4-V). Desde D-68 Vínculo arranca **sin API** (`VINCULO_API_HABILITADA=false`), como el LinkedIn real para la empresa: sin portal de desarrolladores, OAuth ni webhooks. Para usar `demo:conectar` (Apply Connect simulado, la «vía oficial futura») primero `npm run vinculo:api -- on` y reinicia `npm run dev`. La demo del bot (`npm run demo:bot`, manual en `docs/manuales/bot.md`) la deja apagada.

| Sistema | URL | Qué es |
|---|---|---|
| **Vínculo** | http://localhost:3001 | Red profesional simulada: empleos, perfiles, «Solicitud sencilla», panel del reclutador, portal de desarrolladores y su API (apagados por defecto: `npm run vinculo:api -- on`, D-68) |
| **Talentia** | http://localhost:3002 | ATS simulado: procesos por etapas, postulantes, API Keys, API v1 y `/apidocs` |
| **Puente** | http://localhost:3003 | El producto: conexiones, publicación, operaciones, rechazos y métricas |

Versión compilada: `npm run build` y luego `npm start`.

## Cuentas de demostración

Contraseña de todas: **`Demo2026!`** (también se muestran en cada pantalla de ingreso).

| Sistema | Correo | Rol |
|---|---|---|
| Vínculo | `valentina.rios@demo.test` | Candidata (con historial) |
| Vínculo | `santiago.mejia@demo.test` | Candidato |
| Vínculo | `reclutadora@andina.demo.test` | Reclutadora de Andina Software S.A.S. (ficticia) |
| Talentia | `admin@andina.demo.test` | Administradora (API Keys, actividad de la API) |
| Talentia | `reclutador@andina.demo.test` | Reclutador |
| Puente | `admin@puente.demo.test` | Administrador (conexiones, fuentes y tokens, publicación, correspondencias, borrar datos) |
| Puente | `operador@puente.demo.test` | Operador (importa, revisa, aprueba, reintenta) |

## Demo en 7 pasos

Guion completo con tiempos y plan B: [docs/guion-demo.md](guion-demo.md) (sección «V4», unos 5 minutos: importador, Apply Connect simulado y confiabilidad). Estos 7 pasos muestran la entrada de Apply Connect:

1. **Restablecer:** `npm run demo:reset` y luego `npm run demo:conectar` (con `npm run dev` corriendo).
2. **Conexiones:** en el Puente → «Conexiones», las tres marcas en verde; «Probar conexión» contra Vínculo y Talentia.
3. **Publicar:** en el Puente → «Procesos», «Publicar en Vínculo» un proceso de Talentia (por ejemplo 9003).
4. **Postular:** en Vínculo, con `valentina.rios@demo.test`, busca la vacante, «Solicitud sencilla» en dos pasos y un PDF (`fixtures/cv/cv-camila-ejemplo.pdf`).
5. **Ver la transferencia:** en el Puente → «Operaciones», la postulación pasa a **Completado** con sus cuatro pasos.
6. **Ver en Talentia:** en el proceso, la tarjeta aparece en **Postulantes**; el CV descargado tiene el mismo SHA-256 que el original (`certutil -hashfile <archivo> SHA256` en Windows, `sha256sum` en Linux/macOS).
7. **Cerrar el ciclo:** en Vínculo → «Mis postulaciones», la solicitud muestra **«CV descargado»**.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run setup` | Primera instalación. Se puede repetir: no sobrescribe ningún `.env`. |
| `npm run pg:start` / `pg:stop` / `pg:status` | Enciende, apaga o consulta el PostgreSQL local. |
| `npm run dev` / `npm start` | Las tres apps en desarrollo o compiladas (3001, 3002, 3003). |
| `npm run demo:conectar` | Conecta los tres sistemas y publica 9001 y 9002 (requiere las apps encendidas). |
| `npm run demo:reset` | Borra y vuelve a sembrar **solo** datos demo en las tres apps (en el puente también borra las conexiones). Se niega con `NODE_ENV=production` o con una base no local. |
| `npm run demo:bot` | V4: vacante VIN-DEMO-BOT con 3 postulaciones en Vínculo, fuente «vinculo-bot» con token (en `apps/bot-linkedin/.env`), correspondencia → 9005, conexión del Puente con Talentia, y deja la API de Vínculo apagada. |
| `npm run vinculo:api -- on|off|estado` | Prende o apaga la API tipo Apply Connect de Vínculo (D-68); reiniciar las apps después. |
| `npm run bot:login -w apps/bot-linkedin` / `npm run bot -w apps/bot-linkedin` | Bot asistido (experimental) sobre Vínculo: iniciar sesión a mano y recorrer (`-- --seco`, `-- --vacante <id>`). |
| `npm run lint` | ESLint. |
| `npm run typecheck` | Cliente Prisma y `tsc --noEmit` en cada app. |
| `npm test` | Vitest de cada app contra PostgreSQL real (`tb2_test`). |
| `npm run test:e2e` | Compila y ejecuta Playwright (escritorio y móvil) con los tres sistemas reales en 3211–3213 contra `tb2_e2e`. |
| `npm run build` | Compilación de producción de las tres apps. |
| `npm run db:migrate` / `db:seed` | Migraciones y datos demo de las tres apps. |
| `npm run cv:generar` | Regenera los CV ficticios de `fixtures/cv/`. |

Cada app también tiene sus propios scripts: `npm run <script> -w apps/<vinculo|talentia|puente>`.

## Alternativa con Docker

No probada en la máquina de desarrollo.

```bash
npm install
npm run setup                                   # si falla al iniciar PostgreSQL local, ya dejó los .env
export PG_PASSWORD=<PG_PASSWORD del .env raíz>  # PowerShell: $env:PG_PASSWORD="..."
docker compose up -d                            # PostgreSQL 16 en el 5435 con tb2_dev, tb2_test y tb2_e2e
npm run db:migrate && npm run db:seed
```

## Despliegue

Render, plan gratuito, con `render.yaml` (tres servicios web y una base): [docs/despliegue.md](despliegue.md).

## Documentación

- [docs/arquitectura.md](arquitectura.md): los tres sistemas, secuencia y estados (Mermaid).
- [docs/contratos.md](contratos.md): Vínculo frente a Apply Connect, Talentia frente a BUK, entrada genérica (§8) y ConectorATS (§9), cada punto etiquetado.
- [docs/mapeo-datos.md](mapeo-datos.md): Vínculo → Puente → Talentia.
- [docs/decisiones.md](decisiones.md): decisiones con alternativa descartada y motivo.
- [docs/manuales/](manuales/): un manual por rol, incluido el [importador](manuales/importador.md).
- [docs/v4/](v4/): especificación V4 del equipo, informe F0 y reportes de cada fase.
- [docs/seguridad.md](seguridad.md): llaves, cifrado, sesiones, datos personales.
- [docs/despliegue.md](despliegue.md), [docs/guion-demo.md](guion-demo.md), [docs/resultados-pruebas.md](resultados-pruebas.md), [docs/estado.md](estado.md), [docs/uso-ia.md](uso-ia.md).

## Problemas frecuentes

- **«Configuración inválida o incompleta»** al arrancar: falta el `.env` de esa app. Ejecuta `npm run setup`.
- **`ECONNREFUSED` al puerto de la base:** la base está apagada (`npm run pg:start`).
- **No se encuentra `pg_ctl`:** define `PG_BIN` con la carpeta `bin` de PostgreSQL.
- **El Puente dice «Configura primero la conexión»:** ejecuta `npm run demo:conectar` (o configura «Conexiones» a mano). Después de `demo:reset` hay que volver a conectar.
- **La postulación no llega al Puente:** la vacante debe estar publicada por el Puente (o tener correspondencia) y el webhook validado en Vínculo → Desarrolladores.
- **Una postulación quedó en «Requiere revisión»:** le falta el correo o el CV, los datos vinieron sin confirmar o es un posible duplicado. Ábrela en Operaciones, complétala y apruébala (o descártala).
- **La entrada genérica responde 422:** vincula la vacante de esa fuente en Correspondencias. **401:** el token se revocó o se rotó (Fuentes).
- **Un puerto está ocupado:** cambia el puerto en `apps/<app>/package.json` y `APP_BASE_URL` en su `.env`, y vuelve a conectar.
- **El formulario o una pantalla nueva responde 500 en `npm run dev` («table … does not exist»):** la base de desarrollo no tiene las migraciones más recientes (`npm run dev` no migra). Ejecuta `npm run db:migrate`. *(Actualizado por Claude Code, 2026-11-11.)*
- **En `npm run dev` una página se recarga sola sin parar (en la consola del navegador, «HMR hash mismatch»):** detén `npm run dev`, borra la caché de desarrollo de esa app (`apps/<app>/.next/dev`) y vuelve a arrancar. Suele pasar después de `npm run build` o `npm run test:e2e`. *(Actualizado por Claude Code, 2026-11-11.)*

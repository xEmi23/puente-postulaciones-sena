# Resultados de pruebas

> Creado por Claude Code. Cada fila es una ejecución real (no un resumen). Entorno: Windows 11, Node 24.2.0, PostgreSQL 16 (clúster local del proyecto), Chromium de Playwright 1.64.1.

## Registro

| Fecha | Commit base | Comando | Resultado |
|---|---|---|---|
| 2026-10-25 | (antes de P1) | `npm run typecheck` · `npm run lint` | exit 0 · exit 0 |
| 2026-10-25 | (antes de P1) | `npm test` | 4 archivos, **20/20** |
| 2026-10-25 | (antes de P1) | `npm run test:e2e -- --project=escritorio` | build correcto, **2/2** |
| 2026-10-25 | `f1c96e8` (P1) + cambios P2 | `npm test` | 6 archivos, **46/46** |
| 2026-10-25 | `f1c96e8` (P1) + cambios P2 | `npm run test:e2e -- --project=escritorio` | **7/7** |
| 2026-10-25 | `e87c169` (P2) + cambios P3 | `npm run typecheck` · `npm run lint` | exit 0 · exit 0 (0 advertencias) |
| 2026-10-25 | `e87c169` (P2) + cambios P3 | `npm test` | 7 archivos, **50/50** |
| 2026-10-25 | `e87c169` (P2) + cambios P3 | `npm run test:e2e` (escritorio + móvil) | build correcto, **20/20** (1,6 min) |
| 2026-10-25 | `e87c169` (P2) + cambios P3 | `npx playwright test` (segunda corrida, estabilidad) | **20/20** |
| 2026-10-25 | `e87c169` (P2) + cambios P3 | Prueba de humo con `npm run dev` + `npm run worker` (puerto 3100, credenciales reales de `.env`) | entregada · tarjeta en Postulantes del proceso 9002 · hash coincide |
| 2026-10-25 | copia limpia de P3 | **Instalación limpia** siguiendo solo el README en una carpeta nueva: `npm install` → `npm run setup` → `npx playwright install chromium` → typecheck, lint, test y test:e2e | `setup` eligió el puerto 5434 (5433 ocupado), creó bases, migró y sembró · typecheck 0 · lint 0 · **50/50** · **20/20** |

Las filas de P5 están al final del archivo.

## Qué cubre cada suite

### Vitest (`npm test`): PostgreSQL real, route handlers reales en proceso

| Archivo | Pruebas | Cubre |
|---|---|---|
| `tests/firma.test.ts` | 6 | Firma válida, inválida, mayúsculas, con prefijo, re-serializada, UTF-8; challenge |
| `tests/webhook.test.ts` | 11 | GET challenge (<3 s, JSON); POST válido; SIGNATURE_MISMATCH; JSON ilegible; MISSING_REQUIRED_RESPONSE; INPUT_VALIDATION_FAILED; mediaUrl no autorizado; JOB_POSTING_CLOSED; cero escrituras |
| `tests/recorrido.test.ts` | 2 | Recorrido completo y hash idéntico; validación del formulario y vacante cerrada |
| `tests/zona-horaria.test.ts` | 1 | Regresión de fechas desplazadas (D-10) |
| `tests/fiabilidad.test.ts` | 20 | Requisitos 1 a 8 de P2, métricas, integridad del CV |
| `tests/sesion.test.ts` | 6 | Autenticación de demo con falla segura, tokens, redirección abierta, fallos inertes fuera de local |
| `tests/demo.test.ts` | 4 | `demo:reset` se niega en producción o con base remota; borra solo datos demo; crear vacante y proceso |

### Playwright (`npm run test:e2e`): app compilada + worker reales, base `tb_e2e`

| Archivo | Pruebas | Cubre |
|---|---|---|
| `e2e/criterios-29oct.spec.ts` | 8 | **C1 a C8** del control del 29/10 (detalle en `docs/estado.md`) |
| `e2e/recorrido.spec.ts` | 2 | Recorrido con hash; rechazo del formulario |
| `e2e/panel.spec.ts` | 5 | Acceso sin sesión; línea de tiempo y métricas; vacante desvinculada; ATS caído; respuesta perdida → verificación → reconciliación |
| `e2e/accesibilidad.spec.ts` | 3 | axe WCAG 2.1 AA en 21 pantallas sin violaciones serias ni críticas; teclado de punta a punta; foco al primer error |
| `e2e/movil.spec.ts` | 1 (×2 proyectos) | Pixel 7: postulación, tablero y panel sin desbordes horizontales |

## Lo que no se ejecutó

- `docker compose up` (Docker no está instalado en la máquina).
- Navegadores distintos de Chromium (Firefox y WebKit no están instalados ni configurados).
- Pruebas con LinkedIn o BUK reales: fuera del alcance por diseño (D-01).

## Fase P5

| Fecha | Commit base | Comando | Resultado |
|---|---|---|---|
| 2026-10-25 | `a23e48b` (P3) + cambios P5 | `npm run typecheck` · `npm run lint` | exit 0 · exit 0 (0 advertencias) |
| 2026-10-25 | `a23e48b` (P3) + cambios P5 | `npm test` | 10 archivos, **76/76** (incluye `tests/p5.test.ts` 10 y `tests/contratos/` 16) |
| 2026-10-25 | `a23e48b` (P3) + cambios P5 | `npm run test:e2e` (escritorio + móvil) | build correcto, **23/23** (2,4 min) |
| 2026-10-25 | `a23e48b` (P3) + cambios P5 | `npx playwright test` (segunda corrida, estabilidad) | **23/23** |
| 2026-10-25 | copia limpia de P5 | **Instalación limpia 2**: `npm install` → `npm run setup` (aplicó `inicial` y `cierre_vacantes` en bases vacías, puerto 5434) → typecheck · lint · test · test:e2e | 0 · 0 · **76/76** · **23/23** |

Suites agregadas en P5: `tests/p5.test.ts` (cierre y reapertura de vacantes, CV interrumpido, autenticación con el ATS, reanudación), `tests/contratos/contrato-origen.test.ts` (7, origen frente a F1/F2 y el ejemplo oficial), `tests/contratos/contrato-puente-y-ats.test.ts` (9, puente frente a F1/F2 y ATS frente a §3), `e2e/p5.spec.ts` (3).

## Ajuste de etapas

| Fecha | Commit base | Comando | Resultado |
|---|---|---|---|
| 2026-10-25 | `d45cbe7` (P5) + ajuste de etapas | `npm run typecheck` · `npm run lint` | exit 0 · exit 0 |
| 2026-10-25 | `d45cbe7` (P5) + ajuste de etapas | `npm test` | 11 archivos, **78/78** (nuevo `tests/etapas.test.ts`) |
| 2026-10-25 | `d45cbe7` (P5) + ajuste de etapas | `npm run test:e2e` | **24/24** (nuevo `e2e/etapas.spec.ts`: 9 columnas, tipos, Descartar/Restaurar) |
| 2026-10-25 | `d45cbe7` (P5) + ajuste de etapas | `npm run build` | exit 0 |
| 2026-10-25 | `0569a40` + tipos confirmados | `npm run demo:reset` · `typecheck` · `lint` | 0 · 0 · 0 |
| 2026-10-25 | `0569a40` + tipos confirmados | `npm test` · `npm run test:e2e` · `npm run build` | **78/78** · **24/24** · 0 |
| 2026-10-25 | `3d0d005` + D-19 | `npm run demo:reset` · `typecheck` · `lint` | 0 · 0 · 0 |
| 2026-10-25 | `3d0d005` + D-19 | `npm test` · `npm run test:e2e` · `npm run build` | **82/82** (nuevo `tests/procesos.test.ts`) · **26/26** (nuevo `e2e/proceso-encabezado.spec.ts`) · 0 |

---

## v2 · Pruebas de los tres sistemas

> Actualizado por Claude Code (2026-10-29). El detalle por fase (comandos y resultados reales) está en docs/estado.md, secciones F0 a F4.

### Qué cubre cada suite

| Suite | Archivos | Pruebas | Cómo corre |
|---|---|---|---|
| Vitest · Vínculo | `apps/vinculo/tests/`: integradores, entrega, seguridad, contrato-openapi | 26 | PostgreSQL real (`tb2_test`, esquema `vinculo`); webhooks dobles en proceso (`fetchSaliente`) |
| Vitest · Talentia | `apps/talentia/tests/`: api, contrato-openapi, procesos, etapas, sesion, demo | 30 | PostgreSQL real; route handlers de la API v1 llamados en proceso |
| Vitest · Puente | `apps/puente/tests/`: conexiones, webhook, contrato-puente, fiabilidad, p5, recorrido, firma, zona-horaria | 70 | PostgreSQL real; **dobles de contrato** de Vínculo y Talentia escritos desde docs/contratos.md (`tests/dobles.ts`), sin importar código de las otras apps |
| Playwright | `e2e/*.spec.ts` (11 archivos de pruebas + capturas) | 37 (escritorio + móvil) | Las **tres apps compiladas y sus workers como procesos reales** (puertos 3211–3213, base `tb2_e2e`), arrancados y matados por `e2e/supervisor.mjs`; la preparación conecta los sistemas como `demo:conectar` |

Las pruebas de contrato de cada simulador (`contrato-openapi.test.ts`) comprueban que los ejemplos del OpenAPI publicado pasan por la implementación real; las del puente, que su cliente cumple el mismo contrato contra los dobles. Así una diferencia entre contrato y código rompe una prueba.

### Resultado (2026-10-29, F4)

| Comando | Resultado |
|---|---|
| `npm run lint` | 0 errores |
| `npm run typecheck` | 0 errores (3 apps + e2e) |
| `npm test` | Vínculo 26/26 · Talentia 30/30 · Puente 70/70 |
| `npm run test:e2e` | 37/37 (2,8 min), incluida la auditoría axe WCAG 2.1 A/AA y la de desbordes en móvil |

### Criterios de aceptación y su prueba

| # | Criterio (ESPECIFICACION §7) | Prueba |
|---|---|---|
| 1 | Puerto y login propios; la sesión de uno no abre otro | `e2e/panel.spec.ts` (sin sesión; con sesión del puente, Talentia y Vínculo piden ingreso y no hay cookies suyas) |
| 2 | API Key vista una vez; Lectura sola → 403; revocada → 401 | `apps/talentia/tests/api.test.ts`, `e2e/talentia.spec.ts` |
| 3 | `/apidocs` y `/developers/docs` coinciden con la implementación | `apps/*/tests/contrato-openapi.test.ts`, `e2e/talentia.spec.ts`, `e2e/vinculo.spec.ts` |
| 4 | Aplicación de Vínculo, secreto visto una vez, token por client credentials | `apps/vinculo/tests/integradores.test.ts`, `e2e/vinculo.spec.ts` |
| 5 | «Probar conexión» y desafío del webhook | `apps/puente/tests/conexiones.test.ts`, `e2e/tres-sistemas.spec.ts` |
| 6 | «Publicar en Vínculo» crea la vacante con Solicitud sencilla | `apps/puente/tests/conexiones.test.ts`, `e2e/tres-sistemas.spec.ts` |
| 7 | En < 30 s en Postulantes del proceso correcto, mismo SHA-256 | `e2e/tres-sistemas.spec.ts`, `e2e/recorrido.spec.ts`, `e2e/criterios-29oct.spec.ts` (C3–C5) |
| 8 | «CV descargado» en Mis postulaciones | `e2e/tres-sistemas.spec.ts`, `apps/puente/tests/conexiones.test.ts` |
| 9 | Reenvío y entregas simultáneas: una sola postulación | `apps/puente/tests/fiabilidad.test.ts`, `e2e/criterios-29oct.spec.ts` (C6) |
| 10 | Una persona en dos procesos: un postulante, dos postulaciones | `apps/puente/tests/fiabilidad.test.ts` (P2.3) |
| 11 | Talentia caído, reinicio a mitad, respuesta perdida | `apps/puente/tests/fiabilidad.test.ts` y `p5.test.ts`, `e2e/panel.spec.ts`, `e2e/criterios-29oct.spec.ts` (C8) |
| 12 | API Key revocada: se detiene con mensaje claro, sin reintentar | `apps/puente/tests/conexiones.test.ts`, `e2e/tres-sistemas.spec.ts`, `e2e/p5.spec.ts` |
| 13 | Firma inválida, datos incompletos, PDF inválido, vacante cerrada | `apps/puente/tests/webhook.test.ts` y `p5.test.ts`, `e2e/criterios-29oct.spec.ts` (C7) |
| 14 | WCAG 2.1 AA y sin desbordes | `e2e/accesibilidad.spec.ts`, `e2e/movil.spec.ts` |
| 15 | Instalación limpia desde el README; `render blueprints validate` | F6 y F7 (ver docs/estado.md) |

### Lo que no se ejecutó

- Pruebas contra LinkedIn o BUK reales: no hay acceso (y no se buscaría).
- Pruebas de carga: fuera del alcance del prototipo.
- Docker Compose: no probado en esta máquina.

## v2 · Prueba de humo en Render (2026-10-29)

> Actualizado por Claude Code (2026-10-29). `e2e/humo-render.spec.ts` con `playwright.render.config.ts` (Chrome de escritorio), contra https://vinculo-simulado.onrender.com, https://talentia-simulado.onrender.com y https://puente-postulaciones.onrender.com. Todo por las pantallas, sin tocar las bases.

| Paso | Qué comprueba | Resultado |
|---|---|---|
| 0 | `/api/salud` de los tres servicios responde `ok` | ✓ |
| 1 | Talentia: el admin crea una API Key con Lectura y Modificación (se ve una vez) | ✓ |
| 2 | Vínculo: la reclutadora registra la aplicación, copia Client ID y Client Secret, y Andina la autoriza | ✓ |
| 3 | Puente: «Guardar y probar» Vínculo (token y empresa) y Talentia (permisos y procesos) | ✓ |
| 4 | Vínculo valida el webhook del puente por desafío firmado (https, sin redes privadas) | ✓ |
| 5 | Puente: «Publicar en Vínculo» el proceso 9001 con Solicitud sencilla | ✓ |
| 6 | La candidata `valentina.rios@demo.test` postula con Solicitud sencilla y un PDF | ✗ en la 1.ª ejecución (la prueba esperaba el campo de archivo, pero la candidata ya tiene CV en su perfil y el formulario lo preselecciona: era la prueba, no la app). Corregida (elige «Subir otra hoja de vida») → ✓ |
| 7 | El puente marca **Completado**; la tarjeta aparece en **Postulantes** del proceso 9001 en Talentia; el CV descargado tiene el **mismo SHA-256** que `fixtures/cv/cv-camila-ejemplo.pdf` | ✓ |
| 8 | La candidata ve **«CV descargado»** en Mis postulaciones (aviso RESUME_DOWNLOADED del puente) | ✓ |

Ejecuciones:

1. Pasos 0–5 ✓, paso 6 ✗ (prueba), 7–8 no corrieron. 2,0 min.
2. Pasos 0 y 6–8 con Valentina: **4/4 ✓** (34,6 s; el paso 7 tardó 20 s, incluidos los ingresos).
3. Ejecución completa accidental (ver docs/estado.md): pasos 1–4 ✓ de nuevo; paso 5 ✗ porque 9001 ya estaba publicado (el botón era «Cerrar en Vínculo»). Dejó el puente con otra aplicación; se reparó por las pantallas (revocar la aplicación sobrante, regenerar el secreto de la original, guardarlo en el puente y revalidar el webhook).
4. Tras la reparación, pasos 0 y 6–8 con `santiago.mejia@demo.test`: **4/4 ✓** (20,4 s).

Los servicios estaban despiertos (recién desplegados). La medición del arranque en frío está en docs/estado.md (F7, «Arranque en frío»).

---

## V4 · Resultados (2026-11-02)

> Actualizado por Claude Code (2026-11-02). Detalle por fase en `docs/v4/REPORTE_F1.md`, `REPORTE_F2.md` y `REPORTE_F3.md`.

| Momento | Vitest (Vínculo · Talentia · Puente) | Playwright | Total |
|---|---|---|---|
| Línea base (F0, código v2) | 26 · 30 · 73 | 37 | 166 |
| F1 | 26 · 30 · 110 | 37 | 203 |
| F2 | 26 · 30 · 129 | 41 | 226 |
| F3 | 26 · 30 · 142 | 45 | **243** |

Ninguna aserción de las 166 pruebas anteriores se cambió (R.2). Ajustes de infraestructura de pruebas, registrados en cada reporte: el doble de Talentia acepta el filtro `proceso_id` (la API real ya lo tiene) y las pruebas nuevas limpian sus propias tablas.

| Suite nueva | Archivo | Pruebas |
|---|---|---|
| Contrato canónico y estado V4 | `apps/puente/tests/canonica.test.ts` | 17 |
| Contrato de ConectorATS (Talentia) y BUK deshabilitado | `apps/puente/tests/conector-ats.test.ts` | 11 |
| Núcleo y salidas (ATS_DESTINO, regla de importación, registrarRecepcion, capacidad de CV) | `apps/puente/tests/nucleo-salidas.test.ts` | 9 |
| Entrada genérica (G-1 a G-9) | `apps/puente/tests/entrada-generica.test.ts` | 19 |
| Importador (I-1 a I-6) | `apps/puente/tests/importador.test.ts` | 13 |
| E2E entrada genérica | `e2e/entrada-generica.spec.ts` | 4 |
| E2E importador (I-7) | `e2e/importador.spec.ts` | 4 |

No se ejecutó: el bot (no construido; Puerta 0 pendiente), BUK real (sin documentación ni llave) y el despliegue de la V4 en Render (lo aprueba el equipo).

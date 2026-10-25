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

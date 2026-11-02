# Reporte F0 — Auditoría (solo lectura)

> Claude Code, 2026-11-02, rama `v4`. Modo nocturno: este reporte reemplaza la espera de revisión; el informe se usa como plan aprobado para F1–F3.

**Resumen (detalle en `docs/v4/INFORME_F0.md`):**

1. Línea base en verde: lint, typecheck, 129 Vitest y 37 Playwright (166).
2. El Puente actual mezcla el adaptador de Apply Connect con el núcleo en `src/modules/webhook.ts`; el procesador (`src/modules/procesador.ts`) llama directo al cliente de Talentia y descarga el CV de Vínculo.
3. El modelo `Recepcion` está atado a Apply Connect (`jobApplicationId` único, `mediaUrl` y `correo` obligatorios).
4. Existen y se conservan: firma HMAC, outbox con `SKIP LOCKED` y lease, pasos idempotentes, reconciliación, cifrado AES-256-GCM, roles ADMIN/OPERADOR, SSRF.
5. Faltan: canónica, `registrarRecepcion`, `ConectorATS`, BUK deshabilitado, `ATS_DESTINO`, fuentes y tokens, entrada genérica, `REQUIERE_REVISION`, posible duplicado, auditoría con actor, retención, métricas por fuente, importador.
6. Conflicto resuelto sin tocar pruebas: los nombres de estado v2 se conservan en la base y se expone un estado V4 derivado (D-52).
7. La estructura V4 se ubica en `src/nucleo`, `src/entradas`, `src/salidas`; `procesador.ts` y `webhook.ts` se quedan en `src/modules` (los importan las pruebas).

**Archivos:** `docs/v4/INFORME_F0.md`, `docs/v4/REPORTE_F0.md`, `docs/estado.md`; más el kit V4 del equipo sin modificar (`docs/v4/CONTEXTO_V4.md`, `ESPECIFICACION_V4.md`, `PUERTA0.md`, `Guia_V4_completa.docx`, `PROMPTS_V4.md`, `PROMPT_NOCHE_V4.md`, `CLAUDE.md`, `.gitignore`).

**Comprobar:** `git switch v4 && npm run lint && npm run typecheck && npm test && npm run test:e2e`.

**Dudas (no bloquean; se aplican las decisiones registradas):** intentos máximos 5 (especificación) frente a 10 (D-46); los archivos `docs/v3/`, `PROMPTS_BOT.md`, `docs/insumos/` y `PROMPT_DOCUMENTACION.md` quedan sin versionar (el último contiene el nombre de la empresa del reto).

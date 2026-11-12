# Contexto V4 para Claude Code — léelo completo antes de cualquier fase

> Actualizado por Claude Code (2026-11-12): por pedido del equipo, las frases que decían que la empresa «dijo», «pidió», «informó» o «no entrega» algo se reescribieron como «según lo entendido por el equipo; sin evidencia escrita». El equipo no se comunicó por correo ni por mensaje con la empresa. Ajuste posterior del mismo día: lo relativo a la API de LinkedIn y a la llave de BUK cita la ficha del reto, numeral 2.8 (acceso a BUK controlado y guiado por un gestor acompañante; el equipo no tiene llave; no se afirma que la empresa se haya negado). Lista de cambios: `docs/entrega/EVIDENCIA_PENDIENTE.md`.

> Documento del equipo (02/11/2026). Resume todo lo que pasó antes de la V4 y cómo se trabaja ahora. No lo reescribas; si algo aquí contradice el código real, repórtalo en el informe de la fase.

## 1. El reto en una línea

Reto #1 de Innovación Abierta 2026-2 (SENA Regional Antioquia, CUEE 2.0): pasar los postulantes de LinkedIn a «Postulantes» del proceso correcto en el ATS de la empresa (BUK), sin descargar CV ni digitar datos a mano. **Entrega y sustentación: 13/11/2026.** Se califica: comprensión 15 %, pertinencia 25 %, viabilidad 20 %, rigor metodológico (incluido el uso declarado de IA) 15 %, documentación 10 %, sustentación 15 %.

## 2. Historia del proyecto (por qué estamos en la V4)

| Versión | Qué fue | Dónde quedó |
| --- | --- | --- |
| v1 | Una sola app Next.js que simulaba origen, puente y ATS | Carpeta `talent-bridge` (rama `master`). **No se toca.** |
| v2 | Tres sistemas independientes: **Vínculo** (red tipo LinkedIn simulada, con API modelada sobre Apply Connect), **Talentia** (ATS simulado tipo BUK, con API Key y `/apidocs`) y **Puente** (el producto) | Esta carpeta, rama `v2`. Desplegada en Render. 129 pruebas Vitest + 37 Playwright en verde (166). Decisiones D-01 a D-51 |
| v3 | Según la ficha del reto, numeral 2.8, no se conectará la API directa de LinkedIn. Después del control del 29/10 se busca una alternativa en la que la postulación siga en LinkedIn (esto último, según lo entendido por el equipo; sin evidencia escrita). El equipo eligió un **bot asistido** (Playwright con la sesión del reclutador) | Solo especificación: `docs/v3/ESPECIFICACION_BOT.md` y `PROMPTS_BOT.md`. **Nunca se construyó.** Queda como historia |
| **V4** | Auditoría externa de la V3. Cambios: el Puente es el producto y no depende de la fuente; el bot pasa a ser un adaptador **experimental** que solo se construye si una verificación manual en LinkedIn (Puerta 0) sale bien; se agrega un **importador manual** legal; la salida al ATS va detrás de una interfaz con Talentia activa y BUK deshabilitado | **Vigente.** `docs/v4/ESPECIFICACION_V4.md` (fuente de verdad), `PROMPTS_V4.md`, `docs/v4/PUERTA0.md` |

## 3. Hechos que condicionan el diseño (no los cambies ni los «mejores»)

- **LinkedIn:** sus API de reclutamiento son solo para socios aprobados (Microsoft Learn). Su Acuerdo de Usuario (cláusula 8.2) prohíbe bots y extracción automatizada. Por eso el bot es experimental, se demuestra solo con una cuenta del equipo y CV ficticios, y nunca se presenta como solución estable.
- **No verificado en LinkedIn** (lo resuelve la Puerta 0, a mano, fuera de tu alcance): si una vacante gratuita deja ver y descargar los CV, qué datos de contacto aparecen, si el CV es obligatorio y si hay identificadores estables.
- **BUK:** tiene API de Selección con API Key y permisos de Lectura/Modificación (verificado en su centro de ayuda). **El equipo no tiene la llave**; según la ficha del reto, numeral 2.8, el acceso a la API REST de BUK es controlado y guiado por un gestor acompañante. Rutas, encabezado (`auth_token` es solo un indicio de terceros), subida de CV e idempotencia **no están verificados**. No escribas nada específico de BUK.
- **Talentia y Vínculo son simulaciones.** Nunca se presentan como servicios reales.

## 4. Lo que ya existe y debe seguir funcionando

- Monorepo npm workspaces: `apps/vinculo` (3001), `apps/talentia` (3002), `apps/puente` (3003). Next.js 16.4.3, React 19.3.1, TypeScript 5.9.3, Prisma 7.10.1 + PostgreSQL (un esquema por app), Better Auth 1.7.10, Zod 4, Vitest 5.0.5, Playwright 1.64.1.
- PostgreSQL local del proyecto: `npm run pg:start` (puerto 5435; **no tocar el 5433 de la v1**). Sin Docker en esta máquina.
- Puente hoy: webhook `/api/webhooks/vinculo` (firma HMAC), recepción + trabajo en outbox, procesador por pasos `cv_descargado → postulante_listo → documento_subido → postulacion_creada`, cliente de Talentia en `apps/puente/src/modules/ats-cliente.ts`, cliente de Vínculo en `src/modules/vinculo-cliente.ts`, conexiones cifradas (AES-256-GCM), correspondencias, operaciones y métricas. Dobles de contrato en `apps/puente/tests/dobles.ts`.
- Despliegue en Render (plan gratuito, `render.yaml`): `vinculo-simulado.onrender.com`, `talentia-simulado.onrender.com`, `puente-postulaciones.onrender.com`. La base gratuita vence el 28/11/2026. Los servicios duermen y tardan ~90 s en despertar.
- Remoto: `origin` = repositorio privado `puente-postulaciones-sena`. Es el único remoto permitido.

## 5. Cómo se trabaja en la V4

1. **Una fase por prompt** (F0, F1, F2, F3, F4, F5, en ese orden). Al terminar cada fase: puerta de calidad (lint, typecheck, pruebas, build), commit, push y reporte. **Luego te detienes**; el equipo revisa el reporte y pega el siguiente prompt.
2. **F0 es de solo lectura.** Su informe (`docs/v4/INFORME_F0.md`) define cómo se ubica la estructura de la V4 dentro del código real. La sección 5 de la especificación es una propuesta; si la v2 ya organiza las cosas de otra forma (por ejemplo, `src/modules/`), respeta la organización real y registra la equivalencia.
3. **F4 (bot) solo si `docs/v4/PUERTA0.md` dice «Bot = sí».** Hoy (02/11) la Puerta 0 está **pendiente**; la hace el equipo a mano el 2–3/11.
4. Fechas: Puerta 0 el 3/11 · F0–F1 el 2–3/11 · F2 el 4/11 · F3 el 5/11 · F4 el 6–7/11 (condicional) · F5 el 8/11 · código congelado el 9/11.
5. Ante la duda entre hacer más o hacer más confiable, elige más confiable. No agregues funciones fuera de la especificación.

## 6. Reglas de CLAUDE.md que cambian con la V4

`CLAUDE.md` dice «sin *scraping*, sin automatizar sesiones reales». En la V4 eso se mantiene **para todo el código y todas las pruebas**, con una única excepción acotada: el adaptador `apps/bot-linkedin` de la fase F4, y solo si la Puerta 0 dio «sí». Aun así:

- Claude Code **nunca** abre LinkedIn real, ni desde código ni desde pruebas. Trabaja solo con páginas guardadas y anonimizadas.
- El bot solo lo ejecuta una persona del equipo, con ventana visible, sesión iniciada a mano, sin contraseñas, sin evasión de ningún tipo, con pausas y límites, y se detiene ante cualquier verificación.
- Las páginas originales de LinkedIn van en `fixtures/linkedin/originales/` (fuera de git). Solo se versionan copias anonimizadas.

El resto de reglas de `CLAUDE.md` sigue igual: sin nombre de la empresa, datos ficticios `@demo.test`, no debilitar pruebas, no sobrescribir documentos del equipo, textos en español, sin importar código de dominio entre apps.

## 7. Decisiones abiertas que no te tocan (no las resuelvas tú)

Cómo se supo que no habrá API de LinkedIn ni llave de BUK (no hay evidencia escrita: el equipo no se comunicó por escrito con la empresa) · postura de la empresa y el mentor sobre mostrar el bot · tiempo actual del traslado manual · API real de BUK · obligaciones de datos personales (Ley 1581 de 2012). Están en la pestaña «Validaciones pendientes» del documento del equipo; en la V4 se documentan como pendientes, nunca como resueltas.

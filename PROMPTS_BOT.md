# Prompts para Claude Code — v3: bot asistido de LinkedIn

Úsalos en la carpeta `talent-bridge-v2`, en modo **Auto**, en este orden. Cada uno termina en un punto de control.

---

## PROMPT B1 — Construir el bot y la nueva entrada del Puente

```text
Lee completos: docs/v3/ESPECIFICACION_BOT.md, CLAUDE.md, docs/estado.md, docs/decisiones.md, docs/contratos.md y docs/v2/ESPECIFICACION.md. docs/v3 es del equipo: no lo reescribas; si algo no se puede cumplir, regístralo en docs/decisiones.md con motivo y alternativa.

Trabaja en una rama nueva v3 creada desde v2. MODO AUTÓNOMO: toma decisiones reversibles y regístralas desde D-52.

Construye, en este orden y con puerta de calidad al cerrar cada paso (lint, typecheck, pruebas, build; nunca debilitar pruebas; commit "v3 BX: …"; docs/estado.md al día):
B1.1 Puente: token del bot (generar, revocar, último uso), correspondencias tipo linkedin, GET /api/entradas/linkedin-bot/vacantes, POST /api/entradas/linkedin-bot, procesamiento con fuente LINKEDIN_BOT reutilizando el procesador desde postulante_listo, fuente «LinkedIn (bot asistido)» en Talentia, filtros y métricas por fuente. Pruebas B-4 y B-5.
B1.2 apps/bot-linkedin con la estructura de la §3 (navegación, selectores.ts, extracción, guardias, envío, comandos y .env.example). Las salvaguardas de la §1 son obligatorias: ventana visible por defecto, sin contraseñas, sin evasión de ningún tipo, detenerse ante verificaciones, pausas y límites.
B1.3 Si la carpeta fixtures/linkedin/ tiene HTML guardados por el equipo, deriva de ellos los selectores y la extracción y escribe las pruebas B-1. Si está vacía, deja la extracción con un contrato claro, selectores marcados como Supuesto pendiente, pruebas con HTML sintéticos que imiten la estructura descrita, y anota en docs/estado.md que falta el reconocimiento. No navegues ni explores LinkedIn real.
B1.4 Pruebas B-2, B-3 (servidor local que sirve los HTML como si fuera LinkedIn), B-6, B-7 y regresión completa (B-9).
B1.5 Documentación de la §6. Manual del bot con pasos para Windows/PowerShell.

NUNCA: usar la API de LinkedIn; acceder a LinkedIn real desde pruebas automáticas; guardar contraseñas; incluir datos personales reales en el repositorio fuera de fixtures/linkedin/; anti-detección, captchas o proxies; tocar la carpeta talent-bridge (v1); push a un remoto distinto de origin.

Al terminar: push de la rama v3 a origin y reporte con: qué funciona, cómo lo pruebo yo (comandos exactos), criterios B-1 a B-9 con su prueba, pendientes del equipo (en especial el reconocimiento y la prueba real B-8).
```

---

## PROMPT B2 — Ajustar con el reconocimiento real (después de guardar los HTML)

```text
El equipo guardó en fixtures/linkedin/ las páginas reales de la vacante de prueba (lista de empleos, lista de postulantes y detalle de un postulante). Léelas, ajusta selectores.ts y la extracción a esa estructura real, reemplaza los supuestos por lo observado (regístralo en docs/decisiones.md y docs/contratos.md con la fecha), actualiza las pruebas B-1 a B-3 para usar estos HTML y ejecuta la regresión completa. No navegues LinkedIn real. Commit "v3 B2: selectores reales", push y reporte.
```

---

## PROMPT B3 — Después de la prueba real asistida (B-8)

```text
Ejecuté la prueba real asistida. Resultado: <pega aquí lo que pasó: cuántos postulantes, si llegaron a Talentia, errores que mostró el bot>.
Si hubo errores: reprodúcelos con los HTML de fixtures/linkedin/ (pídeme guardar otra página si falta), corrige lo mínimo con prueba que lo detecte, regresión completa.
Luego: registra la prueba B-8 en docs/resultados-pruebas.md (fecha, n, tiempos, resultado), actualiza docs/guion-demo.md con el recorrido real (LinkedIn → bot → Puente → Talentia) y plan B, y despliega el Puente actualizado en Render haciendo merge de v3 en la rama que usa el Blueprint (o cambiando la rama del Blueprint si es necesario; explica qué hiciste). Verifica /api/salud y una entrada de prueba con --seco. Commit, push y reporte final.
```

---

## RETOMAR

```text
Lee CLAUDE.md, docs/v3/ESPECIFICACION_BOT.md y docs/estado.md. Verifica con pruebas el estado real. Retoma el primer paso pendiente del último prompt B en modo autónomo, sin rehacer lo que funciona. Actualiza docs/estado.md y reporta.
```

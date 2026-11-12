# 8. Uso declarado de IA generativa

> La rúbrica del reto pide un uso **pertinente y declarado** de IA generativa y la trazabilidad de las decisiones. Este documento separa lo que hizo la IA de lo que decidió el equipo, enumera los prompts por fase y dice qué falta revisar.
> Historial detallado por versión: [docs/uso-ia.md](../uso-ia.md).

## 8.1 Herramientas

| Herramienta | Proveedor | Para qué | Evidencia |
|---|---|---|---|
| ChatGPT | OpenAI | Primera guía de ejecución (24/10) y un prompt de solución (25/10) que proponía simular ambos extremos | **PENDIENTE: evidencia del equipo** (archivo de la guía y capturas) |
| Claude (chat) | Anthropic | Análisis del reto y de la rúbrica, investigación con búsqueda web en fuentes oficiales, comparación de alternativas, arquitectura, redacción de las especificaciones y de los prompts para Claude Code | `CLAUDE.md`, [docs/v2/](../v2/), [docs/v4/ESPECIFICACION_V4.md](../v4/ESPECIFICACION_V4.md), archivos `PROMPT*.md`. Capturas de las conversaciones: **PENDIENTE: evidencia del equipo** |
| Claude Code (modelo Claude Opus, modo autónomo) | Anthropic | Escribir el código, las pruebas y la documentación técnica; ejecutar la puerta de calidad; corregir defectos; capturas con Playwright; desplegar en Render cuando el equipo lo aprobó; esta verificación final | Historial de git (35 commits del 25/10 al 03/11 y los de la rama `entrega`), [docs/estado.md](../estado.md), reportes de [docs/v4/](../v4/) |

**Herramientas sin IA:** Node.js, Next.js, PostgreSQL, Prisma, Vitest, Playwright, ESLint, Git/GitHub, Render. La lectura de PDF del importador y la sugerencia de correo y teléfono **no usan IA** (expresiones regulares sobre el texto del PDF, D-62).

**El producto no usa IA en tiempo de ejecución.** El traslado es determinista y auditable (decisión del 28/10: servicio por eventos en lugar de un agente de IA).

## 8.2 Qué hizo la IA y qué decidió el equipo

| Tema | La IA | El equipo |
|---|---|---|
| Entender el reto | Resumió la ficha y la rúbrica; propuso reducir el alcance | Aportó el contexto de la socialización y las observaciones del ATS |
| Investigación | Consultó y resumió Microsoft Learn (LinkedIn) y el centro de ayuda de BUK, con URL y fecha; detectó una discrepancia en la firma de Apply Connect | Decidió simular ambos extremos (D-01) |
| Arquitectura | Propuso tres sistemas, servicio por eventos, `ConectorATS` | Eligió tres sistemas (28/10), aprobó la V4 tras la auditoría externa |
| Bot | Lo especificó (V3) y lo construyó solo sobre el simulador (F4-V), con guardias y sin evasión | **Lo descartó** como vía de entrada (D-75) |
| Formulario público | Lo construyó con protecciones y aviso en borrador | Lo eligió como entrada final y aprobó el despliegue («APROBADO PARA DESPLEGAR») |
| Nombres visibles | Advirtió que contradecían la regla anterior | Decidió «Simulador LinkedIn» / «Simulador BUK» (D-74) |
| Código y pruebas | Escribió todo el código, ~330 pruebas automáticas y los scripts | **PENDIENTE: evidencia del equipo** (qué revisó cada integrante) |
| Documentación | Redactó los documentos técnicos y esta entrega | Revisión de textos y tono: **PENDIENTE** |
| Medición | Escribió y ejecutó `scripts/medir-criterios.mjs` | — |

## 8.3 Prompts por fase

Los prompts son del equipo (redactados con apoyo de Claude chat) y se pegaron en Claude Code uno por fase. Cada fase cerraba con la puerta de calidad, un commit y un reporte; el equipo revisaba antes de pegar la siguiente.

| Versión | Archivo | Fases | Resultado |
|---|---|---|---|
| V1 (25/10) | [PROMPTS_CLAUDE_CODE.md](../../PROMPTS_CLAUDE_CODE.md) | P1 contratos y recorrido vertical · P2 fiabilidad y panel · P3 pulido para el 29/10 · P5 casos y edición de vacantes | Commits `f1c96e8` → `b45cf73` |
| V2 (28–29/10) | [PROMPT_V2.md](../../PROMPT_V2.md) | Prompt principal (F0 monorepo → F7 Render), prompt de despliegue, retomar | Commits `d395e45` → `f1b7c4c` |
| V3 (30/10–01/11) | [PROMPTS_BOT.md](../../PROMPTS_BOT.md) | B1 construir el bot · B2 ajustar con páginas reales · B3 después de la prueba asistida | **No se ejecutó**: la auditoría externa lo reemplazó por la V4 |
| V4 (02/11) | [PROMPTS_V4.md](../../PROMPTS_V4.md) y [PROMPT_NOCHE_V4.md](../../PROMPT_NOCHE_V4.md) | F0 auditoría (solo lectura) · F1 núcleo y `ConectorATS` · F2 entrada genérica · F3 importador · F5 documentación | Commits `d150102` → `06f33fd` |
| V4 F4-V (03/11) | [PROMPT_BOT_VINCULO.md](../../PROMPT_BOT_VINCULO.md) | Bot con perfil del simulador, Simulador LinkedIn sin API, auditoría final | Commits `34c2314` → `0dfbd9c` |
| V4 F6 (03/11) | Prompt del equipo «formulario público y despliegue» y «formulario más realista» | Formulario, aviso, protecciones, despliegue en Render | Commits `b8f32b4` → `6b95cb1`. Texto del prompt: **PENDIENTE: evidencia del equipo** (no está en el repositorio) |
| Entrega (11/11) | Prompt «ENTREGA FINAL» del equipo (resumen abajo) | Verificación doble, medición, documentación, revisión de seguridad, publicación privada | Rama `entrega` |

**Resumen del prompt de entrega (11/11):** comprobar todo dos veces sin editar (lint, typecheck, Vitest, build, Playwright), probar el flujo final y la entrada JSON con cada código de respuesta, el importador y Render; medir los tres criterios de éxito con al menos 30 envíos; escribir `docs/entrega/`; revisar que nada sensible se versione; subir solo la rama `entrega` a un repositorio privado. Reglas: no debilitar pruebas, no tocar la rama de despliegue ni el repositorio v1, no abrir LinkedIn real, corregir solo defectos reales con su prueba.

## 8.4 Reglas que se le impusieron a la IA

Todas están en [CLAUDE.md](../../CLAUDE.md) y en la sección R de [ESPECIFICACION_V4.md](../v4/ESPECIFICACION_V4.md):

- Nunca afirmar conexión ni compatibilidad comprobada con LinkedIn o BUK; todo lo externo se llama «simulado».
- Sin *scraping*, sin automatizar sesiones reales, sin abrir LinkedIn real; sin inventar rutas de BUK.
- Solo datos ficticios (`@demo.test`); nunca el nombre de la empresa.
- No debilitar pruebas; reportar exactamente qué se ejecutó.
- No sobrescribir los documentos del equipo: agregar secciones «Actualizado por Claude Code (fecha)».
- Etiquetar cada afirmación como **Verificado**, **Decisión interna** o **Supuesto pendiente**.

## 8.5 Errores de la IA detectados por las pruebas (muestra)

| Fecha | Error | Cómo se detectó | Corrección |
|---|---|---|---|
| 25/10 | Fechas desplazadas 5 h por zona horaria | Pruebas de integración | D-10 |
| 29/10 | El Puente no renovaba el token del simulador tras regenerar el secreto | Prueba nueva | D-45 |
| 02/11 | Una migración obligaba a cambiar pruebas existentes | Regla «no debilitar pruebas» | Se rehízo sin cambiar la clave única |
| 03/11 | En PowerShell, `--seco` del bot **enviaba** las postulaciones | Auditoría F4-V | D-72, commit `7d8969b` con prueba |
| 03/11 | La E2E nueva del formulario hacía clic antes de cargar | Puerta de calidad | Se corrigió la prueba sin aflojar aserciones |

## 8.6 Confidencialidad con la IA

- Ninguna herramienta de IA recibió credenciales reales ni datos personales de candidatos.
- Las fotos del ATS tomadas en la socialización (con nombres reales) se compartieron con Claude chat para describir la estructura; la descripción guardada ([docs/referencia-ats.md](../referencia-ats.md)) no contiene nombres. **El equipo debe declararlo así en la sustentación.**
- La ficha del reto se leyó solo en local y no se versiona.

## 8.7 Revisión humana pendiente

Ver [EVIDENCIA_PENDIENTE.md](EVIDENCIA_PENDIENTE.md): capturas de las conversaciones, quién revisó qué parte del código y de los documentos, y el texto del prompt F6.

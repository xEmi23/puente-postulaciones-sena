# 8. Uso declarado de IA generativa

## 8.1 Declaración

**El desarrollo, las pruebas y la redacción de este proyecto se hicieron con apoyo MAYORITARIO de inteligencia artificial generativa (Claude Code).**

- **Claude Code** (Anthropic, modelo Claude Opus, modo autónomo) **programó, probó y documentó** todo el sistema siguiendo especificaciones por fases: el código de las cuatro aplicaciones, las pruebas automáticas, los scripts, la configuración de despliegue, los documentos técnicos y estos documentos de entrega.
- **Claude (chat)** (Anthropic) apoyó **el diseño, la auditoría y la redacción de los prompts y especificaciones** que luego se le dieron a Claude Code.
- **La auditoría externa de la V3** que originó la V4 la hizo **Julián Pérez Ortiz con Claude Pro**.
- **El equipo** (Emiliano Serna Ortega, Julián Pérez Ortiz, Moisés Elio Obregón y Katherine Acosta; docente: Walver Rodríguez) definió el problema, eligió entre alternativas, dirigió las fases, probó y tomó las decisiones.

No afirmamos que el código se haya revisado línea por línea.

## 8.2 Qué hizo la IA y qué hizo el equipo

Basado solo en lo que consta en el repositorio y su historial.

| Actividad | Qué hizo la IA | Qué hizo el equipo | Evidencia en el repositorio |
|---|---|---|---|
| Entender el reto | Claude (chat) resumió la ficha y la rúbrica | Leyó la ficha, fotografió el ATS en la socialización (15/10) y analizó las interfaces de LinkedIn (de ahí dedujo que la postulación empieza en LinkedIn) | [referencia-ats.md](../referencia-ats.md) (redactado a partir de las fotos del equipo) |
| Investigación | Claude (chat) y Claude Code consultaron y resumieron Microsoft Learn y el centro de ayuda de BUK, con URL y fecha | Eligió qué investigar | [contratos.md](../contratos.md) |
| Especificaciones | Claude (chat) redactó las especificaciones y los prompts por fase | Decidió el enfoque de cada versión; los documentos se marcan «del equipo» | `docs/v2/`, `docs/v3/`, `docs/v4/`, `PROMPT*.md`; [CONTEXTO_V4.md](../v4/CONTEXTO_V4.md) («Documento del equipo») |
| Elegir entre alternativas | Propuso y comparó alternativas | **Eligió**: simular ambos extremos, tres sistemas, Render, V4, descartar el bot, el formulario, los nombres visibles | D-74 y D-75 se registran como «decisión del equipo»; D-01 y D-20 constan en la cronología del equipo (no publicada) |
| Programar | Claude Code escribió **todo** el código de las 4 aplicaciones y los scripts | — | Todos los commits del historial de git |
| Probar | Claude Code escribió y ejecutó las pruebas (266 de Vitest y 67 de Playwright, más 2 de capturas) y corrigió los fallos | Probó el sistema en local y en Render, y probó el formulario con personas (funcionó; cantidad y fecha no registradas) | [docs/estado.md](../estado.md), [06](06_pruebas_y_resultados.md) |
| Dirigir las fases | Cada fase terminaba con un reporte | Pegaba el prompt de cada fase, leía el reporte y decidía seguir | `docs/v4/REPORTE_F*.md`; método en [CONTEXTO_V4.md](../v4/CONTEXTO_V4.md) §5 |
| Desplegar | Claude Code preparó `render.yaml`, cambió ramas por CLI y verificó | Creó el Blueprint en Render (paso manual, 29/10) y aprobó el despliegue del 03/11 («APROBADO PARA DESPLEGAR») | [despliegue.md](../despliegue.md); D-75 |
| Auditar | Claude Code auditó su propio código por fase (F0, F4-V, verificación del 11/11) | **Julián Pérez Ortiz** hizo la auditoría externa de la V3 que originó la V4, **con Claude Pro** | [INFORME_F0.md](../v4/INFORME_F0.md), [AUDITORIA_F4V.md](../v4/AUDITORIA_F4V.md) |
| Documentar | Claude Code redactó los documentos técnicos y de entrega; Claude (chat), las especificaciones | Dio las indicaciones de cada documento | `docs/` |
| Medir | Claude Code escribió y ejecutó la medición de criterios | — | [medicion/RESULTADO.md](medicion/RESULTADO.md) |
| LinkedIn | — (la IA nunca abrió LinkedIn real) | **Publicó la oferta en LinkedIn** con el enlace externo al formulario | Hecho declarado por el equipo; costo en [10](10_trabajo_futuro.md) §10.2 |

## 8.3 Herramientas

| Herramienta | Proveedor | Para qué | Evidencia |
|---|---|---|---|
| Claude Code | Anthropic | Código, pruebas, documentación, despliegue, verificación (apoyo mayoritario) | Historial de git; reportes de fase |
| Claude (chat) | Anthropic | Análisis, investigación, diseño, especificaciones y prompts | Especificaciones y prompts del repositorio |
| Claude Pro | Anthropic | Auditoría externa de la V3 que originó la V4 (Julián Pérez Ortiz) | [ESPECIFICACION_V4.md](../v4/ESPECIFICACION_V4.md) |
| ChatGPT | OpenAI | Guía inicial (24/10) y prompt de solución (25/10), según la cronología del equipo | No se versionan |

Planes de IA usados y su costo: **por confirmar**.

**Sin IA:** Node.js, Next.js, PostgreSQL, Prisma, Vitest, Playwright, ESLint, Git/GitHub, Render. La lectura de PDF del importador **no usa IA** (D-62).

**El producto no usa IA en tiempo de ejecución:** el traslado es determinista y auditable.

## 8.4 Prompts por fase

| Versión | Archivo | Fases | Resultado |
|---|---|---|---|
| V1 (25/10) | [PROMPTS_CLAUDE_CODE.md](../../PROMPTS_CLAUDE_CODE.md) | P1 contratos y recorrido vertical · P2 fiabilidad y panel · P3 pulido para el 29/10 · P5 casos y edición de vacantes | Commits `f1c96e8` → `b45cf73` |
| V2 (28–29/10) | [PROMPT_V2.md](../../PROMPT_V2.md) | Prompt principal (F0 → F7), despliegue, retomar | Commits `d395e45` → `f1b7c4c` |
| V3 (30/10–01/11) | [PROMPTS_BOT.md](../../PROMPTS_BOT.md) | B1 a B3 | **No se ejecutó**: la auditoría lo reemplazó por la V4 |
| V4 (02/11) | [PROMPTS_V4.md](../../PROMPTS_V4.md), [PROMPT_NOCHE_V4.md](../../PROMPT_NOCHE_V4.md) | F0 · F1 · F2 · F3 · F5 | Commits `d150102` → `06f33fd` |
| V4 F4-V (03/11) | [PROMPT_BOT_VINCULO.md](../../PROMPT_BOT_VINCULO.md) | Bot sobre el simulador, simulador sin API, auditoría | Commits `34c2314` → `0dfbd9c` |
| V4 F6 (03/11) | Prompts del formulario público y del formulario más realista | Formulario, aviso, protecciones, despliegue | Commits `b8f32b4` → `6b95cb1`. El texto del prompt no está en el repositorio |
| Entrega (11/11) | Prompt «ENTREGA FINAL» | Verificación, medición, documentación, publicación | Commits `e7a9871` → `bef30b8` |
| Segunda entrega (12/11) | Prompt «SEGUNDA ENTREGA» y ajustes | Fuentes, guía de ejecución, descargables | Rama `entrega` |
| Actualización final (12/11) | Prompt «ACTUALIZACIÓN FINAL» | Datos del equipo, oferta publicada, descargables | Rama `entrega` |

## 8.5 Reglas que se le impusieron a la IA

En [CLAUDE.md](../../CLAUDE.md) y en la sección R de [ESPECIFICACION_V4.md](../v4/ESPECIFICACION_V4.md):

- Nunca afirmar conexión ni compatibilidad comprobada con LinkedIn o BUK; todo lo externo se llama «simulado».
- Sin *scraping*, sin automatizar sesiones reales, sin abrir LinkedIn real, sin inventar rutas de BUK.
- Solo datos ficticios (`@demo.test`); nunca el nombre de la empresa.
- No debilitar pruebas; reportar exactamente qué se ejecutó.
- Etiquetar cada afirmación como Verificado, Decisión interna o Supuesto pendiente.

## 8.6 Errores de la IA detectados por las pruebas (muestra)

| Fecha | Error | Cómo se detectó | Corrección |
|---|---|---|---|
| 25/10 | Fechas desplazadas 5 h por zona horaria | Pruebas de integración | D-10 |
| 29/10 | No renovaba el token del simulador tras regenerar el secreto | Prueba nueva | D-45 |
| 03/11 | En PowerShell, `--seco` del bot **enviaba** las postulaciones | Auditoría F4-V | D-72, `7d8969b` |
| 11/11 | La entrada JSON respondía en inglés ante un obligatorio ausente | Ejemplos de Postman | `e7a9871` |
| 11/11 | El Puente programaba un aviso innecesario al Simulador LinkedIn | Capturas | `ffcafcf` |
| 11/11 | El script de medición tenía una carrera y se descartó una corrida | Revisión de los datos | [medicion/RESULTADO.md](medicion/RESULTADO.md) |

## 8.7 Confidencialidad con la IA

- Ninguna herramienta recibió credenciales reales ni datos personales de candidatos.
- Las fotos del ATS (con nombres reales) se compartieron con Claude (chat) para describir su estructura; lo guardado en [referencia-ats.md](../referencia-ats.md) no tiene nombres. Así consta en la cronología del equipo (no publicada); debe declararse en la sustentación.
- La ficha del reto se leyó solo en local y no se versiona.

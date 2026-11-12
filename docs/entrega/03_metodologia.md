# 3. Metodología: Design Thinking + Lean Startup + IA generativa

> La ruta metodológica del reto combina Design Thinking (entender y redefinir el problema), Lean Startup (hipótesis, prototipo mínimo, medición y aprendizaje) e IA generativa (declarada en [08_uso_de_ia.md](08_uso_de_ia.md)).
> Cada subsección cita **evidencia que existe en el repositorio**. Donde falta evidencia del equipo, dice **«PENDIENTE: evidencia del equipo»**; la lista completa está en [EVIDENCIA_PENDIENTE.md](EVIDENCIA_PENDIENTE.md).

## 3.1 Línea de tiempo (V1 → V4)

| Fecha (2026) | Hito | Evidencia en el repositorio |
|---|---|---|
| 15/10 | Socialización del reto; el equipo observa el ATS de la empresa (módulo Selección, tablero por etapas) | [docs/referencia-ats.md](../referencia-ats.md) (estructura, sin nombres de personas). Acta y fotos: **PENDIENTE: evidencia del equipo** |
| 24–25/10 | Primeras guías con IA (ChatGPT y Claude): investigación de Apply Connect y de la API de Selección de BUK; alternativas A–E | [docs/contratos.md](../contratos.md) (fuentes con URL y fecha). Conversaciones: **PENDIENTE: evidencia del equipo** |
| 25/10 | **V1**: una sola app que simula origen, Puente y ATS (fases P1, P2, P3, P5) | Commits `f1c96e8` → `b45cf73`; decisiones D-01 a D-19 |
| 28–29/10 | **V2**: tres sistemas independientes (Simulador LinkedIn, Simulador BUK, Puente), despliegue en Render | Commits `d395e45` → `f1b7c4c`; D-20 a D-51; [docs/v2/](../v2/) |
| 29/10 | Control de avance: la empresa indica que nunca tendrá la API de LinkedIn y pide que la postulación siga ocurriendo en LinkedIn | Registrado en [docs/v4/CONTEXTO_V4.md](../v4/CONTEXTO_V4.md) §2. Evidencia escrita: **PENDIENTE: evidencia del equipo** |
| 30/10–01/11 | **V3** (solo especificación): bot asistido con la sesión del reclutador | [docs/v3/ESPECIFICACION_BOT.md](../v3/ESPECIFICACION_BOT.md), [PROMPTS_BOT.md](../../PROMPTS_BOT.md). Nunca se construyó |
| 01–02/11 | **Auditoría externa de la V3 → V4**: el Puente es el producto, independiente de la fuente; el bot pasa a experimental y condicionado a una verificación manual (Puerta 0); importador manual legal; salida detrás de `ConectorATS` | [docs/v4/ESPECIFICACION_V4.md](../v4/ESPECIFICACION_V4.md), [docs/v4/Guia_V4_completa.docx](../v4/Guia_V4_completa.docx). Quién hizo la auditoría externa: **PENDIENTE: evidencia del equipo** |
| 02/11 | V4 F0–F3 y F5: auditoría del código, núcleo canónico, entrada genérica, importador | [docs/v4/INFORME_F0.md](../v4/INFORME_F0.md), REPORTE_F0 a F5; D-52 a D-64 |
| 03/11 | V4 F4-V: bot construido **solo sobre el simulador**, auditado (5 defectos corregidos) | [docs/v4/AUDITORIA_F4V.md](../v4/AUDITORIA_F4V.md), [docs/v4/REPORTE_F4V.md](../v4/REPORTE_F4V.md); D-65 a D-74 |
| 03/11 | **Decisión del equipo: bot descartado como vía de entrada**; entrada final = enlace externo en la oferta → formulario público del Puente → API → Simulador BUK; despliegue en Render | D-75, D-76, D-77; commits `b8f32b4`, `6b95cb1` |
| 11/11 | Verificación final, medición de criterios y documentación de entrega | [06_pruebas_y_resultados.md](06_pruebas_y_resultados.md) |

## 3.2 Design Thinking

### Empatizar

- **Hecho:** observación del ATS real en la socialización (etapas, tipos de etapa, tarjeta del postulante). El Simulador BUK reproduce esa estructura: [apps/talentia/src/modules/etapas.ts](../../apps/talentia/src/modules/etapas.ts), [docs/referencia-ats.md](../referencia-ats.md).
- **Hecho:** investigación documental de las plataformas (Microsoft Learn para LinkedIn, centro de ayuda de BUK), con URL y fecha en [docs/contratos.md](../contratos.md).
- **PENDIENTE: evidencia del equipo:** entrevistas o notas con reclutadores (cuánto tarda hoy el traslado por vacante, cuántas postulaciones por semana, qué datos se digitan), acta de socialización.

### Definir

- Reformulación del reto y restricciones: [02_problema_y_contexto.md](02_problema_y_contexto.md).
- Punto clave aprendido el 29/10: **la postulación debe seguir empezando en LinkedIn y no habrá API de LinkedIn.** Eso redefinió la pregunta de «cómo integro dos API» a «cómo llevo al ATS lo que nace en LinkedIn sin automatizar LinkedIn».

### Idear

| Momento | Alternativas evaluadas | Elegida | Evidencia |
|---|---|---|---|
| 25/10 | (A) simular LinkedIn y BUK; (B) exportar Excel al importador de BUK; (C) lector de CV con revisión humana; (D) redirigir al formulario de BUK; (E) dos capas | A, con la C como idea para después | D-01; cronología del equipo (**PENDIENTE: capturas de las conversaciones**) |
| 28/10 | Una app con módulos vs. tres sistemas independientes; servicio por eventos vs. agente de IA, RPA o n8n/Zapier | Tres sistemas; servicio por eventos, determinista y auditable | D-20 en adelante, [docs/v2/SOLUCION.md](../v2/SOLUCION.md) |
| 01/11 | Siete fuentes de candidatos (importador, bot, Apply Connect, exportación de Recruiter, correo, formulario propio, bot en la nube) con cuatro criterios | Combinación: importador indispensable + bot experimental + Apply Connect como objetivo futuro | [ESPECIFICACION_V4.md](../v4/ESPECIFICACION_V4.md) §4 |
| 03/11 | Bot sobre LinkedIn real vs. enlace externo en la oferta hacia un formulario del Puente | Enlace externo + formulario público | D-75 |

### Prototipar

Tres prototipos funcionales sucesivos (V1, V2, V4), cada uno con pruebas automáticas y desplegable. La V3 fue un prototipo en papel (especificación) que no pasó la auditoría.

### Probar

- Pruebas automatizadas en cada fase (puerta de calidad: lint, typecheck, Vitest, build y Playwright): [docs/resultados-pruebas.md](../resultados-pruebas.md), [docs/estado.md](../estado.md).
- Prueba de humo contra Render (29/10 y 03/11): [docs/despliegue.md](../despliegue.md).
- Medición de los criterios de éxito con 40+ envíos ficticios: [06_pruebas_y_resultados.md](06_pruebas_y_resultados.md).
- **PENDIENTE: evidencia del equipo:** prueba con usuarios (un reclutador o un candidato usando el formulario y el panel), observaciones y cambios que provocó.

## 3.3 Lean Startup (construir → medir → aprender)

| Ciclo | Hipótesis | Qué se construyó | Qué se midió / aprendió | Decisión |
|---|---|---|---|---|
| 1 · V1 (25/10) | «Si el ATS tiene API, un servicio puede llevar cada postulación a Postulantes sin intervención y sin duplicados» | App única con origen, Puente y ATS simulados | 8/8 criterios del 29/10 en pruebas; idempotencia, reintentos y reconciliación funcionan | Perseverar, pero separar los sistemas |
| 2 · V2 (28–29/10) | «El Puente funciona contra sistemas que se comportan como los reales (sesión, API Key, webhook firmado)» | Tres apps, conexiones cifradas, despliegue en Render | 166 pruebas en verde; humo en Render; arranque en frío medido (65–92 s) | Perseverar en el Puente |
| 3 · V3 (30/10–01/11) | «Un bot con la sesión del reclutador puede traer los postulantes de LinkedIn» | Solo especificación | Auditoría externa: riesgo legal (cláusula 8.2), dependencia de la Puerta 0 y de la interfaz de LinkedIn | **Pivote**: el Puente se vuelve independiente de la fuente (V4) |
| 4 · V4 (02–03/11) | «Con un contrato canónico, cualquier fuente (importador, JSON, Apply Connect, bot) llega al ATS por el mismo camino» | Núcleo canónico, entrada genérica, importador, `ConectorATS`, bot sobre el simulador | 313 → 328 pruebas; el bot funcionó en el simulador pero la Puerta 0 nunca se completó ([PUERTA0.md](../v4/PUERTA0.md) está vacía) | **Pivote de la entrada**: bot descartado (D-75) |
| 5 · Formulario (03/11) | «Si la oferta de LinkedIn enlaza a un formulario del Puente, el candidato se postula desde LinkedIn y el traslado al ATS es 100 % automático, sin infringir términos» | Formulario público, aviso de privacidad, protecciones, despliegue | Humo en Render 5/5 (03/11); criterios medidos el 11/11 ([06](06_pruebas_y_resultados.md)) | Solución entregada |

**Métricas de éxito** (las que la evaluación de la ficha pidió separar): porcentaje de postulaciones registradas sin error en el ATS, tiempo de registro por candidato y porcentaje de campos mapeados correctamente. Medidas en local el 11/11/2026: [06_pruebas_y_resultados.md](06_pruebas_y_resultados.md) §6.3.

**Lo que no se pudo medir:** el ahorro real de horas del reclutador, porque no hay línea base de la empresa (**PENDIENTE: evidencia del equipo**).

## 3.4 El bot: por qué se construyó y por qué se descartó

1. **Por qué apareció (V3):** tras el 29/10, la única forma de traer automáticamente los postulantes que se quedan en LinkedIn, sin su API, era leer la página del reclutador.
2. **Qué dijo la auditoría (V4):** la cláusula 8.2 del Acuerdo de Usuario de LinkedIn prohíbe bots; además dependía de verificar a mano qué deja ver y descargar una vacante gratuita (Puerta 0). La V4 lo dejó **experimental y condicionado**.
3. **Qué se construyó (03/11):** el bot con perfiles de sitio; el perfil «simulador» funciona y está probado (BV-1 a BV-7); el perfil LinkedIn es un esqueleto que **se niega a correr** sin la Puerta 0. Claude Code nunca abrió LinkedIn real. Evidencia: [docs/v4/AUDITORIA_F4V.md](../v4/AUDITORIA_F4V.md), [docs/manuales/bot.md](../manuales/bot.md).
4. **Por qué se descartó (D-75):** la Puerta 0 no se completó; aun completada, el bot exigiría una sesión humana en cada corrida y arriesgaría la cuenta. El enlace externo en la oferta es una función estándar de LinkedIn, no automatiza nada y lleva al candidato a entregar sus datos y su autorización directamente a la empresa.
5. **Qué queda:** el código del bot sigue en el repositorio (`apps/bot-linkedin`) como **alternativa evaluada**, no desplegada y fuera de la solución.

## 3.5 IA generativa en la metodología

La IA se usó para investigar, comparar alternativas, especificar, programar, probar y documentar; el equipo eligió el enfoque, aprobó los pivotes y los despliegues. Detalle, prompts por fase y límites en [08_uso_de_ia.md](08_uso_de_ia.md).

## 3.6 Trazabilidad de decisiones

Las 77 decisiones (D-01 a D-77) están en [docs/decisiones.md](../decisiones.md), cada una con la alternativa descartada y su motivo. Las de mayor peso:

| Decisión | Qué | Por qué |
|---|---|---|
| D-01 | Simular LinkedIn y BUK | Sin acceso a ninguna de las dos API |
| D-20 | Tres sistemas independientes | Realismo; el Puente queda como producto separable |
| D-52–D-56 | Contrato canónico y `ConectorATS`; BUK deshabilitado | El núcleo no conoce la fuente ni el ATS; nada de BUK sin documentación |
| D-61 | Posible duplicado → revisión humana | Nunca fusionar en silencio |
| D-68 | Simulador LinkedIn sin API por defecto | Así es LinkedIn real para la empresa |
| D-74 | Nombres visibles «Simulador LinkedIn» / «Simulador BUK» | Decisión del equipo; siempre con «Simulador» |
| D-75 | Bot descartado; formulario público con enlace externo | Términos de uso, sesión humana, Puerta 0 incompleta |
| D-76 | Protecciones del formulario | Abuso, tamaño, PDF falso, envíos automáticos |

# 3. Metodología: Design Thinking + Lean Startup + IA generativa

> La ruta del reto combina Design Thinking (entender y redefinir el problema), Lean Startup (construir, medir y aprender) e IA generativa (declarada en [08_uso_de_ia.md](08_uso_de_ia.md)).
> **Regla de este documento:** solo se afirma lo que consta en el repositorio, en su historial de git o en la ficha del reto. El equipo **no se comunicó por correo ni por mensaje con la empresa**; lo que se sabe de ella viene de la ficha del reto, de la socialización presencial del 15/10 y del control de avance del 29/10, y en estos dos últimos casos **según lo entendido por el equipo, sin evidencia escrita**. Lo que no consta dice **PENDIENTE** y está en [EVIDENCIA_PENDIENTE.md](EVIDENCIA_PENDIENTE.md).
> **Apoyo de IA:** el desarrollo y la redacción se hicieron con apoyo **mayoritario** de IA (§3.7).

## 3.1 Línea de tiempo del proyecto (V1 → V2 → V3 → V4 → formulario público)

| Fecha (2026) | Hito | Fuente |
|---|---|---|
| 13/10 | Emisión de la ficha del reto | Ficha del reto (no se publica) |
| 15/10 | Socialización presencial del reto. El equipo fotografía la pantalla del ATS de la empresa (módulo Selección, tablero por etapas) | [docs/referencia-ats.md](../referencia-ats.md) (estructura descrita sin nombres; las fotos no se versionan porque tienen datos personales) |
| 24–25/10 | Primeras guías con IA (ChatGPT y Claude chat), investigación de Apply Connect y de la API de Selección de BUK, alternativas A–E | [docs/contratos.md](../contratos.md) (fuentes con URL y fecha). Conversaciones: **PENDIENTE** (capturas, ver [GUIA_CAPTURAS.md](GUIA_CAPTURAS.md)) |
| 25/10 | **V1**: una sola aplicación que simula origen, Puente y ATS | Commits `f1c96e8` (16:30) → `b45cf73` (19:07); D-01 a D-19 |
| 28–29/10 | **V2**: tres sistemas independientes (Simulador LinkedIn, Simulador BUK, Puente) y despliegue en Render | Commits `d395e45` (28/10 20:41) → `f1b7c4c` (29/10 06:57); D-20 a D-51; [docs/v2/](../v2/) |
| 29/10 | Control de avance. Se reafirma que no habrá API de LinkedIn (así lo dice la ficha del reto, numeral 2.8). Que la postulación deba seguir empezando en LinkedIn es lo entendido por el equipo, sin evidencia escrita | Ficha del reto, numeral 2.8; [docs/v4/CONTEXTO_V4.md](../v4/CONTEXTO_V4.md) §2. **PENDIENTE: el equipo debe confirmar cómo supo lo segundo** |
| 30/10–01/11 | **V3** (solo especificación): bot asistido con la sesión del reclutador | [docs/v3/ESPECIFICACION_BOT.md](../v3/ESPECIFICACION_BOT.md), [PROMPTS_BOT.md](../../PROMPTS_BOT.md). Nunca se construyó |
| 01–02/11 | **Auditoría externa de la V3 → V4**: el Puente se vuelve independiente de la fuente; el bot pasa a experimental (condicionado a la Puerta 0); importador manual; salida detrás de `ConectorATS` | [docs/v4/ESPECIFICACION_V4.md](../v4/ESPECIFICACION_V4.md), [Guia_V4_completa.docx](../v4/Guia_V4_completa.docx). **PENDIENTE:** quién la hizo y con qué herramienta (Figura 3.1, pendiente de insertar) |
| 02/11 | V4 F0–F3 y F5 | Commits `d150102` (17:10) → `06f33fd` (18:17); D-52 a D-64 |
| 03/11 | V4 F4-V: bot construido **solo sobre el simulador** y auditado (5 defectos corregidos); nombres visibles «Simulador LinkedIn/BUK» | Commits `34c2314` (07:47) → `0dfbd9c` (12:12); D-65 a D-74 |
| 03/11 | **Decisión del equipo: bot descartado**; entrada final = enlace externo en la oferta → formulario público del Puente → API → Simulador BUK; despliegue en Render | D-75 a D-77; commits `b8f32b4` (15:24) → `6b95cb1` (16:35) |
| 04–10/11 | Sin commits en el repositorio | Historial de git. Lo que hizo el equipo en esos días (por ejemplo, la cuenta de LinkedIn): **PENDIENTE** |
| 11/11 | Verificación final, medición de criterios, 2 defectos corregidos, documentación de entrega | Commits `e7a9871` → `bef30b8` |
| 12/11 | Segunda entrega de documentación y descargables | Rama `entrega` |
| 13/11 | Entrega y sustentación | Ficha del reto |

## 3.2 Cronograma real frente al plan

| Fase | Plan (ESPECIFICACION_V4 §14) | Real (historial de git) |
|---|---|---|
| Puerta 0 (verificación manual en LinkedIn) | 2–3/11 | **No se completó**: [PUERTA0.md](../v4/PUERTA0.md) está vacía |
| F0 auditoría y F1 núcleo | 2–3/11 | 02/11, 17:10–17:29 |
| F2 entrada genérica | 4/11 | 02/11, 17:55 |
| F3 importador | 5/11 | 02/11, 18:13 |
| F4 bot (si pasa la Puerta 0) | 6–7/11 | 03/11, 07:47–08:38, **solo contra el simulador** |
| F5 despliegue y documentación | 8/11 | Documentación el 02/11; despliegue el 03/11 (F6) |
| Código congelado | 9/11 | Último commit de producto el 03/11; dos arreglos el 11/11 (solo en la rama `entrega`) |
| Documentos y ensayo | 9–12/11 | Documentos el 11–12/11; ensayo: **PENDIENTE** |

Las horas reales que dedicó cada integrante no constan: **PENDIENTE**.

## 3.3 Design Thinking, fase por fase

| Fase | Lo que de verdad ocurrió | Evidencia | Lo que no consta |
|---|---|---|---|
| **Empatizar** | Lectura de la ficha; socialización presencial del 15/10 con observación del ATS de la empresa; investigación documental de LinkedIn y BUK | Ficha (no se publica); [referencia-ats.md](../referencia-ats.md); [contratos.md](../contratos.md) | No hubo entrevistas ni comunicación escrita con la empresa. **PENDIENTE:** qué se escuchó en la socialización y si existe un acta oficial del programa |
| **Definir** | Reformulación: llevar al ATS lo que nace en LinkedIn **sin** su API y sin automatizar LinkedIn | [02_problema_y_contexto.md](02_problema_y_contexto.md); D-01; D-75 | **PENDIENTE:** el lienzo inicial del reto (12 bloques) que pide la ficha |
| **Idear** | Cuatro rondas de alternativas (§3.5) | D-01, D-20, ESPECIFICACION_V4 §4, D-75 | Las conversaciones donde se compararon: **PENDIENTE** (capturas) |
| **Prototipar** | Tres prototipos funcionales (V1, V2, V4) y uno en papel (V3) | Historial de git; [docs/v2](../v2/), [docs/v3](../v3/), [docs/v4](../v4/) | — |
| **Probar** | Pruebas automáticas en cada fase; humo en Render; medición de criterios con 45 envíos ficticios; prueba del sistema por el equipo | [06](06_pruebas_y_resultados.md); [docs/estado.md](../estado.md) | **PENDIENTE:** prueba con usuarios (un reclutador o un candidato) y lo que se cambió por ella; ensayos de la demo hechos por el equipo |

## 3.4 Lean Startup (construir → medir → aprender)

> **Aclaración:** no consta un registro de hipótesis escrito **antes** de cada ciclo. Las hipótesis de esta tabla se formulan de forma **retrospectiva**, a partir de lo que se construyó y se midió. Si el equipo tiene el lienzo inicial o notas con hipótesis previas, deben reemplazar esta tabla (**PENDIENTE**).

| Ciclo | Hipótesis (retrospectiva) | Qué se construyó | Qué se midió | Qué se aprendió / decisión |
|---|---|---|---|---|
| 1 · V1 (25/10) | Un servicio puede llevar cada postulación a Postulantes sin intervención y sin duplicados | App única con origen, Puente y ATS simulados | 8/8 criterios del 29/10 en pruebas; idempotencia, reintentos y reconciliación | Perseverar, pero separar los sistemas para que el Puente sea un producto aparte |
| 2 · V2 (28–29/10) | El Puente funciona contra sistemas que se comportan como los reales (sesión, API Key, webhook firmado) | Tres apps, conexiones cifradas, Render | 166 pruebas; humo en Render; arranque en frío de 65–92 s | Funciona, pero depende de Apply Connect, que no se usará: según la ficha del reto, numeral 2.8, no se conectará la API directa de LinkedIn |
| 3 · V3 (30/10–01/11) | Un bot con la sesión del reclutador puede traer los postulantes de LinkedIn | Solo especificación | Auditoría externa: riesgo legal (cláusula 8.2) y dependencia de la Puerta 0 | **Pivote**: el Puente independiente de la fuente (V4) |
| 4 · V4 (02–03/11) | Con un contrato canónico, cualquier fuente llega al ATS por el mismo camino | Núcleo canónico, entrada genérica, importador, `ConectorATS`, bot sobre el simulador | 166 → 328 pruebas; el bot funcionó solo en el simulador; la Puerta 0 no se hizo | **Pivote de la entrada**: bot descartado (D-75) |
| 5 · Formulario (03/11) | Si la oferta enlaza a un formulario del Puente, el traslado al ATS es automático y sin infringir términos | Formulario público, aviso de privacidad, protecciones, despliegue | Humo en Render 5/5 (03/11 y 11/11); 45/45 registradas, mediana 1,16 s, 450/450 campos (11/11) | Solución entregada |

**Métricas de éxito** (las que pide separar la evaluación de la ficha): porcentaje de postulaciones registradas sin error en el ATS, tiempo de registro por candidato y porcentaje de campos mapeados correctamente. Resultados en [06](06_pruebas_y_resultados.md) §6.3.

**Lo que no se pudo medir:** el ahorro real de horas del reclutador, porque no hay línea base de la empresa (**PENDIENTE**), y el comportamiento de candidatos reales.

## 3.5 Alternativas evaluadas y por qué se eligió cada una

| Momento | Alternativa | Resultado | Motivo | Fuente |
|---|---|---|---|---|
| 25/10 | (A) Simular LinkedIn y BUK y construir el Puente | **Elegida** | Sin acceso a ninguna de las dos API; la ficha ya permite simular LinkedIn con JSON | D-01 |
| 25/10 | (B) Exportar un Excel para la carga masiva de BUK | Descartada | No elimina la descarga; queda como plan alternativo si no hay API | Cronología del equipo (no publicada); [10](10_trabajo_futuro.md) |
| 25/10 | (C) Lector de CV con revisión humana | Pospuesta → importador de la V4 | Útil cuando ya hay PDF descargados | D-62 a D-64 |
| 25/10 | (D) Redirigir al formulario de BUK | Descartada entonces | Quien usa la postulación rápida de LinkedIn no pasa por BUK | [docs/v2/SOLUCION.md](../v2/SOLUCION.md) §2 |
| 25/10 | (E) Solución en dos capas | Integrada en la V4 (fuentes + núcleo) | — | ESPECIFICACION_V4 §5 |
| 28/10 | Una app con módulos (V1) vs. **tres sistemas** | Tres sistemas | El Puente queda separable y la demo es realista | D-20 |
| 28/10 | **Servicio por eventos** vs. consulta periódica, n8n/Zapier, agente de IA, automatizar el navegador | Servicio por eventos | Determinista y auditable; mismo modelo que Apply Connect | Cronología del equipo (no publicada); D-20 |
| 28/10 | **Render gratuito** vs. Vercel o Railway | Render | Vercel no mantiene el worker; Railway tiene costo | Cronología del equipo (no publicada); [despliegue.md](../despliegue.md) |
| 01/11 | Importador manual | **Indispensable** | Legal, siempre disponible, no depende de selectores | ESPECIFICACION_V4 §4 |
| 01/11 | Bot asistido | Experimental, condicionado | Infringe la cláusula 8.2 de LinkedIn; depende de la Puerta 0 | ESPECIFICACION_V4 §4; D-65 |
| 01/11 | Apply Connect oficial | Objetivo futuro (simulado) | Depende de BUK y LinkedIn | ESPECIFICACION_V4 §4 |
| 01/11 | Exportación de Recruiter, correo de notificación | Opcional / condicionado | Requiere licencia o evidencia | ESPECIFICACION_V4 §4 |
| 01/11 | Formulario propio, bot en la nube, extensión de navegador | Descartadas entonces | Sacan al candidato de LinkedIn o infringen términos | ESPECIFICACION_V4 §4 |
| 03/11 | Bot sobre LinkedIn real vs. **enlace externo en la oferta hacia un formulario del Puente** | Formulario | No automatiza LinkedIn; la postulación empieza en la oferta de LinkedIn; el candidato autoriza directamente | D-75 |
| 03/11 | CAPTCHA de terceros vs. protecciones propias | Protecciones propias | No enviar datos del candidato a otro proveedor | D-76 |

**Nota sobre el formulario:** el 01/11 la especificación descartaba el «formulario propio» porque sacaba al candidato de LinkedIn. El 03/11 se adoptó una variante distinta: la postulación **empieza** en la oferta de LinkedIn y continúa en el formulario por un enlace externo, una opción estándar de la oferta. Que esa opción esté disponible en la cuenta de la empresa: **PENDIENTE** (Figura 3.2, pendiente de insertar).

## 3.6 El bot: por qué se construyó y por qué se descartó

1. **Por qué apareció (V3):** tras el 29/10, la única forma de traer automáticamente los postulantes que se quedan en LinkedIn, sin su API, era leer la página del reclutador.
2. **Qué dijo la auditoría (V4):** la cláusula 8.2 del Acuerdo de Usuario de LinkedIn prohíbe bots; además dependía de verificar a mano qué deja ver una vacante gratuita (Puerta 0). Quedó **experimental y condicionado**.
3. **Qué se construyó (03/11):** el bot con perfiles de sitio. El perfil del simulador funciona y está probado; el perfil LinkedIn es un esqueleto que **se niega a correr**. Claude Code nunca abrió LinkedIn real. Evidencia: [AUDITORIA_F4V.md](../v4/AUDITORIA_F4V.md), [manuales/bot.md](../manuales/bot.md).
4. **Por qué se descartó (D-75):** la Puerta 0 no se completó; aun completada, el bot exigiría una sesión humana en cada corrida y arriesgaría la cuenta.
5. **Qué queda:** el código en `apps/bot-linkedin` como alternativa evaluada, no desplegada.

La conversación donde el equipo tomó esta decisión: **PENDIENTE** (Figura 3.3, pendiente de insertar).

## 3.7 Papel de la IA en la metodología

El desarrollo y la redacción se hicieron con **apoyo mayoritario de IA**: Claude Code programó, probó y documentó siguiendo especificaciones por fases; Claude (chat) apoyó el diseño, la auditoría y la redacción de los prompts; ChatGPT se usó al inicio. El equipo definió el problema, eligió entre alternativas, dirigió cada fase, probó el sistema y tomó las decisiones. Detalle y tabla en [08_uso_de_ia.md](08_uso_de_ia.md).

## 3.8 Trazabilidad

Las 77 decisiones están en [docs/decisiones.md](../decisiones.md), cada una con la alternativa descartada y el motivo; índice en [16_anexo_decisiones.md](16_anexo_decisiones.md). Las lecciones aprendidas están en [15_lecciones_aprendidas.md](15_lecciones_aprendidas.md).

# Evidencia pendiente del equipo

> Lo que la documentación no puede afirmar sin aporte del equipo. **No inventar ni completar por inferencia.**
> **El equipo no se comunicó por correo ni por mensaje con la empresa.** Por eso aquí no se piden correos ni actas de comunicaciones que no existen: se pide confirmar **cómo se supo** cada cosa.
> Las capturas se toman según [GUIA_CAPTURAS.md](GUIA_CAPTURAS.md) y se guardan en [docs/evidencia/](../evidencia/).

## A. Cómo se supo (fuentes sin evidencia escrita)

| # | Afirmación | Fuente actual | Qué debe confirmar el equipo |
|---|---|---|---|
| A1 | El equipo no tiene una llave de la API de BUK | **Resuelto (12/11):** según la ficha del reto, numeral 2.8, el acceso a la API REST de BUK es controlado y guiado por un gestor acompañante. No se afirma que la empresa se haya negado | — |
| A2 | No habrá API de LinkedIn; la postulación debe seguir empezando en LinkedIn (29/10) | Lo primero: según la ficha del reto, numeral 2.8. Lo segundo: según lo entendido por el equipo; sin evidencia escrita | **PENDIENTE: cómo se supo** lo de «la postulación debe seguir en LinkedIn» |
| A3 | El ATS de la empresa tiene las etapas descritas en `referencia-ats.md` | Fotos tomadas por el equipo en la socialización del 15/10 (no se versionan) | Conservar las fotos fuera del repositorio; confirmar la fecha |
| A4 | La aceptación de simular ambos extremos (D-01) por parte de la empresa y del mentor | No consta | **PENDIENTE**: si hubo una indicación oral, decir de quién y cuándo; si no, dejarlo como no confirmado |

## B. Metodología

| # | Qué falta | Dónde se cita | Qué aportar |
|---|---|---|---|
| B1 | Qué se observó y escuchó en la socialización del 15/10 (y si existe un acta oficial del programa CUEE) | [03](03_metodologia.md) §3.3 | Notas del equipo con fecha |
| B2 | Línea base: horas por vacante y postulaciones por semana del traslado manual | [02](02_problema_y_contexto.md), [03](03_metodologia.md) §3.4 | Solo si se obtiene de una fuente citable; si no, queda sin dato |
| B3 | Lienzo inicial del reto (12 bloques) e hipótesis escritas antes de cada ciclo | [03](03_metodologia.md) §3.3 y §3.4 | Foto o transcripción; si no existe, se mantiene la aclaración de que las hipótesis son retrospectivas |
| B4 | Quién hizo la **auditoría externa** de la V3 que originó la V4, con qué herramienta y su documento | [03](03_metodologia.md) §3.1 | Captura o documento ([GUIA_CAPTURAS](GUIA_CAPTURAS.md) d y f) |
| B5 | Resultado de la **Puerta 0** o constancia de que no se hizo y por qué | [PUERTA0.md](../v4/PUERTA0.md) (vacía) | Llenarla o escribir la razón |
| B6 | Prueba con usuarios del formulario y del panel (aunque sea con integrantes) | [03](03_metodologia.md) §3.3 | Observaciones, fecha y cambios que provocaron |
| B7 | Qué hizo el equipo entre el 04/11 y el 10/11 (no hay commits) | [03](03_metodologia.md) §3.1 | Breve relato con fechas |
| B8 | Ensayos de la demo | [03](03_metodologia.md) §3.2 | Fechas y duración |

## C. Uso de IA

| # | Qué falta | Dónde se cita | Qué aportar |
|---|---|---|---|
| C1 | Guía inicial de ChatGPT (24/10) y prompt de solución (25/10) | [08](08_uso_de_ia.md) §8.3 | Archivos o capturas |
| C2 | Revisión con ChatGPT hecha por una persona del equipo o un conocido | [08](08_uso_de_ia.md) §8.3 | Documento o conversación, si existe |
| C3 | Capturas de los momentos clave en Claude (chat) | [08](08_uso_de_ia.md) §8.3 | [GUIA_CAPTURAS](GUIA_CAPTURAS.md) d |
| C4 | Texto de los prompts de la fase F6 (formulario público) | [08](08_uso_de_ia.md) §8.4 | El prompt tal como se pegó |
| C5 | Qué revisó cada integrante (código, documentos, pantallas) | [08](08_uso_de_ia.md) §8.1 | Tabla integrante → qué revisó y fecha. No exagerar |
| C6 | Planes de IA usados y si hubo pago | [10](10_trabajo_futuro.md) §10.2 | Dato del equipo |

## D. Equipo, LinkedIn y validaciones externas

| # | Qué falta | Dónde se cita | Qué aportar |
|---|---|---|---|
| D1 | Integrantes, roles, horas por integrante, nombre del equipo, mentor y experto temático | README, [03](03_metodologia.md) §3.2 | Lista (decidir qué se publica) |
| D2 | Capturas de LinkedIn: borrador de la oferta con enlace externo, pantalla de verificación de la cuenta, oferta publicada si se publica | [04](04_solucion_y_arquitectura.md), [14](14_preguntas_sustentacion.md) | [GUIA_CAPTURAS](GUIA_CAPTURAS.md) a–c |
| D3 | Si hubo promoción pagada de la oferta en LinkedIn | [10](10_trabajo_futuro.md) §10.2 | Sí/no y monto |
| D4 | Validación legal del aviso de privacidad | [07](07_seguridad_y_privacidad.md) | Concepto del área legal de la empresa (fuera del alcance del equipo) |
| D5 | Correo real de privacidad (`PRIVACIDAD_CORREO` en Render) | [07](07_seguridad_y_privacidad.md) | Correo; configurarlo en Render |
| D6 | Encabezado de IP confiable en Render | [07](07_seguridad_y_privacidad.md) §7.3 | Prueba o documentación de Render |
| D7 | Llave y `/apidocs` de BUK | [09](09_riesgos_y_limitaciones.md), [10](10_trabajo_futuro.md) | Solo si la empresa la entrega; nunca en el repositorio |

## E. Frases reescritas el 12/11/2026 por no tener evidencia de contacto con la empresa

| Archivo | Decía | Ahora dice |
|---|---|---|
| `README.md` | «No hay API de LinkedIn para la empresa y el equipo no recibió la llave de la API de BUK.» | «…La API de reclutamiento de LinkedIn es solo para socios aprobados (verificado en Microsoft Learn) y el equipo no tiene una llave de la API de BUK (según lo entendido por el equipo, no se entregaría; sin evidencia escrita).» (y «Según la ficha del reto» para los 2–4 días) |
| `docs/entrega/01_resumen.md` | «…y el equipo no recibió la llave de la API de BUK.» | «…y el equipo no tiene una llave de la API de BUK.» (resumen reescrito completo) |
| `docs/entrega/02_problema_y_contexto.md` | «Declarado por la empresa» / «Declarado, sin cifra» / «Declarado» | «Según la ficha del reto» (×3) |
| `docs/entrega/02_problema_y_contexto.md` | «La empresa no entregó la llave de la API de BUK · Dicho al equipo (fecha y canal: PENDIENTE…)» | «El equipo no tiene la llave de la API de BUK · Según lo entendido por el equipo, no se entregaría; sin evidencia escrita… PENDIENTE: el equipo debe confirmar cómo se supo» |
| `docs/entrega/03_metodologia.md` | «Control de avance: la empresa indica que nunca tendrá la API de LinkedIn y pide que la postulación siga ocurriendo en LinkedIn» | «Control de avance. Según lo entendido por el equipo (sin evidencia escrita): no habrá API de LinkedIn y la postulación debe seguir empezando en LinkedIn» (documento reescrito completo) |
| `docs/entrega/03_metodologia.md` | «PENDIENTE: … entrevistas o notas con reclutadores …, acta de socialización» | «No hubo entrevistas ni comunicación escrita con la empresa. PENDIENTE: qué se escuchó en la socialización y si existe un acta oficial del programa» |
| `docs/entrega/12_demo.md` | «No hay API de LinkedIn para la empresa ni llave de BUK para nosotros.» | «La API de LinkedIn es solo para socios aprobados y no tenemos una llave de la API de BUK.» |
| `docs/entrega/EVIDENCIA_PENDIENTE.md` | Pedía «Correo o mensaje», «Acta, correo o notas» y «entrevistas» | Pide confirmar **cómo se supo** (este documento) |
| `docs/decisiones.md` (D-01) | «El equipo informa que la empresa no facilitará la API de BUK por seguridad.» | «Según lo entendido por el equipo (sin evidencia escrita…), la API de BUK no se facilitaría por seguridad. PENDIENTE: el equipo debe confirmar cómo se supo.» |
| `docs/v2/SOLUCION.md` | «…una API Key que la empresa genera y que, por seguridad, no nos entregó.» | «…una API Key que la empresa genera y que el equipo no tiene (según lo entendido por el equipo, no se entregaría por seguridad; sin evidencia escrita).» |
| `docs/v2/SOLUCION.md` | «La empresa informó que no puede darnos la API Key por seguridad (PENDIENTE: evidencia escrita con fecha)» | «Según lo entendido por el equipo, la API Key no se entregaría por seguridad; sin evidencia escrita (PENDIENTE: el equipo debe confirmar cómo se supo)» |
| `docs/guion-demo.md` | «La empresa no puede darnos la API de BUK…» | «No tenemos una llave de la API de BUK…» |
| `docs/guion-demo.md` | «…y la empresa no la facilitará (D-01).» | «…y, según lo entendido por el equipo, la llave no se facilitaría; sin evidencia escrita (D-01).» |
| `docs/v4/CONTEXTO_V4.md` | «Después del control del 29/10 la empresa dijo que nunca tendrá la API de LinkedIn y pidió una alternativa…» | «Después del control del 29/10, según lo entendido por el equipo (sin evidencia escrita), no habrá API de LinkedIn y se busca una alternativa…» |
| `docs/v4/CONTEXTO_V4.md` | «La empresa no entrega la llave.» | «El equipo no tiene la llave (según lo entendido por el equipo, no se entregaría; sin evidencia escrita).» |
| `docs/v4/CONTEXTO_V4.md` | «Evidencia escrita de la empresa (sin API de LinkedIn, sin llave de BUK)» | «Cómo se supo que no habrá API de LinkedIn ni llave de BUK (no hay evidencia escrita…)» |
| `docs/v4/ESPECIFICACION_V4.md` | «La empresa pide que la postulación siga ocurriendo en LinkedIn… (instrucción después del 29/10…)» | «Según lo entendido por el equipo después del 29/10 (sin evidencia escrita: Hipótesis), la postulación debe seguir ocurriendo en LinkedIn…» |
| `docs/v4/ESPECIFICACION_V4.md` | «Descartado: la empresa exige LinkedIn» | «Descartado: según lo entendido por el equipo (sin evidencia escrita), la postulación debe empezar en LinkedIn» |
| `PROMPTS_CLAUDE_CODE.md` | «…la empresa no la facilitará por seguridad…» | **No se reescribió** (es el texto del prompt tal como se usó); se agregó una nota al inicio que lo aclara |

En cada documento del equipo modificado se agregó una nota «Actualizado por Claude Code (2026-11-12)».

### Ajuste del 12/11/2026 (fuentes de la ficha)

La ficha del reto, numeral 2.8 (Restricciones), dice que no se conectará la API directa de LinkedIn por limitaciones normativas y de acceso a credenciales, que las postulaciones se simulan con *payloads* JSON, y que la integración con BUK es solo por su API REST bajo acceso controlado y guiado por un gestor acompañante. Por eso, en el README, `01_resumen`, `02`, `03`, `14`, `RESUMEN_DOCENTE`, este documento (A1 y A2), `decisiones.md` (D-01), `guion-demo.md`, `v2/SOLUCION.md` (2 frases), `v4/CONTEXTO_V4.md` (2 frases), `v4/ESPECIFICACION_V4.md` y la nota de `PROMPTS_CLAUDE_CODE.md`, lo relativo a la API de LinkedIn y a la llave de BUK ya no dice «sin evidencia escrita» ni «no se entregaría por seguridad»: cita «según la ficha del reto, numeral 2.8» y que el equipo no tiene llave. **No se afirma que la empresa se haya negado.** Sigue sin evidencia escrita solo que la postulación deba seguir empezando en LinkedIn (A2).

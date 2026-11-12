# Evidencia pendiente del equipo

> Lo que la documentación de entrega no puede afirmar sin aporte del equipo. Cada ítem dice dónde se cita y qué hay que aportar. **No inventar ni completar por inferencia.** Las capturas con datos reales (nombres de candidatos, URL de la instancia del ATS, contactos de la empresa) se difuminan antes de cualquier uso.

## Metodología (rigor metodológico, 15 %)

| # | Qué falta | Dónde se cita | Qué aportar |
|---|---|---|---|
| 1 | Acta o notas de la socialización del 15/10 | [03_metodologia.md](03_metodologia.md) §3.1 y §3.2 «Empatizar» | Acta, fotos difuminadas o notas con fecha |
| 2 | Entrevistas o conversaciones con reclutadores | §3.2 «Empatizar» | Preguntas, respuestas resumidas, fecha y rol (sin nombres si no autorizan) |
| 3 | **Línea base**: horas por vacante y postulaciones por semana del traslado manual | [02_problema_y_contexto.md](02_problema_y_contexto.md) §2.1; §3.3 | Dato de la empresa con fecha y fuente |
| 4 | Evidencia escrita de que la empresa no entregaría la llave de BUK (quién, cuándo, canal) | [02](02_problema_y_contexto.md) §2.3 | Correo o mensaje (difuminado) |
| 5 | Evidencia del control del 29/10 (no habrá API de LinkedIn; la postulación debe empezar en LinkedIn) | §3.1 | Acta, correo o notas |
| 6 | Quién hizo la **auditoría externa** de la V3 que dio origen a la V4, y su documento | §3.1, §3.4 | Nombre del revisor o rol, fecha y documento |
| 7 | Lienzo inicial del reto (12 bloques) diligenciado | §3.2 | Foto o transcripción |
| 8 | Prueba con usuarios del formulario y del panel (aunque sea con integrantes) | §3.2 «Probar» | Observaciones, fecha y cambios que provocaron |
| 9 | Resultado de la **Puerta 0** (verificación manual en LinkedIn) o constancia de que no se hizo y por qué | [docs/v4/PUERTA0.md](../v4/PUERTA0.md) está vacía; §3.3 y §3.4 | Llenarla o escribir la razón |

## Uso de IA (rigor metodológico)

| # | Qué falta | Dónde se cita | Qué aportar |
|---|---|---|---|
| 10 | Guía inicial de ChatGPT (24/10) y prompt de solución (25/10) | [08_uso_de_ia.md](08_uso_de_ia.md) §8.1 | Los archivos o capturas |
| 11 | Capturas de las conversaciones con Claude (chat) | §8.1 | Capturas sin datos sensibles |
| 12 | Texto del prompt de la fase F6 (formulario público) | §8.3 | El prompt tal como se pegó |
| 13 | Qué revisó cada integrante del código y de los documentos | §8.2, §8.7 | Tabla nombre/rol → qué revisó y fecha |

## Equipo y validaciones externas

| # | Qué falta | Dónde se cita | Qué aportar |
|---|---|---|---|
| 14 | Integrantes, roles, dedicación, nombre del equipo, mentor y experto temático | [README.md](../../README.md) | Lista (en el repositorio privado; decidir qué se publica) |
| 15 | Validación legal del aviso de privacidad (Ley 1581 de 2012) | [07_seguridad_y_privacidad.md](07_seguridad_y_privacidad.md) | Concepto del área legal de la empresa |
| 16 | Correo real de privacidad | §7.2 | Correo; ponerlo en Render → `puente-postulaciones` → Environment → `PRIVACIDAD_CORREO` |
| 17 | Verificación de la cuenta de LinkedIn de la empresa (que la oferta admita enlace externo) | [04](04_solucion_y_arquitectura.md) §4.1 | Captura de la configuración de una oferta (difuminada) |
| 18 | Llave y `/apidocs` de BUK | [09](09_riesgos_y_limitaciones.md), [10](10_trabajo_futuro.md) | Solo si la empresa la entrega, por un canal privado, nunca en el repositorio |
| 19 | Encabezado de IP confiable en Render (límite por IP) | §7.3 | Prueba en Render o soporte de Render |

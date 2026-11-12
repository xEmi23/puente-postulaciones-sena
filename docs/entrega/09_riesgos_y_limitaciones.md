# 9. Riesgos y limitaciones

> Criticidad = probabilidad × impacto (Baja 1, Media 2, Alta 3): **Crítica ≥ 6**, Alta 4, Media 2–3. Basado en la matriz de [ESPECIFICACION_V4.md](../v4/ESPECIFICACION_V4.md) §12, actualizada al flujo final (formulario público).

## 9.1 Limitaciones (lo que el prototipo NO hace)

| Limitación | Consecuencia | Qué haría falta |
|---|---|---|
| **No hay conexión con BUK real.** El destino es el Simulador BUK; el adaptador de BUK está deshabilitado y vacío | No se puede afirmar que funcione con el ATS de la empresa | **PENDIENTE:** llave de la API y `/apidocs` de la cuenta de BUK de la empresa, en un entorno de pruebas con acompañamiento |
| **No hay conexión con la API de LinkedIn.** El candidato llega por el enlace externo de la oferta (publicada) | Quien usa «Solicitud sencilla» dentro de LinkedIn no pasa por el Puente | Mantener la oferta con enlace externo |
| El candidato llena un formulario más (además de ver la oferta) | Puede bajar la tasa de postulación frente a «Solicitud sencilla» | Medirlo con volumen real (el equipo probó el formulario con personas y funcionó; cantidad no registrada) |
| El aviso de privacidad es un **borrador** y la oferta ya está publicada | Pueden llegar **datos reales** sin un tratamiento definido | **PENDIENTE:** tratamiento de esos datos, correo real de privacidad en Render y validación legal del aviso ([07](07_seguridad_y_privacidad.md) §7.0) |
| Sin línea base de horas de la empresa | No se puede cuantificar el ahorro de horas | Horas por vacante y volumen semanal |
| Límites anti-abuso en memoria | Con más de una instancia no se comparten | Moverlos a PostgreSQL si se escala |
| Render gratuito | Se duerme a los 15 min (1–2 min para despertar); la base vence el **28/11/2026** | Plan pago o servidor de la empresa |
| La API v1 del Simulador BUK es un contrato propio | Los nombres de campo y rutas no son los de BUK | Rehacer el adaptador con el `/apidocs` real |
| Las cifras de tiempo se midieron en local | No representan la latencia de Render ni de BUK real | Repetir la medición contra el entorno de pruebas de BUK |

> **Advertencia:** como la oferta está publicada en LinkedIn, pueden llegar postulaciones con **datos reales**. Su tratamiento, el correo real de privacidad en Render y la validación legal del aviso están **PENDIENTES** (ver [07](07_seguridad_y_privacidad.md) §7.0 y el riesgo R11).

## 9.2 Matriz de riesgos (flujo final)

| # | Riesgo | P | I | Criticidad | Mitigación en el prototipo | Plan alternativo |
|---|---|---|---|---|---|---|
| R1 | BUK no permite subir el CV por API o usa otras rutas | Media | Alta | **Crítica (6)** | `ConectorATS.capacidades.adjuntarCV`: si es `false`, completa con advertencia y el CV queda en el Puente | Revisión manual del CV desde el Puente |
| R2 | La empresa no entrega la llave de BUK a tiempo | Alta | Alta | **Crítica (9)** | Todo el flujo demostrado contra el simulador; el adaptador se escribe solo con documentación | Exportar a la carga masiva de BUK (alternativa B evaluada el 25/10) |
| R3 | Duplicados (dos envíos, dos fuentes, misma persona) | Alta | Media | **Crítica (6)** | UNIQUE `(fuente, idExterno)`, `Idempotency-Key`, reconciliación, posible duplicado → revisión humana | Revisión en el panel |
| R4 | Abuso del formulario público (spam, archivos falsos) | Media | Media | Alta (4) | Límites por IP y vacante, campo trampa, tiempo mínimo firmado, tamaño, PDF por contenido | Desactivar el enlace desde el panel |
| R5 | El límite por IP se esquiva en Render (encabezado falsificable) | Media | Baja | Media (2) | Tope por vacante; **PENDIENTE** verificar el encabezado confiable | Desactivar el enlace |
| R6 | Exposición de datos personales | Baja | Alta | Media (3) | Logs sin datos personales, retención, borrado a pedido, CV ficticios | Borrado y registro del evento |
| R7 | Render dormido o caído durante la demo | Alta | Baja | Media (3) | Despertar 15 min antes; reintentos con espera | Demo local (`npm run dev`) |
| R8 | El candidato desconfía de un formulario fuera de LinkedIn | Media | Media | Alta (4) | Ficha de la vacante, aviso claro, confirmación con referencia | Validar con usuarios (**PENDIENTE**) |
| R9 | Términos de LinkedIn sobre enlaces externos o tipo de publicación | Baja | Media | Media (2) | No se automatiza nada en LinkedIn | **PENDIENTE:** verificar con la cuenta de la empresa |
| R10 | Mantenimiento por la empresa (Next.js, PostgreSQL) | Media | Media | Alta (4) | Documentación, pruebas automáticas, instalación en 5 minutos | — |
| R11 | Llegan **datos personales reales** por la oferta publicada sin tratamiento definido, correo de privacidad ni aviso validado | Alta | Alta | **Crítica (9)** | Aviso y autorización obligatoria, prueba del consentimiento, retención del CV, borrado a pedido | **PENDIENTE:** definir el tratamiento, poner el correo real de privacidad en Render y validar el aviso; si no se puede, desactivar el enlace en Panel → Formulario público |

## 9.3 Riesgos descartados por diseño

- **Bot sobre LinkedIn real** (cláusula 8.2 del Acuerdo de Usuario; bloqueo de la cuenta; sesión humana en cada corrida): descartado (D-75).
- **Extracción con IA** de los CV en tiempo de ejecución: no se usa; el importador sugiere datos con reglas simples y una persona confirma.
- **Rutas inventadas de BUK:** prohibidas; el adaptador está vacío hasta tener documentación.

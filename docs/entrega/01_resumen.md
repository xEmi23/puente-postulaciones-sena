# 1. Resumen

**Reto #1 SENA · Innovación Abierta 2026-2 (CUEE 2.0, SENA Regional Antioquia).** Entrega del 13/11/2026. Publicación anonimizada: «la empresa retadora».

## El problema

Según la ficha del reto, el equipo de selección de la empresa publica vacantes en LinkedIn y gestiona el proceso en su ATS (BUK), y entre los dos no hay conexión: por cada vacante, un reclutador descarga uno por uno los CV y vuelve a digitar los datos en el ATS. La ficha dice que eso retrasa el avance de los candidatos entre 2 y 4 días hábiles. La API de reclutamiento de LinkedIn es solo para socios aprobados (verificado en Microsoft Learn) y, según la ficha del reto (numeral 2.8), no se conectará la API directa de LinkedIn; la integración con BUK sería solo por su API REST, con acceso controlado y guiado por un gestor acompañante. El equipo no tiene una llave de la API de BUK.

## La solución

**El Puente**, un *middleware* web (Next.js + PostgreSQL) que recibe postulaciones y **las registra solas en «Postulantes» del proceso correcto del ATS, por su API**:

1. La oferta en LinkedIn lleva un **enlace externo** al **formulario público del Puente** de esa vacante (no se automatiza LinkedIn ni se usa su API).
2. El candidato envía sus datos, su CV en PDF y su autorización de datos.
3. El Puente valida, normaliza, evita duplicados, verifica el CV (SHA-256) y lo registra en el ATS, con reintentos y trazabilidad.

El mismo núcleo recibe **postulaciones simuladas en JSON** desde cualquier fuente con token (lo que pide la ficha, con Postman) y **PDF importados** por un operador. El destino está detrás de una interfaz (`ConectorATS`): hoy el **Simulador BUK**; BUK real cuando haya documentación y llave.

## Resultados (medidos el 11/11/2026, local, datos ficticios)

| Criterio de éxito | Resultado |
|---|---|
| Postulaciones registradas sin error en el ATS simulado | **45/45 = 100 %** (10 de ellas tras un reintento automático por el límite del ATS) |
| Tiempo de registro por candidato | Mediana **1,2 s** uno a la vez (máx. 1,3 s); **9,6 s** con 10 a la vez y el límite del ATS (máx. 10,4 s) |
| Campos mapeados correctamente | **450/450 = 100 %** |
| Fallos provocados rechazados sin llegar al ATS | **12/12** |
| Pruebas automáticas | 328 por vuelta, 2 vueltas idénticas sin fallos; vuelta 3 tras 2 arreglos: 333, sin fallos ([06](06_pruebas_y_resultados.md)) |
| Render | `/api/salud` ok y prueba de humo del formulario **5/5** |

## Qué es real y qué es simulado

**Real:** el Puente (formulario, entrada JSON, importador, núcleo, procesador, panel). **Simulado:** el ATS de la demo (Simulador BUK) y la red profesional (Simulador LinkedIn). **Deshabilitado:** el adaptador de BUK real. **Descartado:** el bot sobre LinkedIn (términos de uso; D-75). **Borrador:** el aviso de privacidad. **No probado aún:** una oferta real de LinkedIn con el enlace (la cuenta espera verificación; PENDIENTE).

## Uso de IA (declaración)

**El desarrollo y la redacción se hicieron con apoyo MAYORITARIO de IA.** Claude Code programó, probó y documentó bajo especificaciones por fases; Claude (chat) apoyó el diseño, la auditoría y los prompts; ChatGPT se usó al inicio. El equipo definió el problema, eligió entre alternativas, dirigió cada fase, probó el sistema y tomó las decisiones.

| La IA | El equipo |
|---|---|
| Escribió todo el código, las pruebas y los scripts (Claude Code) | Definió el problema a partir de la ficha y la socialización |
| Redactó las especificaciones y los prompts por fase (Claude chat) | Eligió entre alternativas y aprobó cada pivote (V4, bot descartado, formulario) |
| Redactó la documentación técnica y de entrega (Claude Code) | Dirigió cada fase y decidió cuándo seguir |
| Ejecutó las pruebas, la medición y el despliegue por CLI | Creó el Blueprint en Render, aprobó el despliegue y probó el sistema |

Detalle en [08](08_uso_de_ia.md). No afirmamos revisión humana línea por línea.

## Cómo se llegó aquí

Cuatro versiones en 30 días: V1 (una app), V2 (tres sistemas), V3 (bot, solo especificación), V4 (el Puente independiente de la fuente) y el pivote final al formulario con enlace externo. 77 decisiones registradas con su alternativa descartada. Ver [03](03_metodologia.md).

## Pendiente (no cumplido)

Llave y API reales de BUK · validación legal del aviso · correo de privacidad real · verificación de la cuenta de LinkedIn y oferta publicada · límite por IP en Render · evidencia del equipo para la metodología ([EVIDENCIA_PENDIENTE.md](EVIDENCIA_PENDIENTE.md)).

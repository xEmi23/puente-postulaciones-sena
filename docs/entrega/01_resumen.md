# 1. Resumen

**Reto #1 SENA · Innovación Abierta 2026-2 (CUEE 2.0, SENA Regional Antioquia).** Entrega del 13/11/2026. Publicación anonimizada: «la empresa retadora».

## Equipo

| Nombre | Rol |
|---|---|
| Emiliano Serna Ortega | Integrante del equipo |
| Julián Pérez Ortiz | Integrante del equipo |
| Moisés Elio Obregón | Integrante del equipo |
| Katherine Acosta | Integrante del equipo |
| Walver Rodríguez | Docente |

Horas: **43 horas declaradas por el equipo**.

## El problema

Según la ficha del reto, el equipo de selección de la empresa publica vacantes en LinkedIn y gestiona el proceso en su ATS (BUK), y entre los dos no hay conexión: por cada vacante, un reclutador descarga uno por uno los CV y vuelve a digitar los datos en el ATS. La ficha dice que eso retrasa el avance de los candidatos entre 2 y 4 días hábiles. Según la ficha del reto (numeral 2.8), no se conectará la API directa de LinkedIn y las postulaciones se simulan con *payloads* JSON; la integración con BUK sería solo por su API REST, con acceso controlado y guiado por un gestor acompañante. El equipo no tiene una llave de la API de BUK.

## La solución

**El Puente**, un *middleware* web (Next.js + PostgreSQL) que recibe postulaciones y **las registra solas en «Postulantes» del proceso correcto del ATS, por su API**:

1. La oferta en LinkedIn lleva un **enlace externo** al **formulario público del Puente** de esa vacante (no se automatiza LinkedIn ni se usa su API). **La oferta se publicó en LinkedIn con ese enlace.**
2. El candidato envía sus datos, su CV en PDF y su autorización de datos.
3. El Puente valida, normaliza, evita duplicados, verifica el CV (SHA-256) y lo registra en el ATS, con reintentos y trazabilidad.

El mismo núcleo recibe **postulaciones simuladas en JSON** desde cualquier fuente con token (lo que pide la ficha, con Postman) y **PDF importados** por un operador. El destino está detrás de una interfaz (`ConectorATS`): hoy el **Simulador BUK**; BUK real cuando haya documentación y llave.

## Resultados

| Criterio de éxito | Resultado (11/11/2026, local, datos ficticios) |
|---|---|
| Postulaciones registradas sin error en el ATS simulado | **45/45 = 100 %** (10 de ellas tras un reintento automático por el límite del ATS) |
| Tiempo de registro por candidato | Mediana **1,2 s** uno a la vez (máx. 1,3 s); **9,6 s** con 10 a la vez y el límite del ATS (máx. 10,4 s) |
| Campos mapeados correctamente | **450/450 = 100 %** |
| Fallos provocados rechazados sin llegar al ATS | **12/12** |
| Pruebas automáticas | 333 (266 Vitest + 67 Playwright), sin fallos ([06](06_pruebas_y_resultados.md)) |
| Render | `/api/salud` ok y prueba de humo del formulario **5/5** |
| Prueba con personas | El equipo probó el formulario con personas y funcionó (cantidad y fecha no registradas) |

## Qué es real y qué es simulado

**Real:** el Puente (formulario, entrada JSON, importador, núcleo, procesador, panel) y la oferta publicada en LinkedIn con el enlace externo. **Simulado:** el ATS de la demo (Simulador BUK) y la red profesional (Simulador LinkedIn). **Deshabilitado:** el adaptador de BUK real. **Descartado:** el bot sobre LinkedIn (D-75; la Puerta 0 no se hizo). **Borrador:** el aviso de privacidad.

## Uso de IA (declaración)

**El desarrollo, las pruebas y la redacción se hicieron con apoyo MAYORITARIO de IA.** Claude Code programó, probó y documentó bajo especificaciones por fases; Claude (chat) apoyó el diseño, la auditoría y los prompts. El equipo definió el problema, eligió entre alternativas, dirigió las fases, probó y tomó las decisiones.

| La IA | El equipo |
|---|---|
| Escribió todo el código, las pruebas y los scripts (Claude Code) | Definió el problema a partir de la ficha del reto y del análisis de las interfaces de LinkedIn |
| Redactó las especificaciones y los prompts por fase (Claude chat) | Eligió entre alternativas y aprobó cada pivote (V4, bot descartado, formulario) |
| Redactó la documentación técnica y de entrega (Claude Code) | Dirigió las fases y decidió cuándo seguir; hizo la auditoría externa de la V3 (Julián Pérez Ortiz, con Claude Pro) |
| Ejecutó las pruebas, la medición y el despliegue por CLI | Creó el Blueprint en Render, aprobó el despliegue, publicó la oferta en LinkedIn y probó el formulario con personas |

Detalle en [08](08_uso_de_ia.md). No afirmamos revisión humana línea por línea.

## Cómo se llegó aquí

Cuatro versiones en 30 días: V1 (una app), V2 (tres sistemas), V3 (bot, solo especificación), V4 (el Puente independiente de la fuente) y el pivote final al formulario con enlace externo. 77 decisiones registradas con su alternativa descartada. Ver [03](03_metodologia.md).

## Pendiente (no cumplido)

Llave y API reales de BUK · validación legal del aviso de privacidad · correo de privacidad real en Render · tratamiento de datos reales que lleguen por la oferta publicada · roles individuales · planes de IA y su costo (por confirmar) · límite por IP en Render. Ver [EVIDENCIA_PENDIENTE.md](EVIDENCIA_PENDIENTE.md).

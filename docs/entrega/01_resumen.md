# 1. Resumen

**Reto #1 SENA · Innovación Abierta 2026-2 (CUEE 2.0, SENA Regional Antioquia).** Entrega del 13/11/2026. Publicación anonimizada: «la empresa retadora».

## El problema

El equipo de selección publica vacantes en LinkedIn y gestiona el proceso en su ATS (BUK). Entre los dos no hay conexión: por cada vacante, un reclutador descarga uno por uno los CV y vuelve a digitar los datos en el ATS. Eso retrasa el avance de los candidatos entre 2 y 4 días hábiles y consume horas en una tarea repetitiva. La API de LinkedIn es solo para socios aprobados y el equipo no recibió la llave de la API de BUK.

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
| Pruebas automáticas | 328 por vuelta, 2 vueltas idénticas sin fallos ni pruebas inestables; vuelta 3 tras los 2 arreglos: 333 (266 Vitest + 67 Playwright), sin fallos ([06](06_pruebas_y_resultados.md)) |
| Render | `/api/salud` ok y prueba de humo del formulario **5/5** |

## Qué es real y qué es simulado

**Real:** el Puente (formulario, entrada JSON, importador, núcleo, procesador, panel). **Simulado:** el ATS de la demo (Simulador BUK) y la red profesional (Simulador LinkedIn). **Deshabilitado:** el adaptador de BUK real. **Descartado:** el bot sobre LinkedIn (términos de uso; D-75). **Borrador:** el aviso de privacidad.

## Cómo se llegó aquí

Cuatro versiones en 30 días (Design Thinking + Lean Startup + IA generativa declarada): V1 (una app), V2 (tres sistemas), V3 (bot, solo especificación), V4 (el Puente independiente de la fuente) y el pivote final al formulario con enlace externo. 77 decisiones registradas con su alternativa descartada. Ver [03](03_metodologia.md) y [08](08_uso_de_ia.md).

## Pendiente (no cumplido)

Llave y API reales de BUK · validación legal del aviso · correo de privacidad real · verificación de la cuenta de LinkedIn de la empresa · límite por IP en Render · evidencia del equipo para la metodología ([EVIDENCIA_PENDIENTE.md](EVIDENCIA_PENDIENTE.md)).

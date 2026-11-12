# Medición de los criterios de éxito (11/11/2026)

> Datos crudos: [medicion-20261112021414.json](medicion-20261112021414.json) (corrida oficial). Script: [scripts/medir-criterios.mjs](../../../scripts/medir-criterios.mjs). Las horas del JSON están en UTC (02:14 UTC del 12/11 = 21:14 del 11/11 en Bogotá).

## Método

| Aspecto | Detalle |
|---|---|
| Fecha y hora | 11/11/2026, 21:14:14 a 21:15:37 (America/Bogota) |
| Entorno | Local, Windows 11, Node 24.2.0, `npm run dev` (Puente :3003 y Simulador BUK :3002 con sus workers dentro del proceso; intervalo del worker 1 s), PostgreSQL 16 local (`tb2_dev`). **No** es Render ni BUK real |
| Datos | Ficticios: correos `@demo.test` únicos por corrida, nombres con tildes y espacios de más, teléfonos en 5 formatos, 10 ciudades, perfil de LinkedIn en la mitad, los 3 CV de `fixtures/cv/` |
| Envíos válidos | **45**: 30 secuenciales por la entrada genérica (JSON en `datos` + PDF), 10 a la vez («ráfaga») por la entrada genérica y 5 por el formulario público (página real, marca de tiempo firmada, espera de 3,2 s) |
| Fallos provocados | **12**: token inválido, `datos` no JSON, falta `candidato.nombres`, PDF falso, CV > 5 MB, vacante sin correspondencia, duplicado, sin correo (revisión), segundo envío del formulario con el mismo correo, formulario sin autorización, formulario con PDF falso, formulario enviado en < 3 s |
| Criterio 1 | Registrada sin error = la postulación existe en el Simulador BUK, en la etapa «Postulantes», **y** la recepción del Puente terminó en «Completado». Se consulta la base del ATS, no la respuesta 202 del Puente |
| Criterio 2 | Desde el instante en que el cliente envía la petición hasta `creadaEn` de la postulación en el Simulador BUK (mismo reloj, misma máquina). Se consulta cada 100 ms |
| Criterio 3 | 10 campos por postulación comparados con lo enviado, normalizado como dice el contrato: nombre, apellido, correo (minúsculas), teléfono (E.164), ciudad, referencia externa del postulante (perfil o referencia del Puente), proceso, etapa, SHA-256 y tamaño del CV |

## Resultados

| Criterio | Resultado |
|---|---|
| **1. Postulaciones registradas sin error en el ATS simulado** | **45 / 45 = 100 %** (30/30 secuenciales, 10/10 en ráfaga, 5/5 por formulario). En la ráfaga, las 10 tuvieron **un intento fallido** porque el Simulador BUK respondió 429 (límite de 120 peticiones por minuto por API Key); el Puente esperó lo que indicó `Retry-After` (~7 s) y las completó sin duplicar |
| **2. Tiempo de registro por candidato** | Secuencial (n = 30): mediana **1,16 s**, p90 1,21 s, máximo **1,28 s** · Formulario (n = 5): mediana **0,84 s**, máximo 0,85 s · Ráfaga de 10 con el 429 (n = 10): mediana **9,59 s**, máximo **10,40 s** · Todas (n = 45): mediana 1,17 s, máximo 10,40 s |
| **3. Campos mapeados correctamente** | **450 / 450 = 100 %** (10 campos × 45 postulaciones) |
| Fallos provocados | **12 / 12** con la respuesta esperada y **ninguno llegó al ATS** (el segundo envío del formulario devolvió la misma referencia y en el ATS hay una sola postulación) |
| Postulaciones de la corrida en el ATS | 45 (ninguna duplicada) |

## Corridas descartadas (transparencia)

| Corrida | Qué pasó | Por qué no es la oficial |
|---|---|---|
| 21:11 (sin archivo) | El formulario respondió 500: la base local de desarrollo no tenía las 2 migraciones del 03/11 (`npm run dev` no migra). Se aplicó `npm run db:migrate` | Se interrumpió |
| [21:12](medicion-20261112021219.json) | 45/45 en el ATS y 450/450 campos correctos, pero el script leía el estado del Puente justo cuando el ATS creaba la postulación (carrera del **script**): 38/45 «Completado» en ese instante, 45/45 segundos después. Además, el caso «sin correo» enviaba el PDF de otro caso (400 correcto por SHA-256 distinto). Tiempos: secuencial mediana 1,19 s; ráfaga **sin** 429 mediana 2,02 s, máximo 3,05 s | Se corrigió el script y se repitió |

## Límites de la medición

- Es local y en modo desarrollo; en Render (plan gratuito) hay que sumar el arranque en frío (65–92 s medidos el 29/10) y la latencia de red.
- El tiempo depende del intervalo del worker (1 s) y del límite del ATS; con BUK real dependerá de su API (**no medido**).
- No mide el ahorro de horas del reclutador: falta la línea base de la empresa.

# 2. Problema y contexto

> Entrega del 13/11/2026 · Reto #1 SENA · Innovación Abierta 2026-2 (CUEE 2.0, SENA Regional Antioquia).
> Publicación anonimizada: la empresa que propuso el reto se llama aquí **«la empresa retadora»**. Su nombre, identificación, dirección y contactos no aparecen en este repositorio.

## 2.1 El problema, en palabras del equipo

El equipo de atracción y selección de la empresa retadora publica sus vacantes en **LinkedIn** y gestiona el proceso en un **ATS (BUK)**. Entre los dos sistemas no hay conexión. Hoy, por cada vacante, un reclutador:

1. entra a la vacante en LinkedIn;
2. descarga uno por uno los CV en PDF;
3. crea a cada candidato en el ATS y vuelve a digitar sus datos;
4. sube el CV a «Postulantes» del proceso correcto.

Ahí el ATS ya califica a los candidatos y el proceso sigue por etapas. **El dolor está en el traslado**, no en la selección.

| Efecto | Qué dice la ficha del reto (resumen, no cita) | Estado del dato |
|---|---|---|
| Tiempo de contratación | El cuello de botella retrasa el avance de los candidatos entre 2 y 4 días hábiles | Según la ficha del reto |
| Horas del equipo | «Horas semanales» en tareas repetitivas; la propia evaluación de la ficha pide cuantificarlas | **PENDIENTE: línea base de la empresa** (horas por vacante y volumen semanal) |
| Calidad del dato | Riesgo de errores al volver a digitar | Según la ficha del reto, sin cifra |
| Antecedente | Un piloto con agentes del propio ATS no dio el alcance esperado | Según la ficha del reto |

## 2.2 Usuarios y actores

| Actor | Qué necesita | Cómo lo atiende la solución |
|---|---|---|
| Reclutador / *sourcer* | Que los candidatos aparezcan solos en «Postulantes», sin descargar ni digitar | El Puente registra cada postulación en el ATS por API, con estado visible |
| Candidato | Postularse rápido, saber qué pasa con sus datos | Formulario corto desde la oferta, aviso de privacidad, referencia de confirmación |
| Operador del Puente | Ver qué llegó, qué falló y por qué; corregir lo incompleto | Panel «Operaciones», revisión humana, reintentos |
| Administrador | Configurar conexiones, fuentes y enlaces sin tocar código | Pantallas «Conexiones», «Fuentes», «Formulario público», «Correspondencias» |
| Empresa (responsable del tratamiento) | Cumplir la Ley 1581 de 2012 y no exponer credenciales | Aviso en borrador, prueba del consentimiento, retención, borrado a pedido. **La validación legal es suya.** |

## 2.3 Restricciones que condicionan el diseño

| Restricción | Fuente | Consecuencia en la solución |
|---|---|---|
| La API de reclutamiento de LinkedIn es solo para socios aprobados | **Verificado** en Microsoft Learn (Recruiter System Connect y Apply Connect, consultado el 25/10 y 28/10/2026; URL en [docs/contratos.md](../contratos.md)) | No se usa ninguna API de LinkedIn. LinkedIn queda como **origen de la oferta** con enlace externo |
| El Acuerdo de Usuario de LinkedIn (cláusula 8.2) prohíbe bots y extracción automatizada | **Verificado** (texto público del acuerdo; ver [docs/v4/CONTEXTO_V4.md](../v4/CONTEXTO_V4.md)) | El bot quedó como experimento sobre el simulador y fue **descartado** como vía de entrada (D-75) |
| La ficha pide simular las postulaciones con *payloads* JSON (Postman o interfaz de pruebas) | Ficha del reto, restricciones | Entrada genérica con contrato JSON propio, colección de Postman y ejemplos |
| La integración con BUK sería por su API REST, con acceso controlado | Ficha del reto | Salida detrás de una interfaz (`ConectorATS`) |
| El equipo no tiene la llave de la API de BUK | Según la ficha del reto, numeral 2.8: la integración con BUK es solo por su API REST, con acceso controlado y guiado por un gestor acompañante. El equipo no tiene una llave | El destino de la demo es el **Simulador BUK** (Talentia). El adaptador de BUK está **deshabilitado** y no contiene rutas inventadas |
| BUK tiene API de Selección con API Key y permisos de lectura y modificación | **Verificado** en el centro de ayuda público de BUK (28/10/2026; URL en [docs/contratos.md](../contratos.md) §4) | Rutas, encabezado, subida del CV e idempotencia de BUK: **Supuesto pendiente** |
| No modificar el ATS de la empresa | Ficha del reto | El Puente solo usa la API; nada se instala en el ATS |
| Publicación anonimizada | Ficha del reto | Sin nombre de la empresa en código, datos ni documentos |
| 30 días de desarrollo (15/10 → 13/11/2026), prototipo en React y Next.js | Ficha del reto | Next.js 16 + React 19 + TypeScript, tres apps independientes |

## 2.4 Qué NO es el problema (alcance)

- No se reemplaza el ATS ni su calificación con IA: el proceso por etapas sigue en el ATS.
- No se extraen datos de LinkedIn ni se automatiza la sesión de un reclutador.
- No se decide quién pasa de etapa: solo se garantiza que **todos** los postulantes lleguen a «Postulantes», una sola vez y con su CV íntegro.

## 2.5 Reformulación

> **Para** el equipo de selección de la empresa retadora, **que** pierde horas descargando CV y volviendo a digitar datos entre LinkedIn y su ATS, **el Puente es** un middleware que recibe cada postulación (por un formulario enlazado desde la oferta de LinkedIn, por JSON desde cualquier fuente o por importación de PDF) y **la registra sola** en «Postulantes» del proceso correcto del ATS, sin duplicados, con el CV verificado y con trazabilidad completa.

La hipótesis, las métricas y su medición están en [03_metodologia.md](03_metodologia.md) y [06_pruebas_y_resultados.md](06_pruebas_y_resultados.md).

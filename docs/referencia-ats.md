# Referencia del ATS real (base para el simulador de destino)

Fuente: fotografías de la pantalla de la empresa tomadas durante la socialización (15/10/2026). Las fotos NO se guardan en el repositorio porque contienen datos personales reales. Aquí solo se describe la estructura, sin nombres de candidatos.

## Flujo actual del reclutador
1. Entra a LinkedIn, abre la vacante y descarga todos los CV.
2. Entra al ATS, abre el proceso de esa vacante y sube los CV.
3. La IA del ATS califica a los postulantes.
4. Mueve a los candidatos por las etapas del proceso.
5. Repite por cada vacante.

**Dolor a eliminar:** los pasos 1 y 2, repetidos por vacante.

## Estructura observada
- Módulo: Desarrollo organizacional > Selección > Procesos / Postulantes / Plantillas / Configuraciones.
- Cada vacante es un **proceso** con identificador numérico, título (ej. "Practicante de …"), prioridad (ej. "Alta"), fecha de inicio, vigencia y estado ("Iniciado").
- Pestañas del proceso: Información general · Proceso · Formularios · Pruebas · Automatización · Agentes · Historial · Postulaciones incompletas · Analítica.
- Vistas: **Vista columna** (tablero tipo kanban) y Vista tabla.
- Etapas observadas (columnas), cada una con un tipo:
  | Etapa | Tipo |
  |---|---|
  | Postulantes | (entrada) |
  | Por contactar | Filtro |
  | Referidos | Validaciones |
  | Sagrilaft | Validaciones |
  | Prueba técnica | Filtro |
  | Entrevista técnica | Entrevistas |
  | Valoración psicológica | Entrevistas |
  | Suspendido | Filtro |
- Cada columna muestra un contador y una sección plegable "Descartados (n)".
- Cada tarjeta muestra: nombre, calificación con estrella (ej. 3.0, o "-" sin calificar), fecha (ej. "15 oct"), un ícono de análisis con IA y una casilla de selección.
- Botones: "Acciones ▾" y "Nueva postulación ▾".
- Al llegar un candidato aparece el aviso: "1 postulante nuevo fue agregado al proceso".

## Cómo usarlo en el simulador
- Reproducir la **estructura y el flujo**, no la marca: colores, logo y nombre propios.
- Las etapas son configuración del proceso (seed editable), no código fijo.
- El puente siempre deja al candidato en la **primera etapa (Postulantes)**, con fuente "Portal simulado (tipo LinkedIn)".
- La calificación con IA está **fuera de alcance**: mostrar "Sin calificar".
- Mover tarjetas entre etapas es opcional (bonus), no requisito del 29/10.
- Identificadores de proceso en seeds: números ficticios (ej. 9001, 9002), no los reales.

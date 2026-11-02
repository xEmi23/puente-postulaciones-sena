# Puerta 0 — Resultados de la verificación en LinkedIn

> La llena el equipo a mano (no Claude Code). Fecha límite: 3/11/2026. Ver la sección 10 de ESPECIFICACION_V4.md.
> No pegues aquí datos personales: describe lo que viste; las capturas van tapadas y fuera del repositorio.

- Fecha de la prueba:
- Integrante que publicó (sin datos personales, solo rol):
- Opciones de «cómo recibir postulantes» que mostró LinkedIn al publicar:

| # | Se comprueba | Resultado (sí / no / parcial) | Qué se vio exactamente | Evidencia (nombre del archivo, fuera del repo) |
| --- | --- | --- | --- | --- |
| P0-1 | Se pudo publicar gratis | | | |
| P0-2 | El publicador ve la lista de postulantes | | | |
| P0-3 | El CV adjunto se ve y se descarga uno por uno | | | |
| P0-4 | Se puede exigir el CV / qué pasa sin él | | | |
| P0-5 | Datos de contacto visibles (correo, teléfono) | | | |
| P0-6 | Ids estables de vacante y postulación (URL o página) | | | |
| P0-7 | Opción de recibir por correo y si trae el CV | | | |
| P0-8 | Exportación o descarga masiva en la vacante gratuita | | | |

## Decisión del 3/11

- Bot = sí / no  (sí solo si P0-2, P0-3 y P0-6 = sí)
- Importador desde LinkedIn = sí / no  (sí si P0-3 = sí)
- Adaptador de correo = sí / no  (sí solo si P0-7 muestra el CV)
- Páginas guardadas en fixtures/linkedin/originales/ (carpeta fuera de git): lista de archivos

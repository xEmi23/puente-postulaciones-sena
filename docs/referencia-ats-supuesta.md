# Referencia del ATS: SUPUESTO PENDIENTE

> Creado por Claude Code (2026-10-25). **Este documento no reemplaza a `docs/referencia-ats.md`**, que debía aportar el equipo y no está en el repositorio. Cuando exista, manda ese documento y este se debe borrar.

## Lo verificado (centro de ayuda de BUK, consultado el 2026-10-25)

- Todo proceso tiene **«Postulantes»** como primera etapa y **«Contratados»** como última.
- Los postulantes nuevos aparecen en la columna «Postulantes». Existe la etapa **«Descartados»**.
- El perfil del postulante muestra información general, formularios, comentarios y entrevistas.

## Lo supuesto (para la demo)

| Proceso | Nombre | Etapas, en orden |
|---|---|---|
| 9001 | Desarrollador/a Backend Java | Postulantes · Preselección · Entrevista RR. HH. · Prueba técnica · Entrevista técnica · Oferta · Contratados |
| 9002 | Analista de Calidad de Software (QA) | Postulantes · Preselección · Entrevista RR. HH. · Prueba técnica · Oferta · Contratados |

- La tarjeta muestra nombre, calificación «Sin calificar», fuente y fecha.
- Aviso al llegar postulantes: «1 postulante nuevo fue agregado al proceso».
- Las etapas viven en `prisma/datos-demo.ts`. Se cambian ahí y se aplican con `npm run demo:reset`.

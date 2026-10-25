# Referencia del ATS: resumen operativo

> Actualizado por Claude Code (2026-10-25). La fuente principal es `docs/referencia-ats.md`, la descripción del equipo del ATS real tomada de las fotos de la socialización del 15/10/2026. **Ese archivo aún no está en el repositorio**: este resumen se hizo con las etapas que el equipo indicó por escrito. Cuando se agregue, manda ese documento.
> Etiquetas: **Verificado** / **Decisión interna** / **Supuesto pendiente**.

## Etapas de un proceso (en orden)

| # | Etapa | Tipo | Estado de la información |
|---|---|---|---|
| 1 | Postulantes | Filtro | Etapa: **Verificado** (ATS de la empresa y centro de ayuda de BUK) · Tipo: **Supuesto pendiente** |
| 2 | Por contactar | Filtro | Etapa: **Verificado** (ATS de la empresa) · Tipo: **Supuesto pendiente** |
| 3 | Referidos | Filtro | Etapa: **Verificado** · Tipo: **Supuesto pendiente** |
| 4 | Sagrilaft | Validaciones | Etapa: **Verificado** · Tipo: **Supuesto pendiente** |
| 5 | Prueba técnica | Validaciones | Etapa: **Verificado** · Tipo: **Supuesto pendiente** |
| 6 | Entrevista técnica | Entrevistas | Etapa: **Verificado** · Tipo: **Supuesto pendiente** |
| 7 | Valoración psicológica | Validaciones | Etapa: **Verificado** · Tipo: **Supuesto pendiente** |
| 8 | Suspendido | Filtro | Etapa: **Verificado** (la foto se corta aquí) · Tipo: **Supuesto pendiente** |
| 9 | Contratados | — (etapa final) | Etapa: **Verificado** solo en el centro de ayuda de BUK (F6), no en la foto |

- Cada columna tiene una sección plegable **«Descartados (n)»** (**Decisión interna** basada en la referencia del equipo; F7 confirma que existe «Descartados»).
- La tarjeta muestra nombre, «Sin calificar», fuente y fecha. Al llegar postulantes aparece el aviso «1 postulante nuevo fue agregado al proceso».
- Fuente única en código: `src/modules/ats/etapas.ts`. Para cambiar etapas o tipos, edita ese archivo y ejecuta `npm run demo:reset`.

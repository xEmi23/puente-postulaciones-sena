Vas a construir la V4 de este proyecto de corrido, en modo autónomo, mientras el equipo duerme. Nadie va a responder preguntas hasta mañana: decide tú lo reversible, regístralo y sigue.

PASO 0 — CONTEXTO. Lee completos, en este orden: CLAUDE.md, docs/v4/CONTEXTO_V4.md, docs/v4/ESPECIFICACION_V4.md (su sección R, Reglas comunes, es obligatoria en todo momento), PROMPTS_V4.md, docs/estado.md y docs/decisiones.md.

PASO 1 — PREPARACIÓN. Verifica que PostgreSQL local esté encendido (npm run pg:status; si no, npm run pg:start). Los archivos del kit V4 están en la carpeta sin commit (docs/v4/, PROMPTS_V4.md, PROMPT_NOCHE_V4.md y los cambios en CLAUDE.md y .gitignore): consérvalos sin modificarlos e inclúyelos en el primer commit de la rama v4.

PASO 2 — FASES. Ejecuta, una tras otra y sin detenerte entre ellas, las fases de PROMPTS_V4.md en este orden:
  F0 → F1 → F2 → F3 → F5 (solo la parte de documentación, ver abajo).
Para cada fase sigue exactamente su prompt (objetivo, archivos, criterios de aceptación y cierre). Diferencias con los prompts porque hoy trabajas solo:
  a) Donde un prompt dice «detente» o «reporta y espera», NO esperes: escribe el reporte de esa fase en docs/v4/REPORTE_FX.md, haz commit y push de la rama v4 y continúa con la siguiente fase.
  b) Después de F0, usa tu propio informe (docs/v4/INFORME_F0.md) como plan aprobado para F1–F3.
  c) Cada fase debe cerrar con su puerta de calidad completa en verde (lint, typecheck, todas las pruebas Vitest y Playwright, build) ANTES de empezar la siguiente. Si una fase no queda en verde después de intentos razonables, NO sigas a la siguiente: deja el trabajo en un commit «v4 FX: incompleto», explica la causa exacta en su reporte y salta directo al PASO 3.
  d) F4 (bot de LinkedIn) NO se hace esta noche: la Puerta 0 está pendiente. No crees apps/bot-linkedin.
  e) F5 esta noche es solo documentación y preparación: actualiza README y los documentos de docs/ que lista F5, deja en el reporte los comandos exactos de despliegue y de verificación. NO hagas merge a la rama del Blueprint de Render, NO apliques migraciones en Render y NO despliegues: eso lo aprueba el equipo mañana.
  f) Nunca abras LinkedIn real, nunca toques la carpeta talent-bridge (v1), nunca escribas el nombre de la empresa, nunca hagas push a otra rama que no sea v4 ni a otro remoto que no sea origin, nunca uses --force ni borres historia de git, nunca uses prisma migrate reset sobre bases que no sean las de prueba locales.
  g) Si una decisión es irreversible o contradice la especificación, no la tomes: anótala como pregunta para el equipo y sigue con lo que no dependa de ella.
  h) Mantén docs/estado.md al día al final de cada fase, para poder retomar si la sesión se corta.

PASO 3 — INFORME FINAL. Escribe docs/v4/INFORME_NOCHE.md, haz commit y push de la rama v4, y muéstrame su contenido completo como respuesta final. Debe tener, en español y en lenguaje claro:
  1. Resumen en 10 líneas: qué quedó funcionando y qué no.
  2. Tabla por fase (F0, F1, F2, F3, F5-docs): estado (completa / incompleta), commit, criterios de aceptación con su resultado y prueba que lo demuestra.
  3. Resultado real de la última puerta de calidad: comandos ejecutados, cuántas pruebas pasaron y fallaron (antes había 166).
  4. Qué cambió en el sistema explicado para alguien que no lee código: las entradas nuevas, el importador, los estados nuevos, la interfaz hacia el ATS.
  5. Cómo lo pruebo yo en mi computador, paso a paso y con comandos exactos para PowerShell: encender todo, entrar al Puente, crear una fuente y su token, probar la entrada genérica con curl, importar 3 PDF ficticios y ver que llegan a Talentia.
  6. Decisiones nuevas tomadas (D-52 en adelante) y preguntas que quedaron para el equipo.
  7. Riesgos o deudas que viste.
  8. LO QUE TENGO QUE HACER YO, como lista numerada al final, en este orden y con instrucciones concretas:
     a) Revisar este informe y probar en local con los pasos de la sección 5.
     b) Hacer la Puerta 0 en LinkedIn y llenar docs/v4/PUERTA0.md (resume los pasos de la sección 10 de la especificación).
     c) Si la Puerta 0 dio «Bot = sí»: copiar las 3 páginas guardadas a fixtures/linkedin/originales/ y pegarte el PROMPT F4 de PROMPTS_V4.md.
     d) Para desplegar: pegarte el PROMPT F5 agregando la frase APROBADO PARA DESPLEGAR.
     e) Cualquier otra cosa que solo una persona pueda hacer (credenciales, cuentas, evidencias de la empresa).

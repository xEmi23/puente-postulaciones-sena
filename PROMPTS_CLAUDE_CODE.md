# Prompts para Claude Code — talent-bridge

> Nota (2026-11-12, Claude Code): este archivo es el texto de los prompts tal como se usaron y no se reescribe. Donde dice que la empresa «no la facilitará por seguridad», no consta que la empresa se haya negado: según la ficha del reto, numeral 2.8, el acceso a la API REST de BUK es controlado y guiado por un gestor acompañante, y el equipo no tiene una llave.

Cómo usar:
1. Crea la carpeta `talent-bridge`, copia ahí `CLAUDE.md` y `docs/referencia-ats.md`, y pon la ficha del reto en `docs/ficha/` (la ficha NO se publica en un repositorio público).
2. Abre Claude Code en esa carpeta.
3. Pega **un prompt a la vez**. Cada uno termina en un punto de parada: revisa el reporte, prueba tú mismo y luego pega el siguiente.
4. Si una sesión se corta, usa el prompt **RETOMAR**.

Calendario sugerido: P1 domingo 25–lunes 26 · P2 martes 27 · P3 miércoles 28 · control jueves 29 · P4 a P6 del 30/10 al 13/11.

---

## P1 — Investigación de contratos y recorrido vertical

```text
Lee CLAUDE.md, docs/referencia-ats.md y la ficha en docs/ficha/. La carpeta docs/ puede contener documentos escritos por el equipo (contexto, metodología, decisiones, contratos): léelos, no los sobrescribas y, si debes cambiarlos, añade secciones marcadas "Actualizado por Claude Code (fecha)". Antes de escribir código, usa el modo plan: inspecciona la carpeta, propón la estructura y espera mi aprobación del plan.

CONTEXTO: Reto SENA. El reclutador hoy descarga todos los CV de cada vacante en LinkedIn y los sube al ATS. No hay acceso a APIs reales de LinkedIn ni de BUK. Construimos un portal de origen simulado, un puente, un ATS de destino simulado y un panel. El objetivo del 29/10 es una demostración completa, estable y convincente del recorrido principal.

1) INVESTIGACIÓN (documenta en docs/contratos.md con URL, fecha de consulta y versión):
- https://learn.microsoft.com/en-us/linkedin/talent/apply-connect/receive-applications
- https://learn.microsoft.com/en-us/linkedin/shared/api-guide/webhook-validation
- https://learn.microsoft.com/en-us/linkedin/talent/apply-connect
- https://www.linkedin.com/legal/l/api-terms-of-use
- https://supportcenter.buk.co/ (busca solo lo relacionado con Selección: postulantes, procesos, importación)
Ya revisamos parte de esto el 25/10/2026. Verifícalo tú y corrige si algo cambió:
- La postulación llega como POST al webhook del ATS con type EXPORT_JOB_APPLICATION, externalJobId, jobApplicationId (urn), jobApplicant (urn), appliedAt (epoch ms), questionResponses (contactInformationQuestionResponses con firstNameAnswer/lastNameAnswer/emailAnswer siempre presentes; resumeQuestionResponses.resumeQuestionAnswer con mediaUrl y mediaUrn).
- El CV se descarga con GET al mediaUrl usando Authorization: Bearer; el enlace dura 30 días.
- Autenticidad: header X-LI-Signature con HMAC-SHA256 en hexadecimal. OJO: las dos páginas describen el string-to-sign de forma distinta (una dice firmar el cuerpo y anteponer "hmacsha256=" a la firma; la otra dice firmar "hmacsha256=" + cuerpo crudo y que el header lleva solo el hex). Registra la discrepancia, elige la versión de la guía compartida de webhooks como decisión interna y documéntalo. Comparación en tiempo constante y sobre el cuerpo crudo, sin re-serializar.
- Validación del endpoint: GET con challengeCode; responder JSON {challengeCode, challengeResponse = hex(HMAC-SHA256(challengeCode, clientSecret))} con 200 en menos de 3 s.
- El ATS debe responder 200 al recibir; con otro código LinkedIn reintenta hasta 6 veces. Códigos de error en el cuerpo: MISSING_REQUIRED_RESPONSE, INPUT_VALIDATION_FAILED, DUPLICATE_APPLICATION_RECEIVED, JOB_POSTING_CLOSED, TOO_MANY_REQUESTS, SIGNATURE_MISMATCH, TRANSIENT_ERROR, OTHER.
- Para BUK no hay contrato de API disponible para nosotros: todo el destino es "contrato del simulador". No inventes rutas oficiales de BUK.
Etiqueta cada punto como Verificado / Decisión interna / Supuesto pendiente.

2) DIFERENCIA CON LA FICHA: crea docs/decisiones.md. Explica que la ficha pedía integrar con la API REST de BUK, que la empresa no la facilitará por seguridad y que decidimos simular ambos extremos y diseñar el origen con el contrato de Apply Connect. Marca como PENDIENTE la aceptación de la empresa y del mentor (no hay evidencia aún).

3) BASE TÉCNICA: Next.js (App Router) + React + TypeScript, Zod, PostgreSQL con Prisma (esquemas origen, puente, ats), Vitest y Playwright. Elige versiones estables actuales, fíjalas y documéntalas. Docker Compose para PostgreSQL; si Docker no está disponible, documenta la alternativa local. No uses SQLite ni memoria para ocultar problemas. Crea .env.example sin secretos, seeds ficticios (2 vacantes vinculadas, procesos 9001 y 9002 con las etapas de docs/referencia-ats.md, 3 CV PDF ficticios generados) y scripts reales: dev, worker, lint, typecheck, test, test:e2e, build, db:migrate, db:seed, demo:reset.

4) RECORRIDO VERTICAL (lo único que construyes en este prompt):
a. Origen: catálogo de vacantes publicadas, detalle y formulario de postulación sin cuenta (nombre, apellido, correo, teléfono opcional, ciudad, CV PDF). Validación en servidor y mensajes claros. Al guardar, crea la postulación y una fila de "outbox" en la misma transacción.
b. Despachador del origen (en el worker): toma la outbox y hace POST al webhook del puente con el formato documentado y la firma. Reintenta solo con respuesta distinta de 2xx, con backoff, máximo 6 intentos, y registra cada intento. Expone el CV en una URL privada del origen que exige Bearer token y expira.
c. Puente: GET de validación del webhook; POST que verifica firma, valida con Zod, guarda la recepción (jobApplicationId único) y responde 200 de inmediato; crea un trabajo persistente. El worker lo procesa: descarga el CV del mediaUrl (solo de la URL base configurada del origen, nunca de un host arbitrario), valida PDF y tamaño, calcula SHA-256, resuelve la correspondencia vacante-origen → proceso-ATS, y llama al ATS por HTTP.
d. ATS simulado (contrato del simulador, documentado): crear/buscar candidato, subir documento, crear postulación en la primera etapa. Acepta header Idempotency-Key y una consulta por referencia externa para reconciliación (capacidad del simulador, NO atribuida a BUK). Valida el SHA-256 recibido.
e. ATS UI: lista de procesos y tablero por columnas como en docs/referencia-ats.md; la tarjeta nueva aparece en "Postulantes" con "Sin calificar", fuente y fecha; aviso "1 postulante nuevo fue agregado al proceso"; detalle del candidato con descarga del CV.
f. Estados del puente: RECIBIDO, PROCESANDO, COMPLETADO, RECHAZADO, FALLIDO_REINTENTABLE, REQUIERE_VERIFICACION, con el paso alcanzado (cv_descargado, candidato_creado, documento_subido, postulacion_creada).

5) PRUEBAS de este incremento: firma válida/inválida, challenge, validación de payload, postulación de punta a punta (E2E) y que el hash del CV en el ATS sea igual al original. Ejecuta typecheck, lint, test y build.

Al terminar: actualiza docs/estado.md y la sección Comandos de CLAUDE.md, reporta qué ejecutaste y con qué resultado, qué no pudiste ejecutar y por qué, y DETENTE. No hagas el panel ni los casos de fallo todavía.
```

---

## P2 — Fiabilidad y panel del puente

```text
Lee CLAUDE.md y docs/estado.md. Verifica que el recorrido de P1 funciona (ejecuta las pruebas) antes de avanzar; si algo falla, corrígelo primero.

Implementa y prueba contra PostgreSQL real de pruebas:
1. Mismo jobApplicationId reenviado: no duplica nada; el puente responde 200 (o DUPLICATE_APPLICATION_RECEIVED según la decisión documentada) y el ATS conserva una sola postulación.
2. Dos entregas simultáneas del mismo evento: una sola reserva de trabajo (restricción única + SELECT … FOR UPDATE SKIP LOCKED o equivalente con lease). No basta con "consultar y luego insertar".
3. La misma persona en dos vacantes: un candidato, dos postulaciones.
4. Vacante sin correspondencia o cerrada: JOB_POSTING_CLOSED o envío a revisión, sin adivinar el proceso.
5. Datos incompletos, PDF inválido o demasiado grande, firma inválida: rechazo con el código documentado y cero escrituras en el ATS.
6. ATS no disponible (5xx o timeout): reintento con backoff y jitter, conservando el progreso por paso.
7. Reinicio del worker a mitad del recorrido: al volver retoma desde el último paso confirmado, sin crear otro candidato.
8. Respuesta perdida tras una escritura en el ATS: no repetir a ciegas; reconciliar usando la consulta por referencia externa del simulador; si no se puede saber, REQUIERE_VERIFICACION.

Los fallos se provocan con controles de prueba del simulador (variable de entorno y pantalla solo visibles en modo prueba), nunca en el recorrido normal.

Panel del puente: lista de operaciones (estado, fecha, vacante, referencia corta, sin correo completo), detalle con línea de tiempo de pasos e intentos, errores en español comprensible, botón de reintento solo cuando sea seguro y botón de reconciliar en REQUIERE_VERIFICACION; pantalla de correspondencias de vacantes; métricas medidas (recibidas, completadas, rechazadas, duplicados evitados, tiempo de recepción a completado: mediana y p95, con tamaño de muestra).

Protege el panel y las APIs internas con una autenticación sencilla de demostración (usuario de entorno, cookie segura), imposible de dejar activa por accidente en un entorno real. Ejecuta todas las pruebas, actualiza docs/estado.md y DETENTE.
```

---

## P3 — Pulido y demostración del 29/10

```text
Lee CLAUDE.md y docs/estado.md. Audita la fase contra los criterios de abajo con pruebas, no con resúmenes.

Criterios del 29/10, verificados con Playwright y a mano:
1. Preparar una vacante en origen y destino y vincularlas.
2. Postular una persona ficticia con un PDF.
3. Ver la transferencia sin copiar nada manualmente.
4. Ver la postulación en la columna Postulantes del proceso correcto.
5. Descargar el CV y comprobar que el hash coincide con el original.
6. Reenviar el evento sin duplicar.
7. Rechazo controlado de entradas inválidas.
8. Reiniciar app y worker sin perder datos ni operaciones pendientes.

Pulido: revisa escritorio y móvil, navegación por teclado, estados de carga, vacío y error, y el aviso "Entorno de simulación" en cada pantalla. Identidad visual propia y coherente entre los tres módulos (el origen y el ATS deben sentirse como productos distintos). Los textos de la interfaz, en español.

demo:reset: borra y re-siembra solo datos marcados como demo; se niega a ejecutarse si NODE_ENV=production o si la URL de la BD no es local.

Documentos: README (instalación desde cero hasta la demo), docs/arquitectura.md con diagrama, docs/mapeo-datos.md (campo origen → modelo interno → campo ATS), docs/guion-demo.md (5–7 minutos), docs/uso-ia.md (qué hizo la IA y qué revisó el equipo) y docs/resultados-pruebas.md (fecha, commit, comando, resultado).

Haz una instalación limpia en una carpeta nueva siguiendo solo el README y reporta el resultado. DETENTE.
```

---

## P4 — Retroalimentación del control (desde el 30/10)

```text
Lee CLAUDE.md, docs/estado.md y docs/retroalimentacion-29oct.md (lo escribimos nosotros). Convierte cada comentario en un requisito con ID en docs/requisitos.md, prioriza con nosotros antes de implementar y luego implementa por orden, con pruebas. No cambies el alcance acordado sin preguntarnos.
```

## P5 — Completar casos y edición de vacantes

```text
Completa: editar y cerrar vacantes en el origen (cerrar debe hacer que nuevas postulaciones reciban JOB_POSTING_CLOSED); transferencia del CV interrumpida; error de autenticación entre puente y ATS (no reintentar, marcar y mostrar); candidato creado pero postulación pendiente (reanudar). Pruebas de contrato independientes: el contrato del origen se prueba contra la documentación de LinkedIn registrada en docs/contratos.md, no contra el puente, para que un error compartido no pase como correcto. Ejecuta todo, actualiza el estado y DETENTE.
```

## P6 — Entrega del 13/11

```text
Prepara la entrega final: docs/guia-adopcion.md (qué haría falta para un uso real: alianza de Apply Connect o API del ATS, acuerdos y permisos, documentación de la instancia, adaptar los conectores, pruebas en un entorno autorizado, datos reales y Ley 1581; no reducirlo a "cambiar las claves"; incluir la alternativa sin desarrollo de publicar la vacante con enlace al formulario del ATS); docs/informe-empresa.md (problema, propuesta, resultados medidos en el prototipo, límites y próximos pasos; sin inventar ahorro ni aprobación de terceros); trazabilidad requisito → código → prueba → evidencia; colección Postman sin secretos; revisión de anonimización de todo lo publicable. Instalación limpia final y reporte del estado real.
```

---

## RETOMAR (cuando se corte una sesión)

```text
Lee CLAUDE.md y docs/estado.md. Verifica con pruebas el estado real antes de asumir nada. Retoma el primer pendiente del prompt activo sin rehacer lo que funciona. Para cada fallo: reprodúcelo, escribe una prueba que lo detecte, corrige lo mínimo y ejecuta las regresiones. Actualiza docs/estado.md y dime qué puedo comprobar yo.
```

# Contratos de integración

> Actualizado por Claude Code (2026-10-25). Fuentes consultadas el **2026-10-25**.
> Etiquetas: **Verificado** (lo dice la fuente consultada), **Decisión interna** (lo elegimos nosotros), **Supuesto pendiente** (falta confirmar).

## Fuentes

| # | Fuente | URL | Versión / fecha en la página |
|---|---|---|---|
| F1 | Receive job applications (Apply Connect) | https://learn.microsoft.com/en-us/linkedin/talent/apply-connect/receive-applications | `ms.date` 2026-09-21, actualizada 2026-09-23, vista por defecto `li-lts-2026-04`, commit `4abc1338` |
| F2 | Webhooks (guía compartida) | https://learn.microsoft.com/en-us/linkedin/shared/api-guide/webhook-validation | `ms.date` 2026-06-07, actualizada 2026-06-17, commit `4a26ef1e` |
| F3 | Apply Connect overview | https://learn.microsoft.com/en-us/linkedin/talent/apply-connect (redirige a `apply-connect-overview`) | `ms.date` 2026-09-04, vista `li-lts-2026-04` |
| F4 | LinkedIn API Terms of Use | https://www.linkedin.com/legal/l/api-terms-of-use | «Last revised on December 13th, 2022» |
| F5 | BUK, centro de ayuda: Integración con LinkedIn | https://supportcenter.buk.co/hc/es-419/articles/36403687869083-Integraci%C3%B3n-con-LinkedIn | actualizado 2026-10-08 |
| F6 | BUK: ¿Qué son las Etapas del proceso de Selección? | https://supportcenter.buk.co/hc/es-419/articles/48871333055771 | actualizado 2026-04-08 |
| F7 | BUK: Postulantes dentro de cada proceso de selección | https://supportcenter.buk.co/hc/es-419/articles/36192833131163 | actualizado 2026-07-22 |

## 1. Origen: entrega de postulaciones (Apply Connect)

| Punto | Estado | Detalle |
|---|---|---|
| Transporte | **Verificado** (F1) | LinkedIn hace `POST` al `jobApplicationWebhookUrl` del ATS por cada postulación. |
| Tipo de evento | **Verificado** (F1) | `type` = `EXPORT_JOB_APPLICATION` siempre. |
| Campos principales | **Verificado** (F1) | `externalJobId` (string, id de la vacante en el ATS), `jobApplicationId` (string, p. ej. `urn:li:jobApplication:12345678`; guardarlo completo porque el formato puede cambiar), `jobApplicant` (`urn:li:person:{id}`), `appliedAt` (long, epoch en ms), `questionResponses`. |
| Contacto | **Verificado** (F1) | `questionResponses.contactInformationQuestionResponses` siempre presente, con `firstNameAnswer`, `lastNameAnswer` y `emailAnswer` (`{ value }`) siempre presentes. Opcionales: `middleNameAnswer`, `cellphoneNumberQuestionAnswer` (`countryCode`, `nationalNumber`, `extension`), `locationAnswer`. |
| CV | **Verificado** (F1) | `questionResponses.resumeQuestionResponses.resumeQuestionAnswer` = `{ mediaUrl, mediaUrn }`; es `null` si no se pidió o no se adjuntó CV. |
| Ubicación (discrepancia menor) | **Verificado** (F1) | La tabla ubica `locationAnswer` dentro de `contactInformationQuestionResponses` con `locationCityAnswer: { value }`, pero el ejemplo lo pone en `questionResponses` con cadenas planas. **Decisión interna:** seguimos la tabla; la ciudad es opcional para el puente. |
| Descarga del CV | **Verificado** (F1) | `GET mediaUrl` con `Authorization: Bearer {access_token}`; el enlace dura **30 días**; usar el `content-type` de la respuesta. |
| Respuesta | **Verificado** (F1, F2) | Responder **200** al recibir. Con otro código LinkedIn reintenta **6 veces** (F1). F2 dice que cualquier 2xx cuenta como éxito. |
| Errores | **Verificado** (F1) | Cuerpo `{"errors":[{"errorCode", "additionalErrorDetails"}]}` con `MISSING_REQUIRED_RESPONSE`, `INPUT_VALIDATION_FAILED`, `DUPLICATE_APPLICATION_RECEIVED`, `JOB_POSTING_CLOSED`, `TOO_MANY_REQUESTS`, `SIGNATURE_MISMATCH`, `TRANSIENT_ERROR`, `OTHER`. `SIGNATURE_MISMATCH` es fatal (sin reintento); `TOO_MANY_REQUESTS`, `TRANSIENT_ERROR` y `OTHER` se reintentan. Para los demás la tabla describe el correo al postulante, no reintentos. |
| Duplicados | **Verificado** (F2) | Las notificaciones pueden llegar más de una vez; el receptor debe deduplicar. Con `DUPLICATE_APPLICATION_RECEIVED` el postulante recibe correo de entrega *exitosa* (F1). |
| Fuente en el ATS | **Verificado** (F1) | F1 pide marcar la fuente como «LinkedIn Easy Apply». **Decisión interna (D-19):** el simulador muestra «Portal simulado (tipo LinkedIn)», para no afirmar conexión con LinkedIn en ningún texto visible. |
| Requisito comercial | **Verificado** (F3) | Apply Connect es para socios ATS con licencia LinkedIn Recruiter Corporate o Professional Services y requiere certificación. No es accesible para el equipo. |
| Fallo de la primera entrega | **Verificado** (F1) | Si la primera entrega falla, LinkedIn convierte la vacante a postulación externa (`companyApplyUrl`). El simulador no reproduce esto (**Decisión interna**). |
| HTTPS | **Verificado** (F2) | LinkedIn exige webhooks HTTPS y no admite ngrok. El simulador usa `http://localhost` (**Decisión interna**, solo local). |

### Firma (X-LI-Signature): discrepancia documentada

- **F1** dice: «The signature is calculated from the escaped unicode request payload, prefixed with `hmacsha256=` … Add the prefix `hmacsha256=` to your signature for a complete match». Se puede leer como `header = "hmacsha256=" + hex(HMAC(cuerpo))`. **Verificado.**
- **F2** dice: `stringToSign = "hmacsha256=" + <raw JSON POST body>`, `X-LI-Signature = Hex(HMACSHA256(stringToSign, clientSecret))`, y aclara: «The `X-LI-Signature` header contains only the hex digest». **Verificado.**
- El ejemplo de cabecera de F1 trae solo 64 caracteres hexadecimales, lo que es coherente con F2.
- **Decisión interna (D-04):** se implementa F2: HMAC-SHA256 en hexadecimal minúsculo sobre `"hmacsha256=" + cuerpo crudo`, cabecera solo con el hex, comparación en tiempo constante (`timingSafeEqual`) y sobre el cuerpo **crudo** (`req.text()`), sin re-serializar. Código: `src/lib/firma.ts`. Pruebas: `tests/firma.test.ts`, contra una referencia escrita desde la fórmula.
- **Supuesto pendiente:** la mención de F1 a «escaped unicode» no aparece en F2. Firmamos los bytes UTF-8 tal como llegan.

### Validación del endpoint (challenge)

- **Verificado** (F2): `GET {webhook}?challengeCode={uuid}` (más `applicationId` en integraciones padre-hijo como Apply Connect). Se responde `200`, `Content-Type: application/json`, `{ "challengeCode", "challengeResponse" }`, con `challengeResponse = hex(HMAC-SHA256(challengeCode, clientSecret))` en minúsculas, en **menos de 3 s**.
- **Verificado** (F1, F2): se revalida cada 2 h; tras 3 fallos seguidos el endpoint queda bloqueado.
- **Decisión interna:** se ignora `applicationId` porque hay un único secreto simulado (`SIM_CLIENT_SECRET`).

### Términos de uso de la API (F4)

- **Verificado:** prohíben el *scraping* y el uso de contenido obtenido fuera de las APIs. El acceso de socios requiere programa aprobado; los datos de miembros solo se guardan donde se permita y se borran si el miembro lo pide.
- Consecuencia: el prototipo **no** se conecta a LinkedIn, no hace *scraping* y usa solo datos ficticios.

## 2. Puente: respuestas que emite

| Situación | HTTP | Cuerpo | Estado |
|---|---|---|---|
| Recibida y guardada | 200 | `{"estado":"RECIBIDO","referencia":…}` | Decisión interna |
| Mismo `jobApplicationId` otra vez | 200 | `{"estado":"DUPLICADO",…}` (sin escrituras nuevas) | Decisión interna D-06 |
| Firma inválida o ausente | 401 | `SIGNATURE_MISMATCH` | Verificado (código) / Decisión (HTTP 401) |
| JSON ilegible o formato inválido | 400 | `INPUT_VALIDATION_FAILED` + `inputValidationErrorDetails` | Verificado (código) |
| Falta nombre, apellido, correo o CV | 400 | `MISSING_REQUIRED_RESPONSE` + `partnerQuestionIdentifiers` (`firstName`, `lastName`, `email`, `resume`) | Verificado (código) / Decisión (identificadores) |
| `mediaUrl` fuera del origen autorizado | 400 | `INPUT_VALIDATION_FAILED` | Decisión interna (protección SSRF) |
| Vacante sin correspondencia o desvinculada | 422 | `JOB_POSTING_CLOSED` | Verificado (código) / Decisión (422) |
| Error interno al guardar | 500 | `TRANSIENT_ERROR` | Verificado (código) |

### 2.1 Estado de vacante (contrato del simulador, no de LinkedIn)

> Actualizado por Claude Code (2026-10-25, P5). En el mundo real el cierre lo decide el ATS y cierra la publicación en LinkedIn; Apply Connect no envía este evento al ATS. Es un mecanismo **del simulador** para propagar el cierre del origen al puente.

- `POST /api/puente/vacantes/estado`, firmado igual que el webhook (`X-LI-Signature` según F2).
- Cuerpo: `{"type":"JOB_POSTING_STATUS","externalJobId":"RT-…","estado":"CERRADA"|"PUBLICADA","cambiadoEn":<epoch ms>}`.
- El origen lo deja en su **outbox** en la misma transacción que cambia la vacante; el despachador lo entrega con los mismos reintentos.
- Efecto en el puente: `CERRADA` → correspondencia inactiva con `motivoCierre=ORIGEN` y `cerradaEn`. Las postulaciones con `appliedAt` anterior al cierre se siguen aceptando; las posteriores reciben `JOB_POSTING_CLOSED`. `PUBLICADA` solo reactiva lo que cerró el origen (una desvinculación manual del panel se respeta). Un evento con `cambiadoEn` más viejo que el último aplicado se ignora (`IGNORADO_EVENTO_ANTERIOR`).

## 3. Destino: ATS simulado (contrato del simulador)

> **Para BUK no hay contrato de API disponible para el equipo.** Todo lo que sigue es *contrato del simulador*, diseñado por nosotros. **No son rutas oficiales de BUK** ni se atribuyen a BUK.

Base: `ATS_BASE_URL` (por defecto `http://localhost:3100/api/ats/v1`). Autenticación: `Authorization: Bearer {ATS_API_KEY}`; sin ella o con otra clave → `401 {codigo:"NO_AUTORIZADO"}`. Errores: `{ "codigo", "mensaje", … }`.

| Método y ruta | Cuerpo | Respuestas |
|---|---|---|
| `POST /candidatos` | `{nombre, apellido, correo, telefono?, ciudad?, referenciaExterna?}` | `201 {id, existente:false}`; `200 {id, existente:true}` si el correo ya existe (un candidato por persona) |
| `POST /candidatos/{id}/documentos` | `{nombreArchivo, tipo:"CV", contenidoBase64, sha256}` | `201 {id, sha256}`; `422 HASH_NO_COINCIDE` si el SHA-256 calculado difiere; `415 ARCHIVO_NO_PDF`; `413`; `404 CANDIDATO_NO_EXISTE` |
| `POST /postulaciones` | `{procesoId, candidatoId, documentoId?, fuente, referenciaExterna}` | `201` crea en la **primera etapa** («Postulantes»), calificación `SIN_CALIFICAR`; `200` si ya existe esa `referenciaExterna`; `409 POSTULACION_EXISTENTE {postulacionId}` si la persona ya está en el proceso; `422 PROCESO_CERRADO` (estado distinto de «Iniciado»); `404 PROCESO_NO_EXISTE` |
| `GET /postulaciones?referenciaExterna=` | — | `200 {resultados:[…]}`: consulta para reconciliar (**capacidad del simulador**) |
| `GET /procesos` | — | `200 {resultados:[{id, nombre, estado, etapas}]}`; `estado` es `INICIADO` o `CERRADO`, como en el ATS de referencia |

- **Idempotency-Key** (capacidad del simulador): en las escrituras, la misma clave con el mismo cuerpo devuelve la respuesta guardada sin volver a escribir; con otro cuerpo responde `422 CLAVE_REUTILIZADA`. El puente usa `{recepcionId}:candidato|documento|postulacion`.
- **Supuesto pendiente:** si el ATS real tiene una API, sus rutas, autenticación, idempotencia y forma de buscar por referencia externa habrá que confirmarlas con la empresa (ver `docs/decisiones.md` D-01).

## 4. BUK: lo verificado en su centro de ayuda (solo Selección)

- **Verificado** (F5): BUK Selección **publica vacantes en LinkedIn** con un feed «LinkedIn Jobs XML» configurado por un usuario reclutador de la cuenta corporativa. Quien hace clic en postular en LinkedIn es **redirigido al formulario de la URL pública del proceso en BUK**, y queda registrado con fuente LinkedIn. Publicar o despublicar tarda hasta 6 h. Es la alternativa sin desarrollo (P6, guía de adopción).
- **Verificado** (F6): todo proceso tiene **«Postulantes»** como primera etapa y **«Contratados»** como última. Las etapas intermedias son configurables.
- **Verificado** (F7): los postulantes aparecen en la columna «Postulantes»; existe la etapa «Descartados»; «Nueva postulación» permite agregar un postulante nuevo, un colaborador, uno existente o importar postulantes.
- **No encontrado:** documentación pública de una API REST de Selección para terceros. No se inventan rutas.

---

## 5. v2: Vínculo frente a Apply Connect

> Actualizado por Claude Code (2026-10-29). En la v2 el origen es **Vínculo** (app aparte, puerto 3001) y el destino es **Talentia** (puerto 3002). Las secciones 1 a 4 siguen valiendo como fuentes; aquí se dice qué reproduce cada sistema y con qué etiqueta. Documentación ejecutable: `http://localhost:3001/developers/docs` y `http://localhost:3002/apidocs` (OpenAPI 3.1 generado desde los mismos esquemas Zod que valida el código; pruebas `apps/*/tests/contrato-openapi.test.ts`).

| Punto | Vínculo (simulador) | Etiqueta |
|---|---|---|
| Cuerpo de la entrega (`EXPORT_JOB_APPLICATION`, `externalJobId`, `jobApplicationId`, `jobApplicant`, `appliedAt`, `questionResponses`) | Igual a F1 | **Verificado** (F1) |
| Firma `X-LI-Signature` = hex(HMAC-SHA256(`"hmacsha256=" + cuerpo`, clientSecret)) | Igual a F2 (D-04) | **Verificado** (F2) |
| Desafío `GET ?challengeCode=` → `{challengeCode, challengeResponse}` | Al registrar el webhook en `/developers` y antes de publicar con Solicitud sencilla | **Verificado** (F2); el momento es **Decisión interna** (D-33) |
| Revalidación cada 2 h y bloqueo tras 3 fallos | No se simula | **Decisión interna** (D-33) |
| Reintentos de entrega | 6 intentos, espera exponencial desde 30 s (~15 min) | **Verificado** el número (F1); la espera es **Decisión interna** (D-36) |
| Códigos de error que no se reintentan | `SIGNATURE_MISMATCH` y los de validación; se reintentan `TRANSIENT_ERROR`, `TOO_MANY_REQUESTS`, `OTHER` y 5xx | **Verificado** (F1) |
| `mediaUrl` con `Authorization: Bearer`, válido 30 días | `GET /api/v1/media/{id}`; solo la aplicación dueña (403 otra, 410 vencido) | **Verificado** (F1); 403/410 **Decisión interna** (D-38) |
| Token | `POST /oauth/v2/accessToken`, `grant_type=client_credentials`, 3600 s | **Contrato del simulador** modelado sobre OAuth 2.0 client credentials (D-32) |
| Publicar / cerrar vacante | `POST /api/v1/jobPostings` (idempotente por `externalJobId`), `POST /api/v1/jobPostings/{externalJobId}/close`; respuesta con `applyMethod` `ONSITE_APPLY` o `COMPANY_SITE` | **Contrato del simulador** (D-33). No son rutas de LinkedIn |
| Empresas que autorizaron | `GET /api/v1/autorizaciones` | **Contrato del simulador** (D-33) |
| Ciclo de vida | `POST /api/v1/jobApplications/{id}/lifecycle` con `VIEWED`, `RESUME_DOWNLOADED`, `REJECTED` (monótono) | **Contrato del simulador** (D-33) |
| Errores de la API | `{ status, code, message, details? }` | **Contrato del simulador** |
| Fallback cuando falla el desafío | La vacante queda como «postulación en el sitio de la empresa» | **Verificado** el comportamiento análogo (F1); implementación **Decisión interna** |
| HTTPS obligatorio | En local se permite `http://localhost`; en despliegue público, solo https y sin redes privadas (SSRF) | **Verificado** (F2) el requisito; **Decisión interna** (D-37) |
| Requisito comercial (socio certificado, licencia Recruiter) | No aplica: Vínculo es ficticio | **Verificado** (F3) que Apply Connect no es accesible al equipo |

## 6. v2: Talentia frente a BUK

| Punto | Talentia (simulador) | Etiqueta |
|---|---|---|
| API Key creada en Administración con permisos de Selección «Lectura» y «Modificación» | `/admin/api-keys`; se ve una sola vez; se guarda como SHA-256 con prefijo visible; revocable | **Verificado** (artículo BUK «Integración del módulo de Selección por API», https://supportcenter.buk.co/hc/es-419/articles/49474572553755, consultado 2026-10-28) |
| Recursos Postulantes, Postulación y Procesos de Selección | `/api/v1/seleccion/postulantes`, `/postulaciones`, `/procesos` | **Verificado** que existen esos recursos y métodos (mismo artículo); las rutas exactas son **contrato del simulador** |
| Documentación en `/apidocs` | `http://localhost:3002/apidocs` (Swagger UI) | **Verificado** que BUK la ofrece en `<empresa>.buk.cl/apidocs`; el contenido es nuestro |
| Encabezado de la llave | `auth_token` | **Supuesto pendiente** (D-26): el artículo no nombra el encabezado |
| 401 sin llave o revocada; 403 sin el permiso | `{error:{codigo:"NO_AUTORIZADO" \| "PERMISO_INSUFICIENTE", mensaje}}` | **Contrato del simulador** (D-29) |
| Límite 120 solicitudes por minuto por llave → 429 con `Retry-After` | Ventana fija en PostgreSQL | **Contrato del simulador** (D-29) |
| `Idempotency-Key` en POST y PATCH | La misma clave repite la respuesta guardada | **Contrato del simulador**: no se atribuye a BUK |
| Subida del CV | `POST /postulantes/{id}/documentos` multipart con `sha256`; 422 si no coincide | **Contrato del simulador** |
| Postulación nueva en la primera etapa «Postulantes», «Sin calificar» | Igual | **Verificado** (F6, F7) |
| Etapas del proceso | Configuración de `apps/talentia/src/modules/etapas.ts` según `docs/referencia-ats.md` | **Verificado** (F6) «Postulantes» primera y «Contratados» última; el resto, referencia del equipo |

## 7. v2: lo que expone el puente

- Webhook `GET|POST /api/webhooks/vinculo`: desafío y entregas con el Client Secret guardado en «Conexiones»; 200 al aceptar (RECIBIDO, que **no** es transferencia completada); 401 `SIGNATURE_MISMATCH`; 400 `MISSING_REQUIRED_RESPONSE` / `INPUT_VALIDATION_FAILED`; 422 `JOB_POSTING_CLOSED` (vacante cerrada o sin proceso); 200 `{"estado":"DUPLICADO"}` sin escrituras para un `jobApplicationId` ya recibido (D-06); 503 `TRANSIENT_ERROR` sin conexión configurada (D-43). Códigos **Verificados** (F1); la forma de decidir cada uno es **Decisión interna**.
- `GET /api/salud` en las tres apps (para despertar los servicios en Render). **Decisión interna.**

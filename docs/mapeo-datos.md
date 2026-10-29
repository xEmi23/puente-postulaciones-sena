# Mapeo de datos

> Creado por Claude Code (2026-10-25). Campo de origen (contrato Apply Connect) → modelo interno del puente (`puente.Recepcion`) → campo del ATS simulado (contrato del simulador). Los campos del ATS **no** son de BUK.

## Postulante y postulación

| Origen (payload del webhook) | Puente (`Recepcion`) | ATS simulado | Transformación y reglas |
|---|---|---|---|
| `jobApplicationId` | `jobApplicationId` (único) | `Postulacion.referenciaExterna` (única) | Se guarda completo, sin interpretar (F1). Base de la deduplicación y la reconciliación. |
| `jobApplicant` (`urn:li:person:…`) | `jobApplicant` | `Candidato.referenciaExterna` | Informativo. |
| `externalJobId` | `externalJobId` | — | Se traduce a `procesoAtsId` con `puente.Correspondencia`. Sin correspondencia activa → `JOB_POSTING_CLOSED`. |
| — | `procesoAtsId` | `Postulacion.procesoId` | Se resuelve una vez y se conserva aunque la correspondencia cambie después. |
| `appliedAt` (epoch ms) | `appliedAt` (timestamptz) | — | `new Date(appliedAt)`. |
| `…contactInformationQuestionResponses.firstNameAnswer.value` | `nombre` | `Candidato.nombre` | `trim`. Obligatorio (`MISSING_REQUIRED_RESPONSE: firstName`). |
| `…lastNameAnswer.value` | `apellido` | `Candidato.apellido` | `trim`. Obligatorio (`lastName`). |
| `…emailAnswer.value` | `correo` | `Candidato.correo` (único) | `trim` y minúsculas. Obligatorio (`email`); formato inválido → `INPUT_VALIDATION_FAILED`. **Clave del candidato:** la misma persona en dos vacantes es un solo candidato. |
| `…cellphoneNumberQuestionAnswer.{countryCode,nationalNumber}` | `telefono` | `Candidato.telefono` | `+{countryCode}{nationalNumber}`, p. ej. `+573000000001`. Opcional. |
| `…locationAnswer.locationCityAnswer.value` | `ciudad` | `Candidato.ciudad` | Opcional. |
| `resumeQuestionResponses.resumeQuestionAnswer.mediaUrl` | `mediaUrl` | — | Solo si está bajo `ORIGEN_BASE_URL/api/origen/media/`; si no → `INPUT_VALIDATION_FAILED`. Obligatorio (`resume`). |
| `…resumeQuestionAnswer.mediaUrn` | `mediaUrn` | — | Informativo. |
| (cuerpo crudo completo) | `payloadSha256` | — | Evidencia de lo recibido sin guardar el JSON (D-09). |
| — (fijo) | — | `Postulacion.fuente` = «Portal simulado (tipo LinkedIn)» | F1 pide marcar la fuente como «LinkedIn Easy Apply», pero ningún texto visible lo dice: el prototipo no está conectado a LinkedIn (D-19). |
| — (fijo) | — | `Postulacion.etapa` = primera etapa («Postulantes») | El ATS la elige por `orden` mínimo. |
| — (fijo) | — | `Postulacion.calificacion` = `SIN_CALIFICAR` | Se muestra «Sin calificar». |

## Hoja de vida

| Origen | Puente | ATS simulado | Reglas |
|---|---|---|---|
| Bytes en `GET mediaUrl` (Bearer) | `cvContenido` (temporal), `cvTamano`, `cvSha256` | `Documento.contenido`, `tamano`, `sha256` | Máx. `CV_MAX_BYTES` (5 MB); debe empezar por `%PDF-`; SHA-256 calculado en el puente y **recalculado** por el ATS (`HASH_NO_COINCIDE` si difiere). La copia temporal se borra al completar. |
| `Content-Disposition: filename` | `cvNombreArchivo` | `Documento.nombreArchivo` | Normalizado a caracteres seguros y extensión `.pdf`. |
| — | — | `Documento.tipo` = `CV` | Fijo. |

## Campos del contrato que se ignoran a propósito

`applicantSkills`, `verificationData`, `coverLetterQuestionResponses`, `workQuestionResponses`, `educationQuestionResponses`, `additionalQuestionResponses` y `voluntarySelfIdentificationQuestionResponses`. Este último contiene **datos sensibles** (discapacidad, género, raza, condición de veterano) que el ATS no necesita: por minimización (Ley 1581) no se guardan ni se reenvían. Habría que acordarlo con la empresa si se quisieran.

## Rechazos (lo que el postulante y el panel ven)

| Situación | Código al origen | Panel |
|---|---|---|
| Firma inválida | `SIGNATURE_MISMATCH` (401) | Rechazos en la entrada |
| Falta nombre, apellido, correo o CV | `MISSING_REQUIRED_RESPONSE` (400) | Rechazos en la entrada |
| Formato inválido o `mediaUrl` no autorizado | `INPUT_VALIDATION_FAILED` (400) | Rechazos en la entrada |
| Vacante sin correspondencia | `JOB_POSTING_CLOSED` (422) | Rechazos en la entrada |
| PDF inválido, grande o enlace expirado (al procesar) | — (ya se respondió 200) | Operación RECHAZADA con explicación |

---

## v2 · Vínculo → Puente → Talentia

> Actualizado por Claude Code (2026-10-29). Las tablas anteriores describen la v1 (origen y ATS dentro de la misma app). En la v2 el puente lee el cuerpo de Apply Connect que envía Vínculo, lo guarda normalizado en `puente.Recepcion` y lo escribe en Talentia por su API v1 (nombres en `snake_case`).

### Postulante

| Vínculo (entrega, F1) | Puente (`Recepcion`) | Talentia (`POST /api/v1/seleccion/postulantes`) |
|---|---|---|
| `contactInformationQuestionResponses.firstNameAnswer.value` | `nombre` (sin espacios sobrantes) | `nombre` |
| `…lastNameAnswer.value` | `apellido` | `apellido` |
| `…emailAnswer.value` | `correo` (minúsculas) | `correo`. **Una persona = un postulante:** si ya existe ese correo (`GET ?email=`), se actualiza con `PATCH` en lugar de crear otro |
| `…cellphoneNumberQuestionAnswer` (`countryCode`, `nationalNumber`) | `telefono` (`+` + código + número) | `telefono` |
| `…locationAnswer.locationCityAnswer.value` (opcional) | `ciudad` | `ciudad` |
| `jobApplicant` (`urn:li:person:…`) | `jobApplicant` | `referencia_externa` del postulante |

### Hoja de vida

| Vínculo | Puente | Talentia (`POST /postulantes/{id}/documentos`, multipart) |
|---|---|---|
| `resumeQuestionResponses.resumeQuestionAnswer.mediaUrl` (descarga con token, 30 días) | Descarga con el access token, comprueba tamaño, `%PDF` y bytes completos; guarda `cvSha256` y el contenido hasta subirlo | `archivo` (PDF con su nombre de archivo), `tipo = "CV"`, `sha256`. Talentia recalcula el SHA-256 y responde 422 si no coincide |
| `mediaUrn` | `mediaUrn` (trazabilidad) | — |

El contenido del CV se borra del puente al completar o rechazar; queda solo su SHA-256.

### Postulación

| Vínculo | Puente | Talentia (`POST /postulaciones`) |
|---|---|---|
| `externalJobId` | Resuelve el proceso: publicación del puente (`externalJobId` = id del proceso) o correspondencia manual (D-44) → `procesoAtsId` | `proceso_id` |
| — | `atsPostulanteId`, `atsDocumentoId` | `postulante_id`, `documento_id` |
| `jobApplicationId` | `jobApplicationId` (clave de deduplicación) | `referencia_externa` (y base de cada `Idempotency-Key`) |
| — | constante | `fuente = "Portal simulado (tipo LinkedIn)"` (D-19) |
| `appliedAt` | `appliedAt` (regla del cierre, D-17) | La postulación queda en la etapa «Postulantes», «Sin calificar» |

### De vuelta a Vínculo

| Puente | Vínculo |
|---|---|
| Al completar: `POST /api/v1/jobApplications/{jobApplicationId}/lifecycle` `{action:"RESUME_DOWNLOADED"}` | La postulación pasa a «CV descargado» en «Mis postulaciones» |

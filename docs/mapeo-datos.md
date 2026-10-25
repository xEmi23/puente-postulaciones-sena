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
| — (fijo) | — | `Postulacion.fuente` = «LinkedIn Easy Apply (simulado)» | F1 pide marcar la fuente como «LinkedIn Easy Apply». |
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

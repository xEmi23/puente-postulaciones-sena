# Resultados de los ejemplos de la entrada genérica

> Generado por `node scripts/probar-ejemplos.mjs` el 2026-11-12T02:20:41.949Z contra el Puente local (http://localhost:3003, `npm run dev`, base `tb2_dev`).
> Fuente de prueba `postman-ejemplos`, vacante `VAC-DEMO-1` → proceso 9002 del Simulador BUK. Los marcadores `{{idUnico}}` se reemplazaron por `ej-20261112022039-<n>`.

| # | Caso | Esperado | Obtenido | Detalle | ¿Coincide? |
|---|---|---|---|---|---|
| 1 | 01-valido.json + cv-camila-ejemplo.pdf | 202 RECIBIDA | 202 RECIBIDA |  | Sí |
| 2 | 01-valido.json otra vez (mismo idExterno) | 200 DUPLICADA | 200 DUPLICADA |  | Sí |
| 3 | 01-valido.json sin archivo CV | 202 REQUIERE_REVISION | 202 REQUIERE_REVISION | motivos: sin_cv | Sí |
| 4 | 02-sin-correo.json + CV | 202 REQUIERE_REVISION | 202 REQUIERE_REVISION | motivos: sin_correo | Sí |
| 5 | 03-falta-nombres.json | 400 INVALIDA | 400 INVALIDA | errores: candidato.nombres (Campo obligatorio.) | Sí |
| 6 | 04-telefono-invalido.json | 400 INVALIDA | 400 INVALIDA | errores: candidato.telefono (Teléfono inválido: no se pudo llevar a E.164.) | Sí |
| 7 | 05-con-fuente.json | 400 INVALIDA | 400 INVALIDA | errores: fuente (La fuente la fija el token; no se envía en el cuerpo.) | Sí |
| 8 | 06-campo-desconocido.json | 400 INVALIDA | 400 INVALIDA | errores: (raíz) (Campo no permitido por el contrato: salario.) | Sí |
| 9 | 07-version-no-soportada.json | 400 INVALIDA | 400 INVALIDA | errores: version (Versión del contrato no soportada (se espera «1»).) | Sí |
| 10 | 08-vacante-sin-correspondencia.json | 422 VACANTE_SIN_CORRESPONDENCIA | 422 VACANTE_SIN_CORRESPONDENCIA | La vacante «VACANTE-QUE-NO-EXISTE» de la fuente «postman-ejemplos» no tiene correspondencia con un proceso del ATS. | Sí |
| 11 | 09-sha256-no-coincide.json + CV | 400 INVALIDA | 400 INVALIDA | El SHA-256 o el tamaño declarados no coinciden con el archivo recibido. | Sí |
| 12 | 01-valido.json + no-es-pdf.pdf | 415 NO_ES_PDF | 415 NO_ES_PDF | El CV debe ser un PDF (el archivo no empieza por %PDF). | Sí |
| 13 | 01-valido.json + PDF de 5 MB + 1 byte | 413 DEMASIADO_GRANDE | 413 DEMASIADO_GRANDE | El CV supera el máximo de 5242880 bytes (5 MB). | Sí |
| 14 | Campo «datos» que no es JSON | 400 INVALIDA | 400 INVALIDA | El campo «datos» no es JSON válido. | Sí |
| 15 | Cuerpo application/json (sin multipart) | 400 INVALIDA | 400 INVALIDA | Se espera multipart/form-data con los campos «datos» (JSON) y «cv» (PDF). | Sí |
| 16 | Token inválido | 401 NO_AUTORIZADO | 401 NO_AUTORIZADO | Token de fuente ausente, inválido o revocado (Authorization: Bearer <token>). | Sí |
| 17 | Sin encabezado Authorization | 401 NO_AUTORIZADO | 401 NO_AUTORIZADO | Token de fuente ausente, inválido o revocado (Authorization: Bearer <token>). | Sí |
| 18 | Petición 61 en un minuto (otro token) | 429 DEMASIADAS_PETICIONES | 429 DEMASIADAS_PETICIONES | Se superaron 60 peticiones por minuto para este token. · Retry-After: 59 s | Sí |
| 19 | 01-valido.json aparece en el Simulador BUK | Postulantes, mismo SHA-256 | sí | proceso 9002, etapa «Postulantes», nombre «Laura Daniela», correo «laura.ejemplo.ej-20261112022039-01@demo.test», teléfono «+573005550142», SHA-256 igual al enviado | Sí |

**Total:** 19 de 19 casos con el resultado esperado.

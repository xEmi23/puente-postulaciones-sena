# 5. Mapeo de datos

> Del formulario público (o del JSON de la entrada genérica) a la postulación canónica del Puente y de ahí al **Simulador BUK**. Los nombres de campo del ATS son del **contrato del simulador** (API v1 propia, `snake_case`): **no** son campos verificados de BUK. Para BUK real, el mapeo de salida se rehace con su `/apidocs` (**PENDIENTE**).
> Medición campo por campo de este mapeo: [06_pruebas_y_resultados.md](06_pruebas_y_resultados.md) §6.3 (criterio 3).

## 5.1 Postulante

| Formulario público | Entrada genérica (`datos`, JSON) | PostulacionCanonica v1 (Puente) | Normalización | Simulador BUK (`POST /api/v1/seleccion/postulantes`) |
|---|---|---|---|---|
| Nombres | `candidato.nombres` (obligatorio) | `candidato.nombres` | Espacios sobrantes fuera | `nombre` |
| Apellidos | `candidato.apellidos` | `candidato.apellidos` | Igual | `apellido` |
| Correo | `candidato.correo` | `candidato.correo` | Minúsculas, sin espacios. **Sin correo → revisión humana** | `correo` (una persona = un postulante: si el correo existe, se actualiza) |
| Indicativo + Teléfono | `candidato.telefono` | `candidato.telefono` | E.164; si no trae indicativo, +57 (D-56) | `telefono` |
| Ciudad de residencia | `candidato.ciudad` | `candidato.ciudad` | Espacios sobrantes fuera | `ciudad` |
| Perfil de LinkedIn (opcional; https, dominio linkedin.com, ≤ 200) | `candidato.perfilUrl` | `candidato.perfilUrl` | — | `referencia_externa` del postulante. **Sin perfil:** la referencia del Puente (`<fuente>:<idExterno>`) |
| — | `candidato.titular` (opcional) | `candidato.titular` | — | No se envía (minimización) |

## 5.2 Hoja de vida (CV)

| Origen | Puente | Simulador BUK (`POST /postulantes/{id}/documentos`, multipart) |
|---|---|---|
| Archivo PDF del formulario o parte `cv` de la entrada genérica (≤ 5 MB, empieza por `%PDF`) | Guarda el contenido temporalmente, su **SHA-256**, tamaño y nombre. Si el JSON declara `cv.sha256` y `cv.bytes`, deben coincidir con el archivo | `archivo` + `sha256`. El ATS **recalcula** el SHA-256 y responde 422 si no coincide |
| — | Al completar, borra su copia (D-58); conserva solo el hash | `tipo = "CV"` |

## 5.3 Postulación

| Origen | Puente | Simulador BUK (`POST /postulaciones`) |
|---|---|---|
| Código del enlace público (`/postular/<código>`) o `vacanteExterna` del JSON | Correspondencia `(fuente, vacante)` → proceso del ATS. **Sin correspondencia → 422** | `proceso_id` |
| — | `atsPostulanteId`, `atsDocumentoId` | `postulante_id`, `documento_id` |
| Formulario: hash de `código + correo` · JSON: `idExterno` | Referencia global `<fuente>:<idExterno>` = clave de deduplicación (UNIQUE `fuente, idExterno`) y base de cada `Idempotency-Key` | `referencia_externa` de la postulación |
| Fuente técnica (`formulario-publico`, `<nombre de la fuente>`, `importador`) | Etiqueta visible | `fuente` («Formulario público», «Importador manual», …) |
| — | Estado `COMPLETADA` solo con `postulacion_creada` | Etapa **«Postulantes»**, «Sin calificar» |

## 5.4 Lo que se queda solo en el Puente

| Dato | Por qué no va al ATS |
|---|---|
| Prueba del consentimiento: fecha, versión del aviso (`2026-11-03.1`) y origen (HMAC de la IP; la IP nunca se guarda en claro) | Es evidencia del responsable del tratamiento, no un dato de selección |
| Ficha pública de la vacante (título, ciudad, modalidad, tipo de empleo, descripción) | Es lo que ve el candidato; el proceso del ATS no cambia (D-77) |
| `respuestas` y `origenDatos` de la canónica | No hay campo en la API del ATS; `origenDatos = "extraido-del-cv"` manda a revisión humana |
| Eventos y auditoría | Trazabilidad propia, sin nombres, correos ni teléfonos |

## 5.5 Reglas de rechazo y revisión

| Situación | Respuesta del Puente | ¿Llega al ATS? |
|---|---|---|
| Falta un obligatorio, JSON inválido, teléfono o correo mal formados | 400 (`INVALIDA`, con errores por campo) / formulario: error junto al campo | No |
| Token ausente, inválido o revocado | 401 | No |
| CV > 5 MB | 413 | No |
| Archivo que no es PDF | 415 | No |
| Vacante sin correspondencia (o enlace desactivado) | 422 / formulario: 404 | No |
| Más de 60 por minuto por token / más de 5 por IP en 10 min en el formulario | 429 con `Retry-After` / formulario: 429 | No |
| Misma `(fuente, idExterno)` / mismo correo en la misma vacante del formulario | 200 `DUPLICADA` / misma confirmación | No se crea nada nuevo |
| Sin correo, sin CV, datos extraídos sin confirmar o el mismo correo llegó al proceso por otra fuente | 202 `REQUIERE_REVISION` | Solo después de que una persona apruebe |
| Formulario sin autorización, enviado en menos de 3 s o con el campo trampa lleno | Error (o, con el campo trampa, una confirmación falsa sin registrar nada) | No |

Mapeos históricos (Simulador LinkedIn → Puente → Simulador BUK por Apply Connect, V1 y V2): [docs/mapeo-datos.md](../mapeo-datos.md).

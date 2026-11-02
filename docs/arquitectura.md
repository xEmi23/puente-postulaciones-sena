# Arquitectura

> Creado por Claude Code (2026-10-25).

## Componentes

```mermaid
flowchart LR
  subgraph Origen["Origen simulado (/origen) · esquema origen"]
    F[Formulario de postulación] -->|1 transacción| P[(Postulacion + ArchivoCv + Outbox)]
    D[Despachador<br/>worker]
    M[/api/origen/media/:id<br/>Bearer, expira 30 días/]
  end
  subgraph Puente["Puente (/api/puente, /puente) · esquema puente"]
    W[/api/puente/webhook<br/>GET challenge · POST firmado/]
    R[(Recepcion + Trabajo + Eventos)]
    PR[Procesador<br/>worker]
    PA[Panel: operaciones, correspondencias, métricas]
  end
  subgraph ATS["ATS simulado (/api/ats/v1, /ats) · esquema ats"]
    A[/API del simulador<br/>Bearer + Idempotency-Key/]
    T[(Candidato, Documento, Postulacion)]
    UI[Tablero por etapas]
  end
  P --> D
  D -->|POST X-LI-Signature<br/>reintentos ≤ 6| W
  W -->|200 inmediato| D
  W --> R
  R --> PR
  PR -->|GET mediaUrl + Bearer| M
  PR -->|candidato → documento → postulación| A
  A --> T --> UI
  PA --- R
```

- **Una app Next.js 16** (App Router) sirve los tres módulos. **Un worker** (`worker/index.ts`) ejecuta el despachador del origen y el procesador del puente. **PostgreSQL** tiene un esquema por sistema (D-02).
- **Los sistemas solo se hablan por HTTP**, aunque compartan proceso y base. El puente nunca lee tablas del origen ni del ATS.

## Recorrido de una postulación

```mermaid
sequenceDiagram
  autonumber
  participant C as Candidato
  participant O as Origen
  participant W as Worker
  participant B as Puente (webhook)
  participant A as ATS
  C->>O: Formulario + PDF
  O->>O: Postulación + CV + Outbox (1 transacción)
  W->>O: Toma la outbox (FOR UPDATE SKIP LOCKED)
  W->>B: POST EXPORT_JOB_APPLICATION + X-LI-Signature
  B->>B: Verifica firma (cuerpo crudo) · Zod · correspondencia
  B->>B: Recepcion + Trabajo (restricción única por jobApplicationId)
  B-->>W: 200 {RECIBIDO}
  W->>B: Reserva el trabajo (SKIP LOCKED + lease)
  W->>O: GET mediaUrl (Bearer, solo ORIGEN_BASE_URL)
  Note over W: paso cv_descargado (SHA-256)
  W->>A: POST /candidatos (Idempotency-Key)
  Note over W: paso candidato_creado
  W->>A: POST /candidatos/:id/documentos (+sha256)
  Note over W: paso documento_subido
  W->>A: POST /postulaciones (primera etapa)
  Note over W: paso postulacion_creada → COMPLETADO
```

## Garantías

| Riesgo | Mecanismo | Dónde |
|---|---|---|
| Perder una postulación si el envío falla | Outbox transaccional en el origen y reintentos con backoff | `src/modules/origen/` |
| Entregas falsas | HMAC-SHA256 sobre el cuerpo crudo, comparación en tiempo constante | `src/lib/firma.ts` |
| Duplicados por reenvío o concurrencia | `UNIQUE(jobApplicationId)`, `UNIQUE(recepcionId)` en el trabajo; respuesta 200 DUPLICADO | `src/modules/puente/webhook.ts` |
| Dos workers con el mismo trabajo | `FOR UPDATE SKIP LOCKED` + lease | `reclamarTrabajos` |
| Caída a mitad del recorrido | Pasos confirmados; al vencer el lease, otro worker retoma | `procesador.ts` |
| Escritura repetida en el ATS | Idempotency-Key por paso; candidato único por correo | ATS simulado |
| Respuesta perdida tras escribir | Consulta por referencia externa antes de reescribir → REQUIERE_VERIFICACION si no se puede saber | `procesador.ts`, `operaciones.ts` |
| SSRF por `mediaUrl` | Solo `ORIGEN_BASE_URL/api/origen/media/`, sin seguir redirecciones, con límite de tamaño | `descargarCv` |
| CV corrupto | Verificación `%PDF-`, tamaño y SHA-256 extremo a extremo (el ATS lo recalcula) | puente y ATS |
| Panel expuesto en un entorno real | Autenticación de demo solo con host local; si no se cumple, el panel queda cerrado | `src/lib/sesion.ts` |

Lease y tiempos: lease 60 s ≥ descarga (15 s) + 3 llamadas al ATS (10 s cada una). Ver D-14.

## Estados del puente

```mermaid
stateDiagram-v2
  [*] --> RECIBIDO
  RECIBIDO --> PROCESANDO
  PROCESANDO --> COMPLETADO
  PROCESANDO --> RECHAZADO: entrada inválida (CV, vacante, validación)
  PROCESANDO --> FALLIDO_REINTENTABLE: red / 5xx / credenciales
  FALLIDO_REINTENTABLE --> PROCESANDO: reintento automático o manual
  FALLIDO_REINTENTABLE --> REQUIERE_VERIFICACION: reintentos agotados con escritura incierta
  REQUIERE_VERIFICACION --> COMPLETADO: reconciliar (existe)
  REQUIERE_VERIFICACION --> FALLIDO_REINTENTABLE: reconciliar (no existe)
```

## Estructura del código

```
src/app/            UI y route handlers (origen/, puente/, ats/, ingresar/, api/…)
src/modules/        origen/ (postulación, vacantes, despachador) · puente/ (webhook, procesador, operaciones,
                    cliente ATS, mensajes) · ats/ (servicio, fallos) · contrato-apply-connect.ts
src/lib/            config, db, firma, sesión, archivos, privacidad, fechas
worker/             proceso del worker
prisma/             esquema (3 esquemas), migraciones, datos de demo
tests/  e2e/        Vitest (PostgreSQL real) · Playwright (app + worker reales vía supervisor)
```

---

## v2 · Tres sistemas independientes

> Actualizado por Claude Code (2026-10-29). Las secciones anteriores describen la v1 (una sola app con `/origen`, `/puente` y `/ats`); esta sección describe lo construido en la v2.

### Componentes

```mermaid
flowchart LR
  subgraph V["Vínculo :3001 (simulado)"]
    VUI["UI: empleos, perfiles,<br/>Solicitud sencilla, reclutador,<br/>portal de desarrolladores"]
    VAPI["API: /oauth/v2/accessToken<br/>/api/v1/jobPostings · /close<br/>/api/v1/media/{id} · /lifecycle"]
    VW["Despachador (outbox)<br/>firma X-LI-Signature"]
  end
  subgraph P["Puente :3003 (producto)"]
    PUI["UI: conexiones, procesos,<br/>operaciones, rechazos, métricas"]
    PWH["/api/webhooks/vinculo"]
    PW["Worker: procesador,<br/>avisos, publicación automática"]
  end
  subgraph T["Talentia :3002 (simulado)"]
    TUI["UI: procesos por etapas,<br/>postulantes, API Keys"]
    TAPI["API v1 Selección<br/>(auth_token, 120/min,<br/>Idempotency-Key)"]
  end
  DB[("PostgreSQL<br/>esquemas vinculo · talentia · puente")]
  VW -- "POST firmado<br/>EXPORT_JOB_APPLICATION" --> PWH
  PW -- "token + GET mediaUrl" --> VAPI
  PW -- "POST postulantes · documentos · postulaciones" --> TAPI
  PW -- "RESUME_DOWNLOADED" --> VAPI
  PUI -- "Publicar en Vínculo" --> VAPI
  PUI -- "lista procesos" --> TAPI
  V --- DB
  P --- DB
  T --- DB
```

- **Fronteras:** cada app tiene su `package.json`, su `.env`, su esquema y su autenticación (Better Auth con cookie propia: `vin_sesion`, `tal_sesion`, `pue_sesion`). No se importa código de dominio entre apps (D-20 a D-22); el puente solo conoce a los otros dos por sus URL y credenciales guardadas en «Conexiones» (D-41).
- **Workers:** en local y en Render corren dentro del proceso web (`WORKER_EN_PROCESO=1`, `instrumentation.ts`); en las pruebas E2E corren como procesos aparte para poder matarlos.

### Secuencia: de la «Solicitud sencilla» a Postulantes

```mermaid
sequenceDiagram
  autonumber
  actor C as Candidata
  participant V as Vínculo
  participant P as Puente
  participant T as Talentia
  Note over P,V: Antes: el admin del puente «Publica en Vínculo» el proceso 9001<br/>(externalJobId = 9001, webhook del puente validado por desafío)
  C->>V: Solicitud sencilla (datos + PDF)
  V->>V: Guarda postulación, copia del CV (mediaUrn, 30 días) y fila en outbox
  V->>P: POST /api/webhooks/vinculo (X-LI-Signature)
  P->>P: Verifica firma, valida, deduplica por jobApplicationId
  P-->>V: 200 (RECIBIDO: aún no es transferencia)
  P->>V: POST /oauth/v2/accessToken (client credentials)
  P->>V: GET mediaUrl (Bearer) → PDF + SHA-256
  P->>T: POST /postulantes (Idempotency-Key …:postulante)
  P->>T: POST /postulantes/{id}/documentos (…:documento, sha256)
  P->>T: POST /postulaciones (…:postulacion) → etapa Postulantes
  P->>P: COMPLETADO (solo con postulacion_creada)
  P->>V: POST /jobApplications/{id}/lifecycle RESUME_DOWNLOADED
  C->>V: «Mis postulaciones» → CV descargado
```

### Estados de una recepción en el puente

```mermaid
stateDiagram-v2
  [*] --> RECIBIDO: firma y datos válidos
  RECIBIDO --> PROCESANDO: el worker reclama el trabajo
  PROCESANDO --> COMPLETADO: postulacion_creada
  PROCESANDO --> FALLIDO_REINTENTABLE: Talentia/Vínculo caídos, 429, timeout
  FALLIDO_REINTENTABLE --> PROCESANDO: reintento automático (hasta 10)
  PROCESANDO --> FALLIDO_REINTENTABLE: 401/403 o sin conexión → detenido
  FALLIDO_REINTENTABLE --> PROCESANDO: «Reintentar» tras corregir
  PROCESANDO --> REQUIERE_VERIFICACION: respuesta perdida al crear la postulación
  REQUIERE_VERIFICACION --> COMPLETADO: «Reconciliar con Talentia»
  PROCESANDO --> RECHAZADO: CV inválido, vencido o demasiado grande
  COMPLETADO --> [*]
```

Las entregas inválidas en la entrada (firma, datos incompletos, mediaUrl no autorizada, vacante cerrada o sin proceso) no crean recepción: responden 4xx con el código de Apply Connect, quedan en `EntregaRechazada` (pantalla «Rechazos») y no escriben nada en Talentia.

Pasos dentro de PROCESANDO, cada uno guardado y con su Idempotency-Key: `cv_descargado → postulante_listo → documento_subido → postulacion_creada`. Una caída a mitad retoma desde el último paso guardado. El aviso `RESUME_DOWNLOADED` tiene su propio estado (`PENDIENTE → ENVIADO | FALLIDO`) y no altera el COMPLETADO (D-47).

### Estructura del código (v2)

```
apps/
  vinculo/   src/app (UI y API) · src/modules (vacantes, postulacion, despachador, aplicaciones, api/) · prisma/ · worker/ · tests/
  talentia/  src/app (UI, /api/v1, /apidocs) · src/modules (seleccion, etapas, procesos, api/) · prisma/ · tests/
  puente/    src/app (UI, /api/webhooks/vinculo) · src/modules (conexiones, webhook, procesador, avisos, publicacion,
             vinculo-cliente, ats-cliente, destino) · prisma/ · worker/ · tests/ (dobles de contrato)
e2e/         Playwright con los tres sistemas reales (supervisor.mjs los arranca y los mata)
scripts/     setup, PostgreSQL local, dev, demo:conectar
```

---

## V4 · Capas: el Puente independiente de la fuente y del ATS

> Actualizado por Claude Code (2026-11-02). Especificación: `docs/v4/ESPECIFICACION_V4.md` §5–§9. Ubicación real en el código: D-53.

```mermaid
flowchart LR
  subgraph E["Adaptadores de entrada"]
    IMP["Importador manual<br/>src/entradas/importador<br/>(PDF + CSV, confirmación humana)"]
    GEN["Entrada genérica<br/>POST /api/entradas/v1/postulaciones<br/>(token por fuente)"]
    AC["Apply Connect (Vínculo, simulado)<br/>/api/webhooks/vinculo<br/>src/entradas/apply-connect"]
    BOT["Bot de LinkedIn (experimental)<br/>NO construido: Puerta 0 pendiente"]
  end
  subgraph N["Núcleo (src/nucleo)"]
    CAN["PostulacionCanonica v1 (Zod)<br/>normalización"]
    REG["registrarRecepcion()<br/>UNIQUE(fuente, idExterno) · revisión · auditoría"]
  end
  subgraph P["Procesamiento (src/modules)"]
    PROC["procesador: pasos reanudables<br/>cv_descargado → postulante_listo →<br/>documento_subido → postulacion_creada"]
    REV["revisión, reintentos (5), reconciliación,<br/>retención, métricas por fuente"]
  end
  subgraph S["Salida (src/salidas)"]
    IF["ConectorATS<br/>(capacidades)"]
    TAL["talentia (simulado, activo)"]
    BUK["buk (deshabilitado)"]
  end
  IMP --> REG
  GEN --> CAN --> REG
  AC --> CAN
  BOT -. "usaría la entrada genérica" .-> GEN
  REG --> PROC --> IF
  REV --- PROC
  IF --> TAL
  IF -. "ATS_DESTINO=buk: no arranca" .-> BUK
```

| Capa | Responsabilidad | No hace | Dónde |
|---|---|---|---|
| Adaptadores de entrada | Obtener la postulación en su origen y convertirla a la canónica; la fuente la fija el adaptador o el token | Deduplicar, decidir revisiones, hablar con el ATS | `src/entradas/*`, `src/modules/webhook.ts` |
| Núcleo | Validar el contrato, normalizar, deduplicar, decidir revisión, guardar y encolar | Saber de qué sitio vino | `src/nucleo/*` |
| Procesamiento | Pasos con reintentos, revisión humana, reconciliación, retención, auditoría, métricas | Conocer rutas del ATS | `src/modules/{procesador,revision,retencion,operaciones}.ts` |
| Salida | Traducir los pasos a la API de cada ATS | Decidir reintentos o estados | `src/salidas/*` |

**Estados V4** (visibles; derivados de los guardados, D-52): `RECIBIDA`, `REQUIERE_REVISION`, `EN_PROCESO`, `COMPLETADA`, `FALLIDA_REINTENTABLE`, `FALLIDA_DEFINITIVA` (más `REQUIERE_VERIFICACION` de la v2: respuesta perdida del ATS). `DUPLICADA` es una respuesta, no una fila.

```mermaid
stateDiagram-v2
  [*] --> RECIBIDA: canónica válida
  [*] --> REQUIERE_REVISION: sin correo · sin CV · datos sin confirmar · posible duplicado
  REQUIERE_REVISION --> RECIBIDA: una persona completa y aprueba
  REQUIERE_REVISION --> FALLIDA_DEFINITIVA: descartada
  RECIBIDA --> EN_PROCESO
  EN_PROCESO --> COMPLETADA: postulacion_creada (con advertencia si el ATS no admite el CV)
  EN_PROCESO --> FALLIDA_REINTENTABLE: red, 5xx, 429
  FALLIDA_REINTENTABLE --> EN_PROCESO: reintento automático
  FALLIDA_REINTENTABLE --> FALLIDA_DEFINITIVA: 5 intentos, 401/403 o sin conexión
  FALLIDA_DEFINITIVA --> EN_PROCESO: «Reintentar» en el panel
  EN_PROCESO --> REQUIERE_VERIFICACION: respuesta perdida al crear
  REQUIERE_VERIFICACION --> COMPLETADA: «Reconciliar»
```

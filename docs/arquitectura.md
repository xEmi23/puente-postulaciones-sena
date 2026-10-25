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

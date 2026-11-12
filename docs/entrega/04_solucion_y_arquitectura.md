# 4. Solución y arquitectura

> Lo que se entrega es **el Puente**: un middleware que recibe postulaciones (simuladas) y las registra en «Postulantes» del proceso correcto del ATS por su API. El origen (LinkedIn) y el ATS (BUK) **no** están conectados: en la demo los reemplazan el **Simulador LinkedIn** y el **Simulador BUK**, dos aplicaciones propias.

## 4.1 Qué es real y qué es simulado

| Pieza | Estado | Comentario |
|---|---|---|
| **Puente** (`apps/puente`) | **Real** (es el producto) | Next.js 16, PostgreSQL, worker con reintentos, panel con roles |
| Formulario público `/postular/<código>` | **Real** (parte del Puente) | Lo abre el candidato desde el enlace externo de la oferta |
| Entrada genérica `POST /api/entradas/v1/postulaciones` | **Real** (parte del Puente) | Contrato propio (Decisión interna), token por fuente |
| Importador manual de PDF | **Real** (parte del Puente) | Alternativa legal cuando hay CV descargados |
| Oferta en LinkedIn con enlace externo | **Real: publicada** por el equipo con el enlace externo al formulario del Puente | Pueden llegar datos reales: ver [07](07_seguridad_y_privacidad.md) §7.0 |
| ATS de la demo: **Simulador BUK** (`apps/talentia`) | **Simulado** | Reproduce la estructura del ATS observado y una API v1 propia («contrato del simulador») |
| Adaptador BUK real (`src/salidas/buk/index.ts`) | **Deshabilitado** | Sin rutas ni encabezados: falta su `/apidocs` y la llave. **PENDIENTE: llave y API reales de BUK** |
| **Simulador LinkedIn** (`apps/vinculo`) | **Simulado**, fuera de esta entrega | Red profesional con «Solicitud sencilla» y API modelada sobre Apply Connect (apagada por defecto, D-68). Demuestra la «vía oficial futura» |
| Bot asistido (`apps/bot-linkedin`) | **Descartado** como vía de entrada (D-75) | Solo funciona contra el simulador; el perfil LinkedIn se niega a correr |

## 4.2 Flujo final

![Flujo final](img/flujo-final.png)

*Figura 4.1. Flujo final de una postulación (exportado de Mermaid).*

```mermaid
flowchart LR
  C([Candidato]) -->|paso 1: ve la oferta| LI["Oferta en LinkedIn<br/>(enlace externo)"]
  LI -->|paso 2: abre el enlace| F["Formulario público del Puente<br/>/postular/&lt;código&gt;"]
  J["Cualquier fuente con token<br/>(JSON + PDF, p. ej. Postman)"] -->|alternativa| G["Entrada genérica<br/>/api/entradas/v1/postulaciones"]
  R([Reclutador]) -->|alternativa: PDF descargados| I["Importador manual"]
  F --> N
  G --> N
  I --> N
  subgraph P["PUENTE (el producto)"]
    N["Núcleo: contrato canónico v1<br/>validación · normalización · deduplicación<br/>revisión humana · auditoría"]
    W["Procesador con pasos reanudables<br/>reintentos · idempotencia · reconciliación"]
    N --> W
  end
  W -->|paso 3: API v1 + API Key<br/>ConectorATS| T["Simulador BUK<br/>etapa «Postulantes»"]
  W -.->|ATS_DESTINO=buk<br/>deshabilitado| B["BUK real<br/>(PENDIENTE: /apidocs y llave)"]
  T --> RC([Reclutador ve al candidato<br/>con su CV en Postulantes])
```

1. El candidato ve la oferta en LinkedIn. La oferta lleva un **enlace externo** (no se usa «Solicitud sencilla» ni ninguna API de LinkedIn).
2. El enlace abre el **formulario público del Puente** de esa vacante: nombres, apellidos, correo, teléfono con indicativo, ciudad, perfil de LinkedIn (opcional), CV en PDF y la autorización de datos (aviso de privacidad en `/privacidad`).
3. El Puente valida, normaliza, guarda la prueba del consentimiento, evita duplicados y encola.
4. El procesador registra al candidato en el ATS **por API**: crea o actualiza el postulante, sube el CV (el ATS confirma el mismo SHA-256) y crea la postulación en la etapa «Postulantes» del proceso vinculado.
5. El reclutador ve al candidato en el ATS, sin haber descargado ni digitado nada. El operador ve cada paso en «Operaciones».

Las otras entradas (JSON con token e importador) entran al **mismo núcleo** y siguen el mismo camino. Por eso el alcance pedido por la ficha (*middleware* que recibe postulaciones simuladas en JSON y las registra por API) se cumple con cualquiera de ellas.

## 4.3 Capas

![Capas del Puente](img/capas.png)

*Figura 4.2. Capas del Puente (exportado de Mermaid).*

```mermaid
flowchart TB
  subgraph E["Adaptadores de entrada (src/entradas)"]
    E1["formulario/ (formulario público)"]
    E2["generica/ (JSON + token)"]
    E3["importador/ (PDF + CSV)"]
    E4["apply-connect/ (Simulador LinkedIn, webhook firmado)"]
  end
  subgraph NU["Núcleo (src/nucleo)"]
    N1["contrato/canonica.ts · PostulacionCanonica v1 (Zod)"]
    N2["recepcion/registrar.ts · registrarRecepcion()"]
    N3["auditoria · fuentes"]
  end
  subgraph PR["Procesamiento (src/modules)"]
    P1["procesador.ts · pasos reanudables"]
    P2["revision · retencion · operaciones · métricas"]
  end
  subgraph SA["Salida (src/salidas)"]
    S1["conector-ats.ts · interfaz ConectorATS"]
    S2["talentia/ (activo)"]
    S3["buk/ (deshabilitado)"]
  end
  E1 & E2 & E3 & E4 --> N1 --> N2 --> P1 --> S1 --> S2
  S1 -.-> S3
  N3 --- N2
  P2 --- P1
```

| Capa | Responsabilidad | No hace |
|---|---|---|
| Entrada | Convertir lo que llega (formulario, JSON, PDF, webhook) a la postulación canónica | Deduplicar, hablar con el ATS |
| Núcleo | Validar, normalizar (correo en minúsculas, teléfono E.164, nombres sin espacios sobrantes), deduplicar por `(fuente, idExterno)`, decidir revisión humana, auditar, encolar | Saber de qué sitio vino |
| Procesamiento | Ejecutar los pasos `cv_descargado → postulante_listo → documento_subido → postulacion_creada` con reintentos (5), reconciliación y retención | Conocer rutas del ATS |
| Salida | Traducir cada paso a la API del ATS (`ConectorATS`) | Decidir reintentos o estados |

Cambiar de fuente o de ATS no toca el núcleo: para BUK real basta implementar `src/salidas/buk/index.ts` con su documentación y poner `ATS_DESTINO=buk`.

## 4.4 Secuencia de una postulación por el formulario

![Secuencia](img/secuencia.png)

*Figura 4.3. Secuencia del formulario al ATS (exportado de Mermaid).*

```mermaid
sequenceDiagram
  autonumber
  actor C as Candidato
  participant F as Puente · formulario
  participant N as Puente · núcleo
  participant W as Puente · procesador
  participant T as Simulador BUK · API v1
  C->>F: GET /postular/<código> (marca de tiempo firmada)
  C->>F: POST /api/postular/<código> (datos + PDF + autorización)
  F->>F: límite por IP y vacante · campo trampa · ≥ 3 s · ≤ 5 MB · %PDF
  F->>N: registrarRecepcion(canónica, CV, consentimiento)
  N-->>F: RECIBIDA / DUPLICADA (misma respuesta al candidato)
  F-->>C: Confirmación con referencia
  W->>T: buscar/crear postulante (Idempotency-Key)
  W->>T: subir CV (SHA-256)
  T-->>W: documento con el mismo SHA-256
  W->>T: crear postulación en el proceso (etapa «Postulantes»)
  T-->>W: 201 postulación
  W->>N: COMPLETADA · se borra la copia del CV del Puente
```

## 4.5 Estados de una recepción

![Estados de una recepción](img/estados.png)

*Figura 4.5. Estados de una recepción (exportado de Mermaid).*

```mermaid
stateDiagram-v2
  [*] --> RECIBIDA: canónica válida
  [*] --> REQUIERE_REVISION: sin correo · sin CV · datos sin confirmar · posible duplicado
  REQUIERE_REVISION --> RECIBIDA: una persona completa y aprueba
  REQUIERE_REVISION --> FALLIDA_DEFINITIVA: descartada
  RECIBIDA --> EN_PROCESO
  EN_PROCESO --> COMPLETADA: postulacion_creada
  EN_PROCESO --> FALLIDA_REINTENTABLE: red, 5xx, 429
  FALLIDA_REINTENTABLE --> EN_PROCESO: reintento automático
  FALLIDA_REINTENTABLE --> FALLIDA_DEFINITIVA: 5 intentos, 401/403 o sin conexión
  FALLIDA_DEFINITIVA --> EN_PROCESO: «Reintentar» en el panel
  EN_PROCESO --> REQUIERE_VERIFICACION: respuesta perdida al crear
  REQUIERE_VERIFICACION --> COMPLETADA: «Reconciliar»
```

**Regla:** un acuse 202 no es una transferencia. Solo `postulacion_creada` en el ATS cuenta como registrada (por eso la medición de [06](06_pruebas_y_resultados.md) consulta el ATS, no la respuesta del Puente).

## 4.6 Despliegue

| Sistema | Local | Render (plan gratuito) |
|---|---|---|
| Puente | http://localhost:3003 | https://puente-postulaciones.onrender.com (rama `v4`) |
| Simulador BUK | http://localhost:3002 | https://talentia-simulado.onrender.com (rama `v4`) |
| Simulador LinkedIn | http://localhost:3001 | https://vinculo-simulado.onrender.com (rama `v2`, fuera de esta entrega) |
| Base | PostgreSQL local (`.pgdata`, puerto 5435), un esquema por app | PostgreSQL gratuito, **vence el 28/11/2026** |

Los servicios gratuitos se duermen tras unos 15 minutos y tardan 1–2 minutos en despertar. Detalle: [docs/despliegue.md](../despliegue.md).

## 4.7 Tecnología

Next.js 16.4.3 · React 19.3.1 · TypeScript 5.9.3 · Prisma 7.10.1 + PostgreSQL · Better Auth 1.7.10 · Zod 4 · unpdf 1.9.0 (texto de PDF, sin IA) · Vitest 5.0.5 · Playwright 1.64.1 + axe-core · npm workspaces · Render. Versiones exactas en cada `package.json`.

## 4.8 Más detalle

- [docs/arquitectura.md](../arquitectura.md): historia de la arquitectura (V1, V2, V4) y estructura del código.
- [docs/contratos.md](../contratos.md): contratos verificados y contratos del simulador, cada punto etiquetado.
- [05_mapeo_de_datos.md](05_mapeo_de_datos.md): campo por campo.

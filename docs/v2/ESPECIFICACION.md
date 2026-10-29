# Especificación v2 — Vínculo, Talentia y Puente

> Documento del equipo (28/10/2026) para Claude Code. Define el **cómo**. El **por qué** está en `docs/v2/SOLUCION.md`.
> Lo que aquí se marca **(contrato del simulador)** lo inventamos nosotros y así debe documentarse; nunca se presenta como API oficial de LinkedIn o BUK.
> Si algo de este documento choca con una regla de seguridad, gana la seguridad y se registra la decisión.

## 0. Principios que no se negocian

1. Tres aplicaciones independientes. Ninguna importa código de dominio de otra ni lee el esquema de otra. Se hablan solo por HTTP con las URLs configuradas.
2. El puente es el producto: fiabilidad igual o mejor que la v1 (firma, deduplicación con restricción única, outbox, `SKIP LOCKED` + lease, pasos confirmados, reconciliación, Idempotency-Key, verificación SHA-256 del CV, sin SSRF).
3. Realismo de experiencia, no de marca: nombres, logos y colores propios. Cada pantalla muestra «Entorno de simulación».
4. Solo datos ficticios. Ningún nombre de la empresa retadora en código, seeds, UI ni documentos publicables.
5. Todo en español en la interfaz. Código y nombres técnicos pueden ir en inglés o español, pero de forma consistente por app.
6. No se debilitan pruebas para que pasen. Se reporta exactamente qué se ejecutó.

## 1. Estructura del repositorio

```
apps/
  vinculo/     Next.js · puerto 3001 · esquema "vinculo"
  talentia/    Next.js · puerto 3002 · esquema "talentia"
  puente/      Next.js · puerto 3003 · esquema "puente" · worker/
packages/      (opcional) SOLO utilidades sin dominio: config de ESLint/TS, componentes de UI genéricos.
               Prohibido compartir modelos, contratos o lógica de negocio entre apps.
e2e/           Playwright: recorrido entre los 3 sistemas
scripts/       PostgreSQL local, arranque conjunto, generación de datos y CV
docs/          v1 (histórico), v2 (documentos del equipo), y los técnicos que genere Claude Code
render.yaml    Blueprint de despliegue
```

- npm workspaces (sin cambiar de gestor de paquetes).
- Cada app tiene su propio `prisma/schema.prisma`, sus migraciones y su cliente generado en una ruta propia.
- Local: un clúster PostgreSQL del proyecto (como en v1) en el **puerto 5435** (la v1 usa 5433 y puede seguir corriendo), una base `tb2_dev` (y `tb2_test` para pruebas) con los tres esquemas.
- `npm run dev` levanta las tres apps y los workers. `npm run setup` deja todo listo desde cero.
- Cookies con nombre distinto por app (en `localhost` las cookies no se separan por puerto). Prefijos: `vin_`, `tal_`, `pue_`.

## 2. Vínculo (red profesional simulada, tipo LinkedIn)

Identidad: color principal propio (sugerido verde azulado), logo tipográfico «Vínculo». Nada que recuerde la marca de LinkedIn.

### 2.1 Roles y acceso
- **Candidato**: registro con correo y contraseña; perfil propio.
- **Reclutador**: pertenece a una empresa; gestiona sus vacantes e integraciones.
- **Desarrollador**: cualquier cuenta puede abrir el portal de desarrolladores y registrar aplicaciones.
- Librería de autenticación mantenida (Better Auth o Auth.js); contraseñas con hash; sesiones con cookie `vin_`. Documentar la elección.
- La pantalla de inicio de sesión muestra un cuadro «Cuentas de demostración» con 2 candidatos y 1 reclutador (contraseña común de demo). Es un entorno de simulación con datos ficticios: mostrarlas es intencional.

### 2.2 Pantallas
| Ruta | Quién | Contenido |
|---|---|---|
| `/` | Público | Portada con buscador y vacantes destacadas |
| `/empleos` | Público | Buscador: texto, ciudad, modalidad (presencial/híbrido/remoto), nivel, empresa; paginado |
| `/empleos/[id]` | Público | Detalle; botón **«Solicitud sencilla»** si la vacante tiene postulación en la plataforma; si no, «Postularse en el sitio de la empresa» (enlace) |
| `/empleos/[id]/solicitar` | Candidato | Modal o página de 2 pasos: confirmar datos de contacto y elegir CV (el del perfil o uno nuevo, solo PDF ≤ 5 MB); preguntas de la vacante si las hay; enviar |
| `/in/[slug]` | Público | Perfil: foto (avatar de iniciales), titular, ciudad, acerca de, experiencia, educación, habilidades |
| `/mi-perfil` | Candidato | Editar perfil y subir CV |
| `/mis-postulaciones` | Candidato | Lista con estado: Enviada → Vista por la empresa → CV descargado → (No seleccionado) |
| `/empresas/[slug]` | Público | Página de empresa con sus vacantes |
| `/reclutador` | Reclutador | Panel: vacantes de su empresa, postulantes por vacante, descarga manual de CV (esto es lo que hoy se hace a mano y el puente elimina) |
| `/reclutador/vacantes/nueva`, `/[id]` | Reclutador | Crear, editar, publicar, cerrar |
| `/reclutador/integraciones` | Reclutador | **Conectar ATS**: autorizar una aplicación de integrador para su empresa; ver estado del webhook; revocar |
| `/developers` | Desarrollador | Mis aplicaciones: crear (nombre, URL de webhook), ver Client ID, Client Secret visible una sola vez, regenerar, revocar; documentación de la API |
| `/developers/docs` | Público | Documentación de la API de Vínculo (OpenAPI renderizado) |

### 2.3 API de Vínculo (contrato del simulador, modelado sobre Apply Connect)
Basado en lo **Verificado** en `docs/contratos.md` de la v1 (F1, F2). Lo que no está en la documentación de LinkedIn se marca contrato del simulador.

| Función | Ruta (simulador) | Reglas |
|---|---|---|
| Token | `POST /oauth/v2/accessToken` (`grant_type=client_credentials`, `client_id`, `client_secret`) | Devuelve `access_token` (JWT firmado, 60 min) y `expires_in`. Credenciales malas → 401 |
| Publicar vacante desde un ATS | `POST /api/v1/jobPostings` (Bearer) | Campos: `externalJobId`, `companyId`, `title`, `description`, `location`, `workplaceType`, `employmentType`, `listingType`, `onsiteApply: { jobApplicationWebhookUrl }`. Requiere que la empresa haya autorizado la aplicación. Idempotente por (`applicationId`, `externalJobId`): repetir actualiza |
| Cerrar vacante | `POST /api/v1/jobPostings/{externalJobId}/close` | Estado CLOSED; nuevas postulaciones rechazadas |
| Validación del webhook | Vínculo hace `GET {webhookUrl}?challengeCode=<uuid>&applicationId=<id>` | Espera JSON `{challengeCode, challengeResponse = hex(HMAC-SHA256(challengeCode, clientSecret))}` en < 3 s. Al registrar la URL y antes de publicar una vacante con postulación en plataforma. Si falla, la vacante queda como «postulación en el sitio de la empresa» (igual que LinkedIn) |
| Entrega de postulación | Vínculo hace `POST {webhookUrl}` | Payload `EXPORT_JOB_APPLICATION` como en v1 (F1). Encabezado `X-LI-Signature` = hex(HMAC-SHA256("hmacsha256=" + cuerpo crudo, clientSecret)) (decisión D-04 de v1). 200 = recibido. Otro código → reintentos con backoff, máximo 6, ventana total ≥ 10 minutos (cubre arranques en frío de Render) |
| Descarga del CV | `GET mediaUrl` con `Authorization: Bearer <token de la aplicación>` | Válido 30 días; solo para la aplicación dueña de la vacante; 401/403/404 en otro caso |
| Estado al candidato | `POST /api/v1/jobApplications/{jobApplicationId}/lifecycle` `{ action: VIEWED | RESUME_DOWNLOADED | REJECTED }` | Actualiza «Mis postulaciones». Idempotente |
| Salud | `GET /api/salud` | Sin datos sensibles |

Fuera de alcance: perfiles por API, búsqueda de candidatos, mensajería, feed social.

### 2.4 Despachador de Vínculo
Outbox transaccional como en v1. En Render corre dentro del mismo proceso web (ver §6). Registra cada intento y lo muestra a la empresa en `/reclutador/integraciones` (últimos envíos, sin datos personales completos).

## 3. Talentia (ATS simulado, tipo BUK)

Identidad: color principal propio (sugerido índigo), logo tipográfico «Talentia». Estructura según `docs/referencia-ats.md`.

### 3.1 Roles y acceso
- **Administrador** y **Reclutador** de la empresa demo «Andina Software S.A.S.» (ficticia). Cookie `tal_`. Cuentas de demostración visibles en el inicio de sesión.

### 3.2 Pantallas
| Ruta | Quién | Contenido |
|---|---|---|
| `/` | Ambos | Menú lateral: Desarrollo organizacional → Selección → Procesos, Postulantes, Plantillas (vacía, «Próximamente»), Configuraciones |
| `/seleccion/procesos` | Ambos | Lista con número, título, prioridad, inicio, vigencia, estado, contador de postulantes |
| `/seleccion/procesos/nuevo` | Ambos | Crear proceso |
| `/seleccion/procesos/[id]` | Ambos | Encabezado (número, título, prioridad, inicio, vigencia, estado «Iniciado»); pestañas (Información general, Proceso activa; el resto visibles y deshabilitadas o con contenido mínimo); **Vista columna** (9 etapas con tipo, contador y «Descartados (n)») y **Vista tabla**; tarjetas con nombre, fecha, «Sin calificar», fuente, casilla; mover tarjeta entre etapas (selector o arrastrar); aviso «N postulantes nuevos fueron agregados al proceso» |
| `/seleccion/postulantes` | Ambos | Base de postulantes con búsqueda |
| `/seleccion/postulantes/[id]` | Ambos | Ficha: datos, procesos en los que está, CV descargable con su SHA-256, historial |
| `/admin/api-keys` | Admin | Crear llave (nombre, permisos por módulo: Selección → Lectura y/o Modificación), mostrar una sola vez, listar (prefijo, permisos, creada, último uso), revocar |
| `/admin/actividad-api` | Admin | Registro de llamadas: fecha, llave (prefijo), método, ruta, estado, duración |
| `/apidocs` | Público | Documentación interactiva (OpenAPI con Scalar o Swagger UI) con botón para probar con la llave |

Etapas (orden y tipo, de `docs/referencia-ats.md`): Postulantes (Entrada), Por contactar (Filtro), Referidos (Validaciones), Sagrilaft (Validaciones), Prueba técnica (Filtro), Entrevista técnica (Entrevistas), Valoración psicológica (Entrevistas), Suspendido (Filtro), Contratados (Etapa final).

### 3.3 API de Talentia (recursos y permisos Verificados de BUK; rutas y campos = contrato del simulador)
- Autenticación: API Key en un encabezado. **Investigar** en el centro de ayuda público de BUK el nombre del encabezado; si no se puede verificar, usar `auth_token` y marcarlo **Supuesto pendiente**. Llave guardada con hash (SHA-256 + prefijo visible). Sin llave o revocada → 401; sin permiso → 403.
- Permisos: GET requiere Lectura; POST/PATCH requiere Modificación.
- Límite: 120 solicitudes por minuto por llave → 429 con `Retry-After`.
- Todas las escrituras aceptan `Idempotency-Key` (capacidad del simulador, NO atribuida a BUK).

| Recurso | Operaciones | Notas |
|---|---|---|
| `/api/v1/seleccion/procesos` | GET (lista, filtro por estado), GET `/{id}`, POST | Verificado: consultar y crear |
| `/api/v1/seleccion/postulantes` | GET (filtro `email`), GET `/{id}`, POST, PATCH `/{id}` | Verificado: consultar, crear, actualizar |
| `/api/v1/seleccion/postulantes/{id}/documentos` | POST multipart (PDF + `sha256`), GET | Contrato del simulador (Supuesto: adjuntos de BUK no verificados). Recalcula SHA-256 y responde 422 si no coincide |
| `/api/v1/seleccion/postulaciones` | GET (filtros `proceso_id`, `referencia_externa`), GET `/{id}`, POST, PATCH `/{id}` (etapa) | Verificado: consultar, añadir, modificar. POST la deja en la primera etapa con `fuente` y `referencia_externa` únicas |

Formato de error uniforme `{ error: { codigo, mensaje } }`. OpenAPI 3.1 generado desde los esquemas Zod o escrito a mano y probado contra la implementación.

## 4. Puente (nuestro producto)

Identidad: sobria y técnica (sugerido grafito con acento ámbar), logo «Puente». Cookie `pue_`.

### 4.1 Roles
- **Administrador** (configura conexiones) y **Operador** (supervisa). Cuentas de demostración visibles en el inicio de sesión.

### 4.2 Pantallas
| Ruta | Contenido |
|---|---|
| `/conexiones` | **Vínculo**: URL base, Client ID, Client Secret (cifrado), botón «Probar conexión» (obtiene token), URL del webhook del puente para copiar en Vínculo, estado de la última validación. **Talentia**: URL base, API Key (cifrada), «Probar conexión» (lista procesos y muestra permisos). Asistente de 3 pasos la primera vez |
| `/procesos` | Procesos de Talentia leídos por API; por cada uno: «Publicar en Vínculo» (crea la vacante por la API de Vínculo con `externalJobId` = id del proceso y el webhook del puente), estado de publicación, «Cerrar en Vínculo». Opción de publicación automática de procesos nuevos (sondeo cada 2 minutos) |
| `/correspondencias` | Vínculos manuales vacante de Vínculo → proceso de Talentia, para vacantes creadas directamente en Vínculo |
| `/operaciones`, `/operaciones/[id]` | Como v1: estado, pasos con hora, intentos, reintento seguro, reconciliar |
| `/rechazos` | Como v1 |
| `/metricas` | Recibidas, completadas, rechazadas, duplicados evitados, en reintento, requieren verificación; tiempo de recepción a completado (mediana y p95 con n); por proceso |
| `/pruebas` | Inyección de fallos (como v1). Solo visible si `PUENTE_MODO_PRUEBAS=1`; en Render queda apagado |

### 4.3 Flujo del worker (por postulación)
1. Webhook: verificar firma con el Client Secret guardado, validar con Zod, resolver proceso (por `externalJobId` de una publicación hecha por el puente, o por correspondencia manual; si no hay → `JOB_POSTING_CLOSED`), guardar recepción + trabajo, responder 200.
2. Obtener token de Vínculo (cacheado hasta 5 minutos antes de vencer).
3. Descargar CV del `mediaUrl` (solo si el host coincide con la URL base de Vínculo configurada), validar PDF y tamaño, SHA-256 → `cv_descargado`.
4. Talentia: buscar postulante por correo; crear o actualizar → `postulante_listo`.
5. Subir documento con SHA-256 → `documento_subido`.
6. Crear postulación con `referencia_externa` = `jobApplicationId` → `postulacion_creada` → COMPLETADO.
7. Avisar a Vínculo `RESUME_DOWNLOADED` (no bloquea el COMPLETADO; si falla se reintenta aparte).
Cada escritura con `Idempotency-Key` derivada de (`jobApplicationId`, paso). Respuesta perdida → consultar por `referencia_externa` antes de reescribir; si no se puede saber → REQUIERE_VERIFICACION. 401 de Talentia (llave revocada) → detener sin reintentar y mostrar «La API Key de Talentia fue revocada o no es válida». 429 → respetar `Retry-After`.

### 4.4 Secretos
Client Secret y API Key cifrados con AES-256-GCM usando `PUENTE_CLAVE_CIFRADO` (variable de entorno, 32 bytes). Nunca se devuelven completos a la interfaz; se muestran como `••••abcd`.

## 5. Datos de demostración (todos ficticios)

- Vínculo: 40 candidatos con perfiles completos y CV PDF generado (diseño profesional, una o dos páginas, coherente con el perfil), 6 empresas (incluida «Andina Software S.A.S.»), 18 vacantes (6 de Andina). Nombres colombianos plausibles generados por combinación; revisar que no correspondan a figuras públicas conocidas. Avatares de iniciales, sin fotos de personas reales.
- Talentia: «Andina Software S.A.S.» con 6 procesos (números 9001–9006) y 15 postulantes ya distribuidos en etapas para que el tablero se vea vivo.
- Puente: sin conexiones configuradas (la demo las configura en vivo) y un script `demo:conectar` que las configura solo, para pruebas y plan B.
- `demo:reset` por app: borra y re-siembra solo datos de demo; se niega en producción salvo `DEMO_RESET_PERMITIDO=1` y confirmación explícita.

## 6. Despliegue en Render (plan gratuito)

- `render.yaml` en la raíz: 3 servicios `type: web`, `plan: free`, `runtime: node`, `region: oregon` (o la que Render permita gratis), cada uno con `buildCommand`/`startCommand` del workspace y `buildFilter.paths` de su app; 1 base `plan: free`.
- Una sola base gratuita (límite de Render: una por workspace). Cada app recibe `DATABASE_URL` con `fromDatabase.property: connectionString` y su `DB_SCHEMA` (`vinculo`, `talentia`, `puente`); el código agrega el esquema a la conexión. Registrar como decisión: en producción cada sistema tendría su propia base.
- Secretos con `generateValue: true` (secreto de sesión de cada app y `PUENTE_CLAVE_CIFRADO`). Nada de `sync: false`: la persona no debe pegar valores a mano.
- URL pública de cada servicio: Render la expone en `RENDER_EXTERNAL_URL`; cada app la usa para sus propios enlaces. Las URLs de los otros sistemas NO van en variables de entorno: el puente las recibe en `/conexiones` y Vínculo recibe el webhook en `/developers` (igual que en la vida real).
- Workers: los servicios gratuitos no permiten workers. El despachador de Vínculo y el procesador del puente corren dentro de su proceso web (por ejemplo, arranque con un script que lanza `next start` y el worker, o con `instrumentation.ts`), con apagado ordenado. Localmente siguen pudiendo correr aparte.
- Arranque en frío (~1 min): reintentos con ventana ≥ 10 minutos; tiempo de espera por llamada ≥ 75 s en el primer intento hacia un servicio dormido; la interfaz del puente muestra «Despertando Talentia…» en «Probar conexión».
- Migraciones y datos de demo: en el `startCommand`, `prisma migrate deploy` + siembra solo si la base está vacía (idempotente), luego iniciar. No hay shell en el plan gratuito.
- Sin disco persistente: los CV se guardan en la base (como v1).
- Servicios gratuitos no reciben tráfico privado: todo por las URLs públicas `https://*.onrender.com`.
- Las 750 horas gratuitas al mes alcanzan porque los servicios duermen sin tráfico. No configurar pings para mantenerlos despiertos.

## 7. Criterios de aceptación (todos con prueba automática)

1. Cada sistema abre en su propio puerto con su propio inicio de sesión; la sesión de uno no da acceso a otro.
2. Talentia: un admin crea una API Key, la ve una sola vez, y con ella crea un postulante por API; con una llave solo de Lectura, el POST da 403; revocada, 401.
3. `/apidocs` y `/developers/docs` cargan y sus ejemplos coinciden con la implementación (prueba de contrato).
4. Vínculo: un desarrollador registra una aplicación; el Client Secret se ve una sola vez; el token se obtiene con client credentials.
5. Puente: con las credenciales, «Probar conexión» funciona contra los dos sistemas; el webhook pasa la validación por desafío.
6. Desde el puente, «Publicar en Vínculo» un proceso crea la vacante en Vínculo con «Solicitud sencilla».
7. Un candidato inicia sesión, aplica con «Solicitud sencilla» y en menos de 30 s (local) aparece en Postulantes del proceso correcto en Talentia, con CV de SHA-256 idéntico.
8. El candidato ve «CV descargado» en «Mis postulaciones».
9. Reenvío del mismo evento: una sola postulación; dos entregas simultáneas: una sola.
10. La misma persona en dos procesos: un postulante, dos postulaciones.
11. Talentia caído: reintento y entrega al volver; reinicio del puente a mitad: retoma sin duplicar; respuesta perdida: reconciliación.
12. API Key revocada: el puente se detiene con mensaje claro y no reintenta.
13. Firma inválida, datos incompletos, PDF inválido, vacante cerrada: rechazo con el código documentado y cero escrituras en Talentia.
14. Accesibilidad WCAG 2.1 AA sin violaciones graves en las pantallas principales de los tres sistemas; escritorio y móvil sin desbordes.
15. Instalación limpia desde el README; `render blueprints validate` sin errores.

## 8. Documentación que debe quedar (técnica, la genera Claude Code)

- `README.md` (instalación, arranque, demo, despliegue).
- `docs/arquitectura.md` (diagramas Mermaid de los 3 sistemas, secuencia, estados).
- `docs/contratos.md` (actualizado: Vínculo vs Apply Connect, Talentia vs BUK, cada punto etiquetado).
- `docs/decisiones.md` (continúa desde D-19 de v1; nuevas desde D-20).
- `docs/mapeo-datos.md` (Vínculo → puente → Talentia).
- `docs/manuales/` uno por rol: candidato, reclutador de Vínculo, desarrollador, admin de Talentia, reclutador de Talentia, admin y operador del puente.
- `docs/seguridad.md` (llaves, cifrado, sesiones, Ley 1581, retención y borrado).
- `docs/despliegue.md` (Render paso a paso, límites del plan gratuito, cómo despertar antes de presentar).
- `docs/guion-demo.md` (7 minutos, local y en Render, plan B).
- `docs/resultados-pruebas.md` y `docs/estado.md` (continuar).
- `docs/uso-ia.md` (actualizar).

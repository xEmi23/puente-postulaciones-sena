# Seguridad y datos personales

> Actualizado por Claude Code (2026-10-29). Describe lo construido en la v2. Etiquetas: **Verificado** (en código y pruebas), **Decisión interna** (docs/decisiones.md), **Supuesto pendiente**. Es un prototipo académico con datos ficticios: no es una evaluación de seguridad ni una opinión jurídica.

## Secretos y llaves

| Secreto | Dónde vive | Cómo se guarda | Etiqueta |
|---|---|---|---|
| Contraseñas de usuarios (las 3 apps) | Base de cada app (`Account`) | Hash de Better Auth (scrypt); nunca en claro | Verificado (D-27) |
| `BETTER_AUTH_SECRET` (firma de sesiones) | `.env` de cada app, distinto por app | Aleatorio, generado por `npm run setup` o por Render (`generateValue`) | Decisión interna |
| API Key de Talentia | Talentia (`ApiKey`) | Solo su **SHA-256** y un prefijo visible; se muestra una vez al crearla; revocable | Verificado (`apps/talentia/tests/api.test.ts`) |
| Client Secret de una aplicación de Vínculo | Vínculo (`AplicacionDev`) | **Cifrado** AES-256-GCM con `VINCULO_CLAVE_CIFRADO` (hace falta el valor para firmar y validar el desafío); se muestra una vez; regenerable | Verificado (D-31, `apps/vinculo/tests/integradores.test.ts`) |
| Access tokens de Vínculo | No se guardan | JWT HS256 de 60 min con la versión del secreto (regenerar el secreto los invalida) | Verificado (D-32) |
| Client Secret de Vínculo y API Key de Talentia **en el puente** | Puente (`Conexion`) | Cifrados AES-256-GCM con `PUENTE_CLAVE_CIFRADO`; en pantalla solo `••••` + 4 caracteres | Verificado (D-41, `apps/puente/tests/conexiones.test.ts`) |

- Ningún secreto está en el repositorio: `.env*` está en `.gitignore` (salvo las plantillas `.env.example`, sin valores). Los datos de prueba usan credenciales fijas y evidentemente falsas dentro de `tests/`.
- Ningún secreto se comparte entre apps: las credenciales entre sistemas se crean en las pantallas de cada uno (o con `npm run demo:conectar`, que hace lo mismo por procesos).
- Las comparaciones de firmas y desafíos son en tiempo constante (`timingSafeEqual`).

## Sesiones y acceso

- Cada app tiene su cookie: `vin_sesion`, `tal_sesion`, `pue_sesion` (HttpOnly, SameSite=Lax; `Secure` en https). En localhost las cookies no se separan por puerto, por eso los nombres son distintos: la sesión de una app no da acceso a otra (criterio 1, `e2e/panel.spec.ts`). **Verificado.**
- Duración: 8 h en Talentia y el puente; 7 días en Vínculo (red social). **Decisión interna.**
- Roles: Talentia ADMIN/RECLUTADOR (API Keys solo ADMIN); puente ADMIN/OPERADOR (conexiones, publicación, correspondencias y controles de prueba solo ADMIN); Vínculo CANDIDATO/RECLUTADOR. Las acciones de servidor vuelven a comprobar el rol, no solo la pantalla.
- Talentia y el puente no tienen registro público. Vínculo sí (es una red social).
- Los **controles de prueba** del puente (inyección de fallos) solo existen con `PUENTE_MODO_PRUEBAS=1` **y** un entorno local; en Render están apagados.

## Integraciones

- **Firma de las entregas:** el puente rechaza (401, sin escribir nada) cualquier entrega sin `X-LI-Signature` válida sobre el cuerpo crudo.
- **Descarga del CV:** solo desde el host de Vínculo configurado y la ruta `/api/v1/media/`; sin seguir redirecciones; con límite de tamaño (`CV_MAX_BYTES`), verificación de PDF y de bytes completos. **Verificado** (`apps/puente/tests/webhook.test.ts`, `p5.test.ts`).
- **SSRF:** Vínculo solo llama webhooks http(s) sin credenciales en la URL; en un despliegue público exige https y rechaza destinos en redes privadas, loopback o enlace local (D-37). El puente valida las URL de «Conexiones» (solo http/https).
- **Límite de Talentia:** 120 solicitudes por minuto por llave (429 con `Retry-After`).
- **Idempotencia:** cada escritura del puente en Talentia lleva `Idempotency-Key`; reintentos y caídas no duplican.

## Datos personales (Ley 1581 de 2012, Colombia)

- **Supuesto pendiente (revisión del equipo):** la Ley 1581 de 2012 regula el tratamiento de datos personales en Colombia (autorización del titular, finalidad, acceso, rectificación y supresión). El prototipo no trata datos reales, pero muestra cómo se haría:
  - Vínculo informa la finalidad al crear la cuenta y al enviar cada solicitud (texto visible en `/registro` y en el paso 2 de la Solicitud sencilla).
  - Solo se transfiere lo necesario para la selección: nombre, apellido, correo, teléfono, ciudad, la hoja de vida y la referencia de la solicitud.
  - El panel del puente muestra el correo enmascarado; el CV no se muestra en el puente.
- **Retención y borrado (lo implementado):**
  - El puente borra el contenido del CV al completar o rechazar la transferencia; conserva solo su SHA-256 para auditoría.
  - En Vínculo, el enlace `mediaUrl` de cada solicitud vence a los 30 días.
  - `npm run demo:reset` borra y vuelve a sembrar los datos demo de cada app (se niega en producción o con una base no local).
- **PENDIENTE (equipo/empresa):** política de privacidad real, plazo de retención en el ATS, y procedimiento para atender una solicitud de supresión de un candidato (borrar en Talentia, y en el puente su recepción y eventos).

## Registros

- Los registros del worker y de la actividad de la API no incluyen secretos ni el contenido del CV; la actividad de la API guarda la ruta como plantilla (sin datos personales en la URL). Revisado en F6 (ver docs/estado.md).

---

## V4 · Fuentes, revisión, auditoría y retención

> Actualizado por Claude Code (2026-11-02). Especificación §11. **Esto no es asesoría jurídica** y no se afirma cumplimiento de ninguna norma.

| Control | Implementación V4 | Etiqueta |
|---|---|---|
| Tokens de fuente | Se muestran una vez; se guarda solo su SHA-256 y un prefijo; comparación en tiempo constante; rotar invalida el anterior; revocar desactiva la fuente (D-59) | Verificado (`tests/entrada-generica.test.ts`) |
| Quién administra | Solo ADMIN crea fuentes, genera o revoca tokens y borra datos del candidato; OPERADOR importa, revisa, aprueba, descarta y reintenta | Verificado (`e2e/entrada-generica.spec.ts`) |
| Límites de entrada | PDF (`%PDF`), 5 MB, 20 PDF por importación, 60 peticiones/min por token (en memoria, D-59) | Verificado |
| Datos mínimos | Solo los campos del contrato canónico; sin fotos ni perfil completo | Decisión interna |
| Revisión humana | Lo incompleto o el posible duplicado espera a una persona; nunca se fusiona solo (D-61) | Verificado |
| Auditoría | `EventoAuditoria`: actor (usuario, fuente o sistema), acción, recepción y hora; sin nombres, correos ni teléfonos | Verificado (G-8) |
| Logs | Una línea por evento con `idRecepcion`; los correos se enmascaran y los nombres no se escriben | Verificado (G-9) |
| Retención | El Puente borra su copia del CV al completar si el ATS ya lo tiene (v2); lo que conserva se borra a los `RETENCION_CV_DIAS` (30) días; los lotes de importación sin confirmar, a las 24 h (D-58, D-64) | Verificado (G-7) |
| Supresión a pedido | «Borrar datos del candidato» (ADMIN): borra nombre, correo, teléfono, ciudad y CV del Puente; queda el hash y el evento auditado. La supresión en el ATS la hace el ATS | Verificado (G-7) |
| Bot de LinkedIn | **No construido** (Puerta 0 pendiente). Si se construye, solo con una cuenta del equipo, ventana visible, sin contraseñas ni evasión (§8.3); la cláusula 8.2 del Acuerdo de Usuario de LinkedIn prohíbe bots | Supuesto pendiente |

**Obligaciones para un uso real (pendientes de la empresa, como responsable del tratamiento):** autorización previa, expresa e informada del candidato; atención de los derechos del titular; contrato de transmisión con el proveedor de servidores en el exterior (Circular Externa 003 de 2025 de la SIC); inscripción en el Registro Nacional de Bases de Datos si aplica; aprobación de su área legal para cualquier uso del bot. Todo esto es **Supuesto pendiente**: el prototipo trata solo datos ficticios.

---

## Entrega final · Formulario público y pendientes

> Actualizado por Claude Code (2026-11-11). Resumen para evaluadores: [docs/entrega/07_seguridad_y_privacidad.md](entrega/07_seguridad_y_privacidad.md).

- **Formulario público (D-76, D-77):** 5 envíos por IP cada 10 minutos, 100 por vacante cada hora, campo trampa, ≥ 3 s de llenado con marca firmada, tope de 5 MB antes de leer el cuerpo, PDF por contenido, respuesta idéntica para un envío nuevo o repetido. **Verificado** (Vitest `formulario.test.ts`, E2E `formulario.spec.ts`) y comprobado otra vez el 11/11 en local (sin autorización, PDF falso y envío rápido se rechazan y no llegan al ATS).
- **Prueba del consentimiento:** fecha, versión del aviso (`2026-11-03.1`) y origen (HMAC de la IP). **Verificado.**
- **Aviso de privacidad:** borrador rotulado «pendiente de validación legal (Ley 1581 de 2012)».
- **PENDIENTE (nunca cumplido):** validación legal del aviso; correo de privacidad real en `PRIVACIDAD_CORREO` (en Render hoy es un marcador); identificación del responsable; llave y API reales de BUK; verificación de la cuenta de LinkedIn de la empresa; **encabezado de IP confiable en Render** (en local el Puente acepta `X-Forwarded-For` del cliente, así que el límite por IP depende de que el proxy de Render lo reescriba).
- **Revisión del repositorio antes de publicar (11/11):** sin el nombre, la identificación, la dirección ni los contactos de la empresa, sin tokens ni contraseñas reales, en todo lo versionado y en todo el historial (incluido el `.docx`). Resultado en [docs/entrega/06_pruebas_y_resultados.md](entrega/06_pruebas_y_resultados.md) §6.6.

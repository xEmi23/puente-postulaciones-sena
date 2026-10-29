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

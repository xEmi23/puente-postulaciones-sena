# 7. Seguridad y privacidad

> Prototipo académico con **datos ficticios** (`@demo.test`). **No es una evaluación de seguridad ni asesoría jurídica**, y no se afirma cumplimiento de ninguna norma. Etiquetas: **Verificado** (en código y pruebas), **Decisión interna** ([docs/decisiones.md](../decisiones.md)), **Supuesto pendiente**, **PENDIENTE** (lo debe resolver la empresa o el equipo).
> Detalle técnico completo: [docs/seguridad.md](../seguridad.md).

## 7.1 Controles del Puente

| Área | Control | Etiqueta |
|---|---|---|
| Credenciales del ATS | API Key cifrada con AES-256-GCM en la base del Puente (`PUENTE_CLAVE_CIFRADO`); en pantalla solo `••••` y 4 caracteres | Verificado (`apps/puente/tests/conexiones.test.ts`) |
| Tokens de fuente (entrada JSON) | Se muestran una vez; se guarda solo su SHA-256 y un prefijo; comparación en tiempo constante; rotar invalida el anterior; revocar desactiva la fuente | Verificado (`tests/entrada-generica.test.ts`) |
| Panel | Inicio de sesión (Better Auth), cookie propia `pue_sesion` (HttpOnly, SameSite=Lax, Secure en https), 8 h; roles ADMIN y OPERADOR comprobados también en el servidor | Verificado (`e2e/panel.spec.ts`, `e2e/entrada-generica.spec.ts`) |
| Formulario público | 5 envíos por IP cada 10 min; 100 por vacante cada hora; campo trampa; ≥ 3 s de llenado con marca firmada (HMAC, vence a las 2 h); tope de tamaño antes de leer el cuerpo; PDF por contenido; misma respuesta para nuevo o repetido (no revela si un correo existe) | Verificado (`tests/formulario.test.ts`, `e2e/formulario.spec.ts`) |
| Entrada genérica | 60 peticiones por minuto por token (429 + `Retry-After`); PDF ≤ 5 MB y `%PDF` | Verificado; medido otra vez el 11/11 ([06](06_pruebas_y_resultados.md)) |
| Integridad del CV | SHA-256 al recibir; el ATS lo recalcula y rechaza si no coincide | Verificado |
| Duplicados | UNIQUE `(fuente, idExterno)`; `Idempotency-Key` en cada escritura al ATS; reconciliación antes de reintentar | Verificado |
| Registros (logs) | Solo el id de la recepción; correos enmascarados; sin nombres, teléfonos ni contenido del CV | Verificado (G-9) |
| Auditoría | `EventoAuditoria`: actor, acción, recepción y hora; sin datos personales | Verificado (G-8) |
| Secretos en el repositorio | `.env` y `.env.*` ignorados; solo plantillas `.env.example` sin valores; Render genera los secretos (`generateValue`) | Verificado el 11/11 con `git check-ignore` y búsqueda en el historial ([06](06_pruebas_y_resultados.md) §6.6) |
| Modo de pruebas | Los controles para inyectar fallos solo existen con `PUENTE_MODO_PRUEBAS=1` **y** entorno local; en Render están apagados | Verificado |

## 7.2 Datos personales (Ley 1581 de 2012)

| Principio / obligación | Cómo lo muestra el prototipo | Estado |
|---|---|---|
| Autorización previa, expresa e informada | Casilla obligatoria en el formulario con enlace al aviso; sin ella no se recibe la postulación | Implementado; **validación legal PENDIENTE** |
| Prueba de la autorización | Cada recepción guarda `consentimientoEn`, `consentimientoVersion` (`2026-11-03.1`) y `consentimientoOrigen` (HMAC de la IP; la IP nunca en claro) | Verificado (`tests/formulario.test.ts`) |
| Finalidad | El aviso explica para qué se usan los datos | Borrador |
| Minimización | Solo nombres, apellidos, correo, teléfono, ciudad, perfil (opcional) y CV | Decisión interna (D-77) |
| Retención | El Puente borra su copia del CV al completar; lo que conserva se borra a los `RETENCION_CV_DIAS` (30) días | Verificado (G-7) |
| Supresión a pedido | «Borrar datos del candidato» (ADMIN) borra nombre, correo, teléfono, ciudad y CV del Puente; queda el hash y el evento auditado. La supresión en el ATS la hace el ATS | Verificado (G-7) |
| Canal para ejercer derechos | `PRIVACIDAD_CORREO`; si no es un correo válido, el aviso dice «pendiente de configurar» | **PENDIENTE: correo de privacidad real** (en Render hoy es un marcador) |
| Identificación del responsable | El aviso dice que razón social, NIT y domicilio están pendientes | **PENDIENTE** (empresa) |
| Transmisión internacional | Render aloja los datos fuera de Colombia | **PENDIENTE** (contrato de transmisión, Circular Externa 003 de 2025 de la SIC, según el área legal) |
| Registro Nacional de Bases de Datos | — | **PENDIENTE** (si la empresa está obligada) |

### Aviso de privacidad: **borrador pendiente de validación legal**

El texto está en `/privacidad` (sin sesión) y en [apps/puente/src/app/privacidad/page.tsx](../../apps/puente/src/app/privacidad/page.tsx). Lleva el rótulo «Borrador pendiente de validación legal (Ley 1581 de 2012)». Contenido resumido:

1. **Responsable:** la empresa que publica la vacante (razón social, NIT y domicilio **pendientes de completar**); el Puente es la herramienta que recibe y entrega la postulación.
2. **Finalidad:** registrar la postulación, que el equipo de selección revise la hoja de vida y contacte al candidato, evitar repetidos y dejar registro.
3. **Datos:** los del formulario, la huella SHA-256 del CV y la prueba de la autorización.
4. **Derechos:** conocer, actualizar, rectificar, pedir prueba de la autorización, revocarla o pedir la supresión, y quejarse ante la SIC; canal = `PRIVACIDAD_CORREO`.
5. **Conservación:** el CV se borra del Puente al llegar al ATS (o a los 30 días); los datos de contacto y el registro del envío se conservan hasta que se pida su supresión.

Captura: [11_manual_de_uso.md](11_manual_de_uso.md), figura del aviso.

## 7.3 Riesgos de seguridad abiertos

| Riesgo | Detalle | Estado |
|---|---|---|
| **Límite por IP en Render** | El Puente toma la IP de `True-Client-IP`, `CF-Connecting-IP`, el primer `X-Forwarded-For` o `X-Real-IP`. Si el proxy de Render deja pasar un `X-Forwarded-For` puesto por el cliente, el límite por IP se puede esquivar (en local se comprobó que el encabezado se acepta). El tope de 100 por vacante y hora sigue frenando | **PENDIENTE: verificar en Render qué encabezado es confiable** (D-76) |
| Límites en memoria | Los cupos se cuentan en memoria del proceso: con más de una instancia no se comparten | Aceptado para el plan gratuito (una instancia); con varias, mover a PostgreSQL |
| Sin CAPTCHA | Se descartó para no enviar datos a un tercero (D-76) | Decisión interna |
| Cuentas demo con contraseña conocida | `Demo2026!` está en el README y también sirve en Render (panel del Puente como administrador). Solo hay datos ficticios | Aceptado para la demo; **cambiar o desactivar antes de cualquier uso con datos reales** |
| Avisos de dependencias | Avisos moderados de `minimatch` en herramientas de ESLint (solo desarrollo) | Conocido |
| Datos en Render | La base gratuita vence el 28/11/2026 | Fecha anotada |

## 7.4 Lo que NO se versiona (verificado el 11/11/2026)

*Figura 7.1 (pendiente de insertar): variables de entorno del Puente en Render, con los valores secretos ocultos ([GUIA_CAPTURAS.md](GUIA_CAPTURAS.md) g).*

`.env` y `.env.*` (salvo `.env.example`), perfiles del navegador del bot (`.bot-perfil*`), la ficha del reto (`docs/ficha/`), los insumos internos del equipo (`docs/insumos/`), `PROMPT_DOCUMENTACION.md`, `datos.json`, páginas originales de LinkedIn (`fixtures/linkedin/originales/`), capturas de trabajo (`capturas/`) y configuraciones locales de herramientas de IA. Comprobación con `git check-ignore` y `git ls-files` en [06_pruebas_y_resultados.md](06_pruebas_y_resultados.md) §6.6.

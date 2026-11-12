# Especificación v3 — Bot asistido de LinkedIn (entrada real) → Puente → Talentia

> Documento del equipo (01/11/2026). Fuente de verdad para Claude Code. Complementa `docs/v2/SOLUCION.md` y `docs/v2/ESPECIFICACION.md`.
> Etiquetas: **Verificado** (fuente y fecha) · **Decisión interna** · **Supuesto pendiente**.

## 0. Qué cambia y qué no

- **Nuevo:** la entrada de postulaciones viene del **LinkedIn real**. Las postulaciones se hacen en LinkedIn (postulación rápida) a una vacante publicada por una cuenta del equipo. Un **bot asistido** que corre en el computador del equipo, con la sesión abierta del reclutador, lee los postulantes de esa vacante, descarga los CV y los entrega al **Puente**.
- **No cambia:** el Puente sigue registrando en **Talentia** (ATS simulado tipo BUK) por su API. **Vínculo** se conserva como demostración de la integración oficial futura (Apply Connect).
- **No se usa ninguna API de LinkedIn.**

## 1. Riesgo aceptado y salvaguardas (no negociables)

LinkedIn prohíbe en sus términos el uso de herramientas automatizadas sobre su sitio. El equipo decidió construir el bot como **alternativa evaluada**, con riesgo conocido sobre la cuenta usada. Por eso:

1. **Modo asistido por defecto:** el bot corre en el computador del equipo, con ventana visible, cuando una persona lo inicia.
2. **Sin contraseñas guardadas:** el usuario inicia sesión a mano una vez en un perfil de navegador del bot (`.bot-perfil/`, excluido de git). El bot nunca escribe usuario ni contraseña.
3. **Sin evasión:** prohibido resolver captchas, usar plugins de sigilo o anti-detección, rotar IP, usar proxies o falsificar huellas del navegador. Si aparece una verificación, un captcha, una página de inicio de sesión o una advertencia, el bot **se detiene** y muestra «Se requiere intervención humana».
4. **Ritmo humano y límites:** pausa aleatoria de 3 a 8 s entre acciones; máximo 25 postulantes por ejecución; modo programado como mínimo cada 30 minutos y solo entre 7:00 y 19:00.
5. **Solo vacantes propias** de la cuenta con sesión iniciada y solo los datos que LinkedIn muestra al publicador de la vacante (tarjeta del postulante, datos de contacto compartidos en la postulación y CV adjunto). Nada de recorrer perfiles, buscar personas ni enviar mensajes.
6. **Datos mínimos:** el bot no guarda CV en disco más allá de lo necesario para enviarlos; borra los temporales al confirmar el envío. Sin datos personales en registros.
7. **Vacante de prueba honesta:** la vacante publicada dice en el título y la descripción que es una **vacante de prueba de un proyecto académico** y que no se debe postular. Solo postulan integrantes del equipo y personas que dieron su consentimiento, con CV ficticios.

## 2. Arquitectura

```
LinkedIn real (postulación rápida)
        │  el reclutador (cuenta del equipo) tiene sesión abierta
        ▼
apps/bot-linkedin  ── Playwright, en el PC del equipo ──►  Puente (Render)
   lee postulantes + descarga CV                             POST /api/entradas/linkedin-bot
                                                               │ (token, multipart: datos + PDF)
                                                               ▼
                                                     Recepción → Trabajo → Talentia (API v1)
                                                               ▼
                                                  Postulantes del proceso correspondiente
```

- `apps/bot-linkedin`: nueva app de Node + TypeScript + Playwright (sin Next.js). No importa código de las otras apps.
- El Puente agrega una **segunda entrada** («LinkedIn · bot asistido»), con el mismo procesador, deduplicación, trazabilidad y panel.

## 3. Bot (`apps/bot-linkedin`)

### 3.1 Comandos
| Comando | Qué hace |
|---|---|
| `npm run bot:login -w apps/bot-linkedin` | Abre Chromium con el perfil `.bot-perfil/` para que la persona inicie sesión a mano; al cerrar, la sesión queda guardada localmente |
| `npm run bot -w apps/bot-linkedin` | Modo asistido: pide al Puente la lista de vacantes de LinkedIn vinculadas, recorre cada una y envía los postulantes nuevos |
| `… -- --vacante <idLinkedIn>` | Solo esa vacante |
| `… -- --seco` | No envía nada al Puente; muestra lo que enviaría (sin datos personales completos) |
| `… -- --programado` | Repite cada `BOT_INTERVALO_MIN` (≥ 30) dentro del horario permitido, hasta Ctrl+C |

### 3.2 Configuración (`apps/bot-linkedin/.env`, con `.env.example` sin secretos)
`PUENTE_URL`, `PUENTE_BOT_TOKEN`, `BOT_MAX_POR_EJECUCION=25`, `BOT_PAUSA_MIN_MS=3000`, `BOT_PAUSA_MAX_MS=8000`, `BOT_INTERVALO_MIN=30`, `BOT_HORARIO=07-19`, `BOT_HEADLESS=false`.

### 3.3 Diseño interno
- `navegacion/`: abrir la vacante, la lista de postulantes, cada postulante y el CV. **Todos los selectores en un solo archivo `selectores.ts`**, con comentarios de qué elemento es cada uno, para poder ajustarlos cuando LinkedIn cambie.
- `extraccion/`: funciones puras que reciben HTML y devuelven datos (nombre, titular, ciudad, correo y teléfono si el postulante los compartió, fecha, identificador de la postulación y enlace del CV). Se prueban con los HTML guardados de `fixtures/linkedin/`.
- `guardias/`: detección de verificación, captcha, sesión cerrada o advertencia → detener.
- `envio/`: multipart al Puente con reintentos (el Puente gratuito tarda hasta ~90 s en despertar).
- Identificador de deduplicación: `linkedin:<idVacante>:<idPostulacion>`; si la página no expone un id de postulación, usar el id del perfil del postulante (**Supuesto pendiente**: se confirma en el reconocimiento).

### 3.4 Reconocimiento (antes de programar la navegación)
El equipo guarda con el navegador (Ctrl+S, «Página web completa») estas páginas de su vacante de prueba y las copia a `fixtures/linkedin/` (carpeta privada del repositorio privado; solo datos de integrantes que consintieron):
1. Lista de empleos publicados («Mis empleos»).
2. Lista de postulantes de la vacante.
3. Detalle de un postulante (con el CV visible).
Claude Code deriva los selectores y las funciones de extracción de esos archivos y escribe pruebas con ellos. **No explora LinkedIn real por su cuenta.**

## 4. Puente: nueva entrada

- **Bot**: en `Conexiones` → sección «Bot de LinkedIn»: generar token (visible una vez, guardado con hash SHA-256 y prefijo), revocar, ver último uso.
- **Correspondencias**: tipo `linkedin` → id de vacante de LinkedIn ↔ proceso de Talentia. `GET /api/entradas/linkedin-bot/vacantes` (con token) devuelve las vacantes vinculadas al bot.
- **Entrada**: `POST /api/entradas/linkedin-bot` (Bearer token), multipart: `datos` (JSON validado con Zod) + `cv` (PDF ≤ 5 MB, `%PDF`). Respuestas: 200 RECIBIDO · 200 DUPLICADO · 401 · 400 validación · 422 vacante sin correspondencia · 413 · 415.
- Guarda una `Recepcion` con `fuente = LINKEDIN_BOT`, `claveDedup` única, datos normalizados y el CV (con SHA-256). El procesador reutiliza los pasos desde `postulante_listo` (no hay descarga desde Vínculo). No se envía aviso de vuelta a LinkedIn.
- En Talentia la postulación lleva `fuente = "LinkedIn (bot asistido)"`.
- Panel: filtro por fuente; métricas por fuente (recibidas, completadas, rechazadas, duplicados, mediana y p95).
- Seguridad: límites de tamaño, sin datos personales en registros, token comparado en tiempo constante.

## 5. Criterios de aceptación (con prueba automática salvo B-8)

- B-1. Las funciones de extracción obtienen los campos esperados de cada HTML de `fixtures/linkedin/` (pruebas unitarias).
- B-2. Las guardias detienen el bot ante páginas de verificación, captcha o inicio de sesión (pruebas con HTML de ejemplo creados por el equipo de pruebas, sin LinkedIn real).
- B-3. E2E local: un servidor de pruebas sirve los HTML de `fixtures/linkedin/` como si fuera LinkedIn; el bot recorre la vacante, envía al Puente y el postulante aparece en Postulantes del proceso vinculado en Talentia con SHA-256 igual al del PDF.
- B-4. Reenvío: el segundo envío del mismo postulante responde DUPLICADO y no crea nada.
- B-5. Token inválido o revocado → 401; vacante sin correspondencia → 422; PDF inválido → 415.
- B-6. `--seco` no envía nada.
- B-7. Límite por ejecución y pausas respetados (prueba con reloj simulado).
- B-8. **Prueba real asistida (manual):** con la vacante de prueba y al menos 3 postulaciones de integrantes, `npm run bot` deja a los 3 en Postulantes de Talentia en Render. Se registra fecha, número de postulaciones, tiempo y capturas.
- B-9. Todas las pruebas anteriores de la v2 siguen pasando.

## 6. Documentación a actualizar
`README.md` (sección Bot), `docs/arquitectura.md`, `docs/contratos.md` (entrada del bot: contrato propio), `docs/decisiones.md` (desde D-52, incluida la decisión del bot y su riesgo), `docs/seguridad.md` (riesgo con los términos de LinkedIn, salvaguardas, datos personales), `docs/manuales/bot-linkedin.md`, `docs/guion-demo.md`, `docs/resultados-pruebas.md`, `docs/estado.md`, `docs/uso-ia.md`.

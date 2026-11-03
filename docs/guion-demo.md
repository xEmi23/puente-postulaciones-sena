# Guion de la demostración (6 a 7 minutos)

> Creado por Claude Code (2026-10-25). Pensado para el control del 29/10. Todo con datos ficticios.

## Antes de empezar (5 minutos antes)

1. `npm run pg:start` (si la base está apagada) y `npm run demo:reset`.
2. Terminal 1: `npm run build && npm start` (más estable que `dev`). Terminal 2: `npm run worker`.
3. En el navegador, tres pestañas: `localhost:3100/origen`, `localhost:3100/puente` y `localhost:3100/ats/procesos/9001`. Inicia sesión una vez con `DEMO_ADMIN_USER` y `DEMO_ADMIN_PASSWORD` de `.env`.
4. Ten a mano `fixtures/cv/cv-camila-ejemplo.pdf` y su SHA-256: `certutil -hashfile fixtures\cv\cv-camila-ejemplo.pdf SHA256`.

## Guion

| Tiempo | Qué se muestra | Qué se dice |
|---|---|---|
| 0:00–0:45 | Diapositiva o pantalla de inicio (`/`) | «Hoy el reclutador descarga cada CV de LinkedIn y lo sube al ATS: entre 2 y 4 días hábiles de retraso. La empresa no puede darnos la API de BUK y LinkedIn solo abre Apply Connect a socios certificados. Por eso **simulamos los dos extremos con sus contratos documentados** y construimos el puente como si fuera real.» |
| 0:45–1:30 | `/origen/admin` → «Publicar vacante»; `/ats` → «Nuevo proceso»; `/puente/correspondencias` → vincular | **Criterio 1.** «Preparamos la vacante en el origen y el proceso en el ATS, y los vinculamos. El puente no adivina procesos.» (Si el tiempo es corto, usar la vacante sembrada RT-2026-101 → 9001.) |
| 1:30–2:30 | `/origen` → vacante → formulario con datos ficticios y el PDF | **Criterio 2.** «Postulación sin cuenta. La validación es del servidor: probemos un archivo que no es PDF…» (mostrar el error) «…y ahora el PDF correcto.» |
| 2:30–3:15 | La confirmación cambia sola a «Entregada a la empresa»; pestaña del panel: operación **Completado** y sus 4 pasos | **Criterio 3.** «Nadie copió nada: el portal firmó el evento con HMAC, el puente verificó la firma, descargó el CV y llamó al ATS paso a paso. Aquí se ve cada paso con su hora.» |
| 3:15–4:00 | Pestaña del ATS: encabezado con prioridad, inicio, vigencia y estado «Iniciado»; aviso «1 postulante nuevo fue agregado al proceso», tarjeta en **Postulantes**, «Sin calificar», fuente «Portal simulado (tipo LinkedIn)» | **Criterio 4.** «Llega al proceso correcto, en la primera columna, como en el ATS de la empresa.» |
| 4:00–4:40 | Detalle del candidato → «Descargar CV» → comparar el SHA-256 en pantalla con el de `certutil` | **Criterio 5.** «El archivo es idéntico byte a byte: el ATS recalcula el hash y lo compara.» |
| 4:40–5:20 | `/origen/admin` → «Reenviar evento» → `HTTP 200 · DUPLICADO`; el ATS sigue con una tarjeta; el panel suma «Duplicados evitados» | **Criterio 6.** «LinkedIn puede reenviar. No se duplica nada: lo garantiza una restricción única en la base, no un "consultar antes de insertar".» |
| 5:20–6:00 | `/origen/admin/consola`: «Firma inválida» → 401 `SIGNATURE_MISMATCH`; «Vacante sin correspondencia» → 422 `JOB_POSTING_CLOSED`; `/puente/rechazos` | **Criterio 7.** «Entradas inválidas: se rechazan con el código que documenta LinkedIn y cero escrituras en el ATS.» |
| 6:00–6:45 | Detener el worker (Ctrl+C) → postular → «Enviando…» → detener y reiniciar la app → la confirmación sigue ahí → iniciar el worker → «Entregada» | **Criterio 8.** «Todo el estado está en PostgreSQL: si se cae la app o el worker, al volver retoma lo pendiente.» |
| 6:45–7:00 | Panel: métricas (mediana y p95 con n) | «Métricas medidas, no estimadas. Lo que falta para un uso real está en la guía de adopción.» |

## Si algo falla en vivo

- La confirmación se queda en «Enviando…»: el worker no corre. Inícialo y se entrega sola (eso también demuestra el criterio 8).
- No se puede entrar al panel: revisar `DEMO_ADMIN_USER` y `DEMO_ADMIN_PASSWORD` en `.env` y que la URL sea `localhost`.
- Plan B: `npm run test:e2e` ejecuta los 8 criterios automáticamente (`e2e/criterios-29oct.spec.ts`) y deja un reporte en `playwright-report/`.

## Preguntas probables

- **¿Por qué no BUK de verdad?** No hay API documentada disponible para el equipo y la empresa no la facilitará (D-01). El destino es reemplazable: el puente habla con el ATS por un cliente HTTP aislado (`ats-cliente.ts`).
- **¿Esto funcionaría con LinkedIn?** El origen respeta el contrato publicado de Apply Connect (payload, firma, challenge, códigos de error), pero usarlo requiere ser socio certificado (docs/contratos.md F3). La alternativa sin desarrollo es la integración nativa de BUK, que publica la vacante y redirige al formulario de BUK (F5).
- **¿Qué pasa con datos personales?** Datos ficticios; el puente guarda lo mínimo, borra la copia del CV al terminar y no guarda la autoidentificación voluntaria (D-09).

---

## v2 · Guion de 7 minutos (tres sistemas)

> Actualizado por Claude Code (2026-10-29). Reemplaza al guion anterior para la v2. Cuentas: ver README («Cuentas de demostración»); contraseña `Demo2026!`.

### Antes de empezar

- **Local (10 minutos antes):** `npm run demo:reset`, `npm run build && npm start` (más estable que `dev`) y en otra terminal `npm run demo:conectar`. Abre cuatro pestañas (o ventanas de incógnito, para tener sesiones a la vista): Vínculo `:3001` como `valentina.rios@demo.test`; Vínculo `:3001/developers` como la reclutadora; Talentia `:3002/seleccion/procesos` como `admin@andina.demo.test`; Puente `:3003/operaciones` como `admin@puente.demo.test`.
- **Render (15 minutos antes):** despierta los tres servicios abriendo `https://<servicio>.onrender.com/api/salud` de cada uno hasta que respondan (el plan gratuito duerme tras 15 minutos sin uso; el primero puede tardar cerca de un minuto). Luego abre el Puente → «Conexiones» y pulsa «Probar conexión» en Vínculo y en Talentia (ver docs/despliegue.md).
- Ten a mano `fixtures/cv/cv-camila-ejemplo.pdf` y su SHA-256 (`certutil -hashfile fixtures\cv\cv-camila-ejemplo.pdf SHA256`).

### Guion

| Tiempo | Qué se muestra | Qué se dice |
|---|---|---|
| 0:00–0:45 | Vínculo (empleos) y Talentia (tablero 9001) | «Hoy el reclutador descarga cada CV de la red profesional y lo sube al ATS. Son dos sistemas **simulados**, cada uno con su login, su base y su API, modelados sobre lo que documentan LinkedIn y BUK. El producto es el tercero: el puente.» |
| 0:45–1:45 | Talentia → API Keys (llave con Lectura y Modificación); Vínculo → Desarrolladores (aplicación, Client ID); Puente → **Conexiones**: las tres marcas, «Probar conexión» | **Criterios 2, 4 y 5.** «El puente no tiene nada quemado: estas credenciales se pegan aquí, se guardan cifradas y se prueban contra los dos sistemas. El webhook pasó el desafío firmado.» |
| 1:45–2:30 | Puente → **Procesos** → «Publicar en Vínculo» el 9003 → «Ver en Vínculo» | **Criterio 6.** «Desde el ATS se publica la vacante con Solicitud sencilla; su id externo es el id del proceso, así que nadie tiene que vincular nada a mano.» |
| 2:30–3:30 | Vínculo como Valentina → la vacante → Solicitud sencilla (2 pasos) con el PDF | **Criterio 7.** «Dos pasos, datos del perfil y el PDF.» (Opcional: mostrar el rechazo de un archivo que no es PDF.) |
| 3:30–4:15 | Puente → Operaciones: **Completado** con los 4 pasos y su hora; Talentia → proceso 9003: la tarjeta en **Postulantes**, «Sin calificar», fuente «Portal simulado (tipo LinkedIn)» | «Recibido no es transferido: solo cuenta cuando Talentia confirma la postulación. Llegó en segundos al proceso correcto.» |
| 4:15–4:45 | Talentia → ficha → descargar el CV y comparar su SHA-256 | «El archivo es idéntico byte a byte.» |
| 4:45–5:15 | Vínculo → Mis postulaciones: **CV descargado** | **Criterio 8.** «El puente le avisa a la red profesional y el candidato ve que su hoja de vida llegó.» |
| 5:15–6:00 | Vínculo → Desarrolladores → la aplicación → «Reenviar evento» → `DUPLICADO`; consola: firma inválida → 401 | **Criterios 9 y 13.** «Reenvíos sin duplicados; entradas inválidas rechazadas con el código documentado y cero escrituras.» |
| 6:00–6:45 | Talentia → revocar la llave → postular otra vez → Puente: «Fallido (reintentable) · detenido» con «La API Key de Talentia fue revocada…» → llave nueva en Conexiones → «Reintentar» → Completado | **Criterio 12.** «Con una llave mala no insiste: se detiene, explica qué hacer y retoma sin duplicar.» |
| 6:45–7:00 | Puente → Métricas | «Métricas medidas: recibidas, completadas, duplicados evitados y tiempo de recepción a completado.» |

### Plan B

- **Un servicio de Render no despierta:** seguir con la demo local (mismo guion).
- **La conexión falla en vivo:** `npm run demo:conectar` la rehace en segundos (local).
- **No hay tiempo para el paso de la llave revocada:** mostrar el video o el reporte de `e2e/tres-sistemas.spec.ts` (`npm run test:e2e` deja `playwright-report/`), que recorre exactamente este guion con los tres sistemas reales.

### Preguntas probables (v2)

- **¿Esto se conecta a LinkedIn o a BUK?** No. Vínculo y Talentia son simulados; reproducen lo verificado de cada uno (firma, desafío, cuerpo de Apply Connect; API Key con permisos de Selección de BUK) y lo demás es contrato del simulador, marcado así en docs/contratos.md. Cambiar de sistema real sería cambiar las conexiones y, donde el contrato real difiera, los dos clientes del puente (`vinculo-cliente.ts`, `ats-cliente.ts`).
- **¿Qué pasa si Talentia está caído?** El puente reintenta solo (hasta 10 veces, unos 13 minutos) y retoma desde el último paso. Si la respuesta se pierde a mitad, ofrece «Reconciliar con Talentia».

---

## V4 · Guion de unos 5 minutos (especificación §15.3)

> Actualizado por Claude Code (2026-11-02). Sin bot: la Puerta 0 está pendiente; si el equipo construye el bot (F4), se agrega el paso 4.

**Antes (local):** `npm run demo:reset`, `npm run build && npm start`, `npm run demo:conectar`. Ten 3 CV ficticios en una carpeta (por ejemplo `fixtures/cv/cv-camila-ejemplo.pdf`, `cv-andres-prueba.pdf`, `cv-sofia-demo.pdf`). Pestañas: Puente → Importar (operador), Talentia → proceso elegido (reclutador), Vínculo (candidata). **En Render:** despertar los tres servicios 15 minutos antes (docs/despliegue.md).

| Tiempo | Qué se muestra | Qué se dice |
|---|---|---|
| 0:00–0:30 | Diapositiva del problema | «Por vacante, el reclutador descarga y vuelve a digitar cada CV. No hay API de LinkedIn para nosotros ni llave de BUK.» |
| 0:30–1:00 | Diagrama de capas (README) | «El producto es el Puente: recibe de cualquier fuente con un contrato común y escribe en el ATS por una interfaz. Talentia simula BUK; BUK real está preparado pero deshabilitado.» |
| 1:00–2:00 | **Importador:** Importar → proceso → 3 PDF → la tabla con correo y teléfono sugeridos → corregir uno → Confirmar → «3 enviada(s) al ATS» → Talentia → Postulantes | «Sin IA: el Puente lee el PDF y una persona confirma. Cero digitación y cumple los términos de LinkedIn.» Reimportar uno: «Duplicada». |
| 2:00–2:45 | **Apply Connect simulado:** Vínculo → Solicitud sencilla → llega sola a Talentia → «CV descargado» | «Así sería la integración oficial: mismas piezas, otra fuente.» |
| 2:45–3:30 | **Confiabilidad:** Operaciones con filtro por fuente; una postulación sin correo en «Requiere revisión» → completar → aprobar; un posible duplicado en revisión; Métricas por fuente | «Nada incompleto llega al ATS y nada se fusiona solo.» |
| 3:30–4:15 | **Entrada genérica:** Fuentes → token (se ve una vez) → `curl.exe` con un PDF → 202 RECIBIDA | «Un bot o cualquier otra fuente se conecta así, sin tocar el núcleo.» |
| 4:15–5:00 | **Honestidad:** qué es simulado (Talentia, Vínculo), qué es experimental (el bot, no construido sin la Puerta 0) y qué falta para BUK real (`/apidocs` y API Key de la empresa) | Mensaje central de la §15.3. |

**Plan B:** Render no despierta → demo local. Algo falla en vivo → video del recorrido (grabarlo el 8/11 con la fecha visible). La Puerta 0 falla → el bot se presenta como alternativa evaluada y descartada, con su motivo.

## V4 · Bloque del bot asistido sobre Vínculo (unos 2 minutos)

> Actualizado por Claude Code (2026-11-02, F4-V). El bot corre **contra Vínculo (simulado)**; el perfil de LinkedIn se niega a correr hasta la Puerta 0. Vínculo arranca **sin API** (D-68): como para la empresa, la única forma de llevar candidatos al ATS es el bot o el importador.

**Antes (local, una vez):** `npm run pg:start`, `npm run dev` (dejarlo abierto), y en otra ventana `npm run demo:reset`, `npm run demo:bot -- --reiniciar` y `npm run bot:login -w apps/bot-linkedin` (siempre después de `demo:reset`: vuelve a crear las cuentas) (iniciar sesión a mano como `reclutadora@andina.demo.test` / `Demo2026!` y cerrar la ventana). Pestañas: Vínculo → Panel de reclutador → «Analista de Integraciones (demo del bot)»; Talentia (reclutador) → proceso 9005.

| Tiempo | Qué se muestra | Qué se dice |
|---|---|---|
| 0:00–0:20 | Vínculo: la vacante con 3 postulantes; «Ver ficha» de una; el menú sin «Desarrolladores» | «Así lo ve hoy el reclutador: sin API, a mano, uno por uno.» |
| 0:20–1:10 | `npm run bot -w apps/bot-linkedin` con la ventana visible: el bot abre la vacante y cada ficha, con pausas; la consola dice «3 recibida(s)» | «Lo ejecuta una persona, con su sesión; no guarda contraseñas, se detiene ante cualquier verificación y tiene un tope de 25.» |
| 1:10–1:40 | Talentia → proceso 9005 → Postulantes: las 3 tarjetas, cada una con su CV | «Mismo archivo, byte a byte; entra por la misma puerta que el importador.» |
| 1:40–2:00 | Segunda corrida: «3 duplicada(s)»; Talentia sigue con 3 | «Idempotente: correrlo dos veces no duplica.» |

**Si sale «Se requiere intervención humana»:** la sesión venció → `npm run bot:login -w apps/bot-linkedin` y repetir. **Si piden ver la vía oficial:** `npm run vinculo:api -- on`, reiniciar `npm run dev` y `npm run demo:conectar`; se ve el portal de desarrolladores y Apply Connect simulado.

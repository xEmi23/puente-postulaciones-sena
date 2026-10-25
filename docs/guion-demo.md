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
| 3:15–4:00 | Pestaña del ATS: aviso «1 postulante nuevo fue agregado al proceso», tarjeta en **Postulantes**, «Sin calificar», fuente | **Criterio 4.** «Llega al proceso correcto, en la primera columna, como en el ATS de la empresa.» |
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

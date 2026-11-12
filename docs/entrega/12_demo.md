# 12. Demostración (unos 6 minutos)

> Guion de la sustentación del 13/11/2026 sobre el flujo final. Se puede hacer en Render o en local (plan B). Guiones anteriores (V2, bot, importador): [docs/guion-demo.md](../guion-demo.md).

## Antes de empezar (15 minutos antes)

**Render:**

1. Abrir, uno tras otro, hasta que respondan `"estado":"ok"`:
   - https://puente-postulaciones.onrender.com/api/salud
   - https://talentia-simulado.onrender.com/api/salud
   (tardan 1–2 minutos si estaban dormidos).
2. Puente → `admin@puente.demo.test` / `Demo2026!` → **Conexiones** → «Probar conexión» con el Simulador BUK (verde).
3. Pestañas abiertas: el formulario público de la vacante de prueba (https://puente-postulaciones.onrender.com/postular/cnibi7tmi252), Puente → **Operaciones**, Simulador BUK → proceso 9006 (`reclutador@andina.demo.test`).
4. Tener a mano un CV ficticio (`fixtures/cv/cv-sofia-demo.pdf`) y un correo nuevo `@demo.test` para la demo (cada correo sirve una vez por vacante).

**Local (plan B):** `npm run pg:start` → `npm run dev` → (otra terminal) `npm run demo:bot -- --reiniciar` → Puente → **Formulario público** → «Crear enlace» en un proceso → «Copiar».

## Guion

| Min | Qué se muestra | Qué se dice |
|---|---|---|
| 0:00 | Diapositiva o README: el problema | «Hoy el reclutador descarga cada CV de LinkedIn y lo vuelve a digitar en el ATS. No hay API de LinkedIn para la empresa ni llave de BUK para nosotros.» |
| 0:45 | Puente → **Formulario público**: el enlace de la vacante con «Copiar» | «La oferta en LinkedIn lleva este enlace externo. Es una función estándar de la oferta: no automatizamos LinkedIn.» |
| 1:15 | El formulario público (sin sesión), el aviso de privacidad | «El candidato llena siete campos y autoriza el tratamiento. El aviso es un borrador pendiente de validación legal.» |
| 2:00 | Enviar con el CV ficticio → confirmación con referencia | «Recibimos la postulación; el candidato ve su referencia.» |
| 2:30 | Puente → **Operaciones**: la recepción pasa a «Completado» con sus cuatro pasos | «Un 202 no es una transferencia: solo cuenta cuando el ATS crea la postulación.» |
| 3:00 | Simulador BUK → proceso → **Postulantes**: la tarjeta y su CV | «Llegó al proceso correcto, en Postulantes, con el mismo SHA-256 del archivo enviado.» |
| 3:30 | Enviar otra vez el mismo correo → misma confirmación; en el ATS sigue una sola | «Duplicados: la misma persona en la misma vacante es la misma postulación.» |
| 4:00 | Postman: «01 · Válida con CV» → 202 y «03 · Falta nombres» → 400 | «El alcance pedido: postulaciones simuladas en JSON que el middleware registra por API. Cualquier fuente con token entra por aquí.» |
| 4:45 | [06_pruebas_y_resultados.md](06_pruebas_y_resultados.md): tabla de criterios | «Medimos los tres criterios de éxito con más de 40 envíos ficticios: registro sin error, tiempo y campos mapeados.» |
| 5:15 | [04_solucion_y_arquitectura.md](04_solucion_y_arquitectura.md): qué es real y qué es simulado | «El Puente es real. Para BUK real falta su `/apidocs` y la llave: el adaptador está listo para escribirse sin tocar el núcleo.» |
| 5:45 | Cierre | «El bot lo construimos y lo descartamos por los términos de LinkedIn: está documentado como alternativa evaluada.» |

## Si algo falla en vivo

| Falla | Qué hacer |
|---|---|
| Render no despierta | Plan B local, mismo guion |
| El envío dice «Demasiados envíos» | Es el límite de 5 por IP cada 10 minutos (protección). Usar otra red o la demo local |
| La recepción queda en «Requiere revisión» | Mostrarlo como función: abrirla, completar y aprobar |
| La recepción queda en «Reintentando» | El ATS estaba dormido: esperar o «Reintentar» en el panel |

## Preguntas probables

- **¿Esto ya funciona con BUK?** No. Funciona con el Simulador BUK. Para BUK real hace falta la llave y su documentación; el resto no cambia.
- **¿Por qué no Solicitud sencilla de LinkedIn?** Esas postulaciones quedan dentro de LinkedIn y su API es solo para socios aprobados.
- **¿Y la Ley 1581?** El prototipo guarda la prueba del consentimiento, borra el CV al entregarlo y permite borrar a pedido. El aviso es un borrador: lo valida el área legal de la empresa.
- **¿Qué hizo la IA?** Ver [08_uso_de_ia.md](08_uso_de_ia.md): código, pruebas y documentación con Claude Code; las decisiones las tomó el equipo.
- **¿Cuánto tiempo ahorra?** El registro en el ATS tarda segundos (medido). El ahorro en horas depende de la línea base de la empresa, que falta.

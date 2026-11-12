# 14. Preguntas frecuentes de sustentación (respuestas honestas)

> Respuestas cortas para la sustentación del 13/11/2026. Si una respuesta dice PENDIENTE, no se debe improvisar otra cosa.

**¿Esto ya funciona con BUK?**
No. Funciona con el Simulador BUK, un ATS propio que se maneja por API. Para BUK real hace falta la llave de su API y su documentación (`/apidocs`); con eso se escribe el adaptador de salida sin tocar el resto (`ConectorATS`).

**¿Por qué no usaron la API de BUK?**
Según la ficha del reto, numeral 2.8, la integración con BUK es solo por su API REST, con acceso controlado y guiado por un gestor acompañante. El equipo no tiene una llave, así que el destino de la demo es el Simulador BUK. No afirmamos que la empresa se haya negado.

**¿Por qué no usaron la API de LinkedIn?**
Sus API de reclutamiento son solo para socios aprobados (verificado en Microsoft Learn). Además, según la ficha del reto, numeral 2.8, no se conectará la API directa de LinkedIn por limitaciones normativas y de acceso a credenciales, y las postulaciones se simulan con *payloads* JSON.

**Entonces, ¿qué hace exactamente lo que se entrega?**
Recibe postulaciones simuladas (por JSON con Postman, por un formulario o por PDF importados), las valida y las registra solas en «Postulantes» del proceso correcto del ATS simulado, sin duplicados y con el CV íntegro.

**¿Por qué un formulario y no «Solicitud sencilla» de LinkedIn?**
Lo que entra por «Solicitud sencilla» se queda dentro de LinkedIn y solo sale por su API o descargando a mano. Con el enlace externo, la postulación empieza en la oferta de LinkedIn y los datos llegan directamente al Puente.

**¿Ya lo probaron con una oferta real de LinkedIn?**
**PENDIENTE.** La cuenta de LinkedIn debe esperar una verificación (según el equipo, hasta 30 días). Las capturas del borrador de la oferta están en la [guía de capturas](GUIA_CAPTURAS.md).

**¿Cuánto tiempo ahorra?**
El registro en el ATS tarda una mediana de 1,16 s por candidato (medido en local, sin intervención). El ahorro en horas del reclutador no se puede calcular sin la línea base de la empresa, que no está (**PENDIENTE**).

**¿Qué pasa si el ATS se cae?**
El Puente reintenta solo hasta 5 veces con espera creciente, respeta los 429 y, si se perdió una respuesta, consulta antes de volver a escribir. En la medición, 10 envíos simultáneos recibieron un 429 y los 10 se completaron sin duplicar.

**¿Y si alguien envía basura o un archivo falso?**
Se rechaza: límites por IP y por vacante, campo trampa, tiempo mínimo de llenado, tamaño máximo de 5 MB y PDF validado por contenido. En la medición, 12 de 12 fallos provocados se rechazaron sin llegar al ATS.

**¿Cumple la Ley 1581?**
No lo afirmamos. El prototipo pide autorización, guarda la prueba (fecha, versión del aviso, origen cifrado), borra el CV del Puente al entregarlo y permite borrar a pedido. El aviso es un **borrador**: lo debe validar el área legal de la empresa.

**¿Qué hizo la IA y qué hizo el equipo?**
La IA hizo la mayor parte: Claude Code programó, probó y documentó; Claude (chat) apoyó el diseño, la auditoría y los prompts. El equipo definió el problema, eligió entre alternativas, dirigió cada fase, probó el sistema y tomó las decisiones (por ejemplo, descartar el bot y elegir el formulario). Detalle en [08](08_uso_de_ia.md). No afirmamos que el código se haya revisado línea por línea.

**¿Por qué descartaron el bot si ya estaba hecho?**
Porque el Acuerdo de Usuario de LinkedIn prohíbe bots (cláusula 8.2), exigía una sesión humana en cada corrida y arriesgaba la cuenta. Solo se probó contra el simulador.

**¿Cuánto cuesta?**
Hasta hoy, US$0 en infraestructura (Render gratuito). Mantenerlo en Render costaría unos US$27 al mes (estimado de la especificación). Ver [10](10_trabajo_futuro.md) §10.2.

**¿Qué falta para usarlo de verdad?**
La llave y la documentación de BUK, la validación legal del aviso, el correo de privacidad, verificar la cuenta de LinkedIn y un piloto con una vacante real. Ver [10](10_trabajo_futuro.md).

**¿Hablaron con la empresa?**
No hubo correos ni mensajes. El equipo asistió a la socialización presencial del 15/10 y al control de avance del 29/10; lo que se dice de esas sesiones es lo entendido por el equipo, sin evidencia escrita.

# 13. Glosario

| Término | Significado en este proyecto |
|---|---|
| **ATS** | *Applicant Tracking System*: sistema donde la empresa gestiona sus procesos de selección. En el reto, BUK |
| **BUK** | ATS que usa la empresa retadora (según la ficha del reto). **No** está conectado: en la demo se usa el Simulador BUK |
| **Simulador BUK** (interno: `talentia`) | ATS simulado, propio del proyecto, con procesos por etapas y una API v1 propia. No es BUK |
| **Simulador LinkedIn** (interno: `vinculo`) | Red profesional simulada con «Solicitud sencilla» y una API modelada sobre Apply Connect (apagada por defecto). No es LinkedIn |
| **Puente** | El producto: *middleware* que recibe postulaciones de cualquier fuente y las registra en el ATS por API |
| ***Middleware*** | Software intermedio que conecta dos sistemas sin modificarlos |
| **Formulario público** | Página del Puente (`/postular/<código>`) que abre el candidato desde el enlace externo de la oferta |
| **Enlace externo** | Opción de una oferta de LinkedIn para recibir solicitudes en un sitio web externo en lugar de dentro de LinkedIn |
| **Entrada genérica** | `POST /api/entradas/v1/postulaciones`: cualquier fuente con token envía el JSON de la postulación y el PDF |
| **Importador manual** | Pantalla del Puente para subir PDF ya descargados; sugiere datos sin IA y una persona confirma |
| **Fuente** | Origen de una postulación (formulario público, importador, una fuente JSON con token, Apply Connect, bot) |
| **Token de fuente** | Credencial de una fuente para la entrada genérica; se ve una sola vez y se guarda solo su SHA-256 |
| **Correspondencia** | Vínculo entre la vacante de una fuente y un proceso del ATS |
| **PostulacionCanonica v1** | Formato único que entiende el núcleo del Puente, sea cual sea la fuente |
| **`ConectorATS`** | Interfaz de salida del Puente; hoy la implementa el Simulador BUK y BUK está deshabilitado |
| **Recepción** | Registro de una postulación dentro del Puente, con sus pasos y estado |
| **Pasos** | `cv_descargado → postulante_listo → documento_subido → postulacion_creada`; solo el último cuenta como registrada |
| **Requiere revisión** | Estado de una recepción que espera a una persona (sin correo, sin CV, datos sin confirmar o posible duplicado) |
| **Duplicado** | Misma `(fuente, idExterno)`, o el mismo correo en la misma vacante del formulario: no se crea nada nuevo |
| **Idempotencia / `Idempotency-Key`** | Garantía de que repetir una escritura al ATS no crea un segundo registro |
| **Reconciliación** | Consultar al ATS antes de reintentar cuando se perdió una respuesta |
| **SHA-256** | Huella del archivo; demuestra que el CV que llegó al ATS es idéntico al enviado |
| **429** | Respuesta «demasiadas peticiones»; el Puente espera lo que indica `Retry-After` y reintenta |
| **Apply Connect** | Integración oficial de LinkedIn para ATS socios; solo para socios aprobados (verificado en Microsoft Learn) |
| **Puerta 0** | Verificación manual en LinkedIn que condicionaba el bot; no se completó |
| **Bot asistido** | Programa que habría recorrido la página del reclutador con su sesión; descartado (D-75) |
| **Render** | Servicio de alojamiento en la nube (plan gratuito) donde está desplegada la demo |
| **Vitest / Playwright** | Herramientas de pruebas automáticas: unitarias y de integración / de punta a punta en el navegador |
| **Puerta de calidad** | lint + typecheck + Vitest + build + Playwright; se corre al cerrar cada fase |
| **Ley 1581 de 2012** | Ley colombiana de protección de datos personales |
| **Claude Code / Claude (chat) / Claude Pro / ChatGPT** | Herramientas de IA generativa usadas en el proyecto; con Claude Pro se hizo la auditoría externa que originó la V4 (ver [08](08_uso_de_ia.md)) |
| **Oferta publicada** | La vacante publicada por el equipo en LinkedIn con el enlace externo al formulario del Puente; puede traer datos reales (ver [07](07_seguridad_y_privacidad.md) §7.0) |
| **Design Thinking / Lean Startup** | Metodologías que pide la ruta del reto (ver [03](03_metodologia.md)) |

# Puente de postulaciones · Resumen para el docente

**Reto #1 SENA · Innovación Abierta 2026-2 (CUEE 2.0, SENA Regional Antioquia) · Entrega del 13/11/2026 · Publicación anonimizada («la empresa retadora»).**

**Problema (según la ficha del reto).** El equipo de selección descarga uno por uno los CV de cada vacante de LinkedIn y los vuelve a digitar en su ATS (BUK); la ficha estima un retraso de 2 a 4 días hábiles por candidato. Según la ficha del reto (numeral 2.8), no se conecta la API directa de LinkedIn y el acceso a la API de BUK es controlado y guiado por un gestor acompañante; el equipo no tiene una llave de BUK.

**Solución.** Un *middleware* web (Next.js + PostgreSQL), el **Puente**, que recibe postulaciones y las registra solas en «Postulantes» del proceso correcto del ATS por su API: la oferta de LinkedIn enlaza a un formulario del Puente; también acepta postulaciones simuladas en JSON (Postman) y PDF importados. Valida, evita duplicados, verifica el CV (SHA-256), reintenta y deja trazabilidad. El ATS de la demo es un **simulador**; BUK real queda preparado pero deshabilitado.

**Resultados medidos (11/11/2026, local, datos ficticios).** 45/45 postulaciones registradas sin error (100 %); mediana de 1,16 s por candidato; 450/450 campos mapeados correctamente; 12/12 fallos provocados rechazados. 333 pruebas automáticas sin fallos. Desplegado en Render (prueba de humo 5/5).

**Metodología.** Design Thinking y Lean Startup en cinco ciclos (V1 → V2 → V3 → V4 → formulario), con 77 decisiones registradas. Las hipótesis se reconstruyeron de forma retrospectiva; faltan evidencias del equipo (lista en `EVIDENCIA_PENDIENTE.md`).

**Uso de IA (declaración).** El desarrollo y la redacción se hicieron con **apoyo mayoritario de IA**: Claude Code programó, probó y documentó bajo especificaciones por fases; Claude (chat) apoyó el diseño, la auditoría y los prompts; ChatGPT se usó al inicio. El equipo definió el problema, eligió entre alternativas, dirigió cada fase, probó el sistema y tomó las decisiones. No se afirma revisión línea por línea.

**Contacto con la empresa.** No hubo correos ni mensajes. La información viene de la ficha del reto y, para la socialización del 15/10 y el control del 29/10, de lo entendido por el equipo, sin evidencia escrita.

**Pendiente (no cumplido).** Llave y API reales de BUK · validación legal del aviso de privacidad (Ley 1581) · correo de privacidad · oferta publicada en LinkedIn (la cuenta espera verificación) · capturas manuales · línea base de horas.

**Dónde ver más.** Repositorio privado `puente-postulaciones-sena`, rama `entrega`: `README.md`, `docs/INDICE.md` y `docs/entrega/`.

# Puente de postulaciones · Resumen para el docente

**Reto #1 SENA · Innovación Abierta 2026-2 (CUEE 2.0, SENA Regional Antioquia) · Entrega del 13/11/2026 · Publicación anonimizada («la empresa retadora»).**

**Equipo.** Emiliano Serna Ortega, Julián Pérez Ortiz, Moisés Elio Obregón y Katherine Acosta (integrantes del equipo). Docente: Walver Rodríguez. 43 horas declaradas por el equipo.

**Problema (según la ficha del reto).** El equipo de selección descarga uno por uno los CV de cada vacante de LinkedIn y los vuelve a digitar en su ATS (BUK); la ficha estima un retraso de 2 a 4 días hábiles por candidato. Según la ficha (numeral 2.8), no se conecta la API directa de LinkedIn y el acceso a la API de BUK es controlado y guiado por un gestor acompañante; el equipo no tiene una llave de BUK.

**Solución.** Un *middleware* web (Next.js + PostgreSQL), el **Puente**, que registra solas las postulaciones en «Postulantes» del proceso correcto del ATS por su API. La oferta se **publicó en LinkedIn** con un enlace externo al formulario del Puente; también acepta postulaciones simuladas en JSON (Postman) y PDF importados. Valida, evita duplicados, verifica el CV (SHA-256), reintenta y deja trazabilidad. El ATS de la demo es un **simulador**; BUK real queda preparado pero deshabilitado.

**Resultados (11/11/2026, local, datos ficticios).** 45/45 postulaciones registradas sin error (100 %); mediana de 1,16 s por candidato; 450/450 campos correctos; 12/12 fallos provocados rechazados; 333 pruebas automáticas sin fallos; Render con prueba de humo 5/5. El equipo probó el formulario con personas y funcionó (cantidad y fecha no registradas).

**Metodología.** Design Thinking y Lean Startup en cinco ciclos (V1 → V2 → V3 → V4 → formulario), 77 decisiones registradas. La auditoría externa que originó la V4 la hizo Julián Pérez Ortiz con Claude Pro. Que la postulación empieza en LinkedIn lo dedujo el equipo analizando sus interfaces; no hubo correos, mensajes, entrevistas ni actas con la empresa.

**Uso de IA (declaración).** Desarrollo, pruebas y redacción con **apoyo mayoritario de IA** (Claude Code); Claude (chat) para diseño, auditoría y prompts. El equipo definió el problema, eligió entre alternativas, dirigió las fases, probó y tomó las decisiones. No se afirma revisión línea por línea.

**Costos.** Render gratuito (US$0); LinkedIn: 300.000 pesos colombianos por la oferta publicada; planes de IA: por confirmar.

**Pendiente.** Llave y API reales de BUK · validación legal del aviso de privacidad (Ley 1581) · correo real de privacidad en Render · tratamiento de los datos reales que lleguen por la oferta · roles individuales · planes de IA y su costo.

**Más información.** Repositorio privado `puente-postulaciones-sena`, rama `entrega`: `README.md`, `docs/INDICE.md` y `docs/entrega/`.

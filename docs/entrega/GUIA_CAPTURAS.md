# Guía de capturas manuales

> Para el equipo. Son las capturas que **solo una persona** puede tomar: Claude Code no abre LinkedIn real, no ve las conversaciones del chat ni los paneles de Render o GitHub con sesión.
> Se guardan en [docs/evidencia/](../evidencia/) con el nombre sugerido. Los documentos ya las citan como «Figura X (pendiente de insertar)».

## Reglas

1. **No se editan ni se retocan.** Solo se permite tapar datos sensibles con un **recuadro opaco** (negro o gris sólido; nunca desenfoque, que a veces se puede revertir).
2. Si se tapó algo, el pie de figura lo dice: «Se taparon: correo y teléfono».
3. **Siempre se tapan:** correos y teléfonos de personas reales, contraseñas que muestre el navegador, tokens, API Keys y `Client Secret`, la URL de la cuenta de BUK de la empresa, nombres de candidatos reales, y el nombre, NIT, dirección y contactos de la empresa retadora. **No se tapan:** datos ficticios `@demo.test`, URL de `onrender.com`, nombres de los simuladores.
4. Ventana completa, con la fecha y hora visibles si es posible (barra de tareas de Windows). Formato PNG.
5. Nombre: `AAAA-MM-DD_<letra><número>_<descripcion-corta>.png` (por ejemplo `2026-11-12_a1_linkedin-borrador-enlace.png`).
6. Antes de subirlas: abrir cada imagen y revisar que no quedó nada sensible. Si hay duda, no se sube.

## Lista de capturas

| Id | Pantalla | Qué debe verse | Qué tapar | Nombre sugerido | Se usa en |
|---|---|---|---|---|---|
| **a1** | LinkedIn → crear oferta → sección de cómo recibir solicitudes | La opción **«Recibir solicitudes: En sitio web externo»** marcada y la dirección del formulario puesta (`https://puente-postulaciones.onrender.com/postular/<código>`) | Nombre y foto de la cuenta personal si no se quieren publicar; nada de la empresa retadora | `…_a1_linkedin-borrador-enlace-externo.png` | [04](04_solucion_y_arquitectura.md) Figura 4.4; [03](03_metodologia.md) Figura 3.2 |
| **a2** | LinkedIn → borrador de la oferta completo | Título, ubicación y modalidad de la vacante de prueba | Igual que a1 | `…_a2_linkedin-borrador-oferta.png` | [04](04_solucion_y_arquitectura.md) |
| **b1** | LinkedIn → aviso de verificación de la cuenta | El mensaje que pide **esperar la verificación** (hasta 30 días, según lo que muestre la pantalla) | Correo de la cuenta | `…_b1_linkedin-verificacion-pendiente.png` | [09](09_riesgos_y_limitaciones.md), [14](14_preguntas_sustentacion.md) |
| **c1** | LinkedIn → oferta publicada (**solo si se llega a publicar**) | La oferta visible y el botón que lleva al formulario | Igual que a1 | `…_c1_linkedin-oferta-publicada.png` | [04](04_solucion_y_arquitectura.md), [12](12_demo.md) |
| **c2** | El formulario abierto **desde** la oferta publicada (solo si c1 existe) | La barra de direcciones con la URL de Render | — | `…_c2_formulario-desde-linkedin.png` | [04](04_solucion_y_arquitectura.md) |
| **d1** | Claude (chat): la auditoría externa que originó la V4 | La pregunta del equipo y la parte de la respuesta con los cambios (bot experimental, importador, `ConectorATS`) | Datos personales, nombre de la empresa si aparece | `…_d1_chat-auditoria-v4.png` | [03](03_metodologia.md) Figura 3.1, [08](08_uso_de_ia.md) |
| **d2** | Claude (chat): la decisión de descartar el bot y el motivo | El mensaje del equipo que decide y la explicación (términos de LinkedIn, sesión humana, Puerta 0) | Igual que d1 | `…_d2_chat-descartar-bot.png` | [03](03_metodologia.md) Figura 3.3 |
| **d3** | Claude (chat): redacción de los prompts por fase | Un ejemplo de prompt de fase (F0–F6) | Igual que d1 | `…_d3_chat-prompts-fase.png` | [08](08_uso_de_ia.md) §8.4 |
| **d4** | Claude (chat): ajuste de la API apagada del Simulador LinkedIn (D-68) | La conversación donde se pidió | Igual que d1 | `…_d4_chat-api-apagada.png` | [08](08_uso_de_ia.md) |
| **d5** | Claude (chat): el formulario público (D-75) | La conversación donde se eligió el formulario con enlace externo | Igual que d1 | `…_d5_chat-formulario-publico.png` | [03](03_metodologia.md), [08](08_uso_de_ia.md) |
| **e1** | Claude Code / terminal: puerta de calidad en verde | Final de `npm test` y de `npm run test:e2e` con los totales (por ejemplo «67 passed») | Nada (son datos ficticios); revisar que no salga un token | `…_e1_terminal-pruebas-verde.png` | [06](06_pruebas_y_resultados.md) Figura 6.1 |
| **e2** | Terminal: `git log --oneline -15` en la rama `entrega` | Los commits de la entrega | — | `…_e2_terminal-git-log.png` | [06](06_pruebas_y_resultados.md), [08](08_uso_de_ia.md) Figura 8.1 |
| **e3** | Claude Code: el reporte final de cada fase (F0, F1, F2, F3, F4-V, F6, entrega) | El resumen que mostró Claude Code al terminar | Tokens o contraseñas si aparecieran | `…_e3_<fase>_reporte-claude-code.png` (una por fase) | [08](08_uso_de_ia.md) |
| **f1** | Revisión con ChatGPT hecha por una persona del equipo o un conocido (**solo si existe**) | La revisión o el documento resultante | Nombre de la persona si no autoriza | `…_f1_revision-chatgpt.png` (o el PDF) | [03](03_metodologia.md), [08](08_uso_de_ia.md) |
| **g1** | Render → Dashboard | Los servicios `puente-postulaciones` y `talentia-simulado` en verde («Deployed») | Correo de la cuenta | `…_g1_render-servicios.png` | [04](04_solucion_y_arquitectura.md) §4.6 |
| **g2** | Render → `puente-postulaciones` → Environment | La lista de variables **con los valores secretos ocultos** (Render los muestra con puntos; no pulsar «mostrar») | Cualquier valor visible de `BETTER_AUTH_SECRET`, `PUENTE_CLAVE_CIFRADO`, `DATABASE_URL` | `…_g2_render-entorno-sin-secretos.png` | [07](07_seguridad_y_privacidad.md) Figura 7.1 |
| **h1** | GitHub → repositorio `puente-postulaciones-sena` | La etiqueta **Private**, la rama `entrega` por defecto y el README | — | `…_h1_github-repositorio-privado.png` | [README](../../README.md) |
| **h2** | GitHub → Settings → Collaborators | La lista de colaboradores (evaluadores invitados) | Correos de las personas | `…_h2_github-colaboradores.png` | [README](../../README.md) |

## Después de tomarlas

1. Copiarlas a `docs/evidencia/` con el nombre sugerido.
2. En el documento que la cita, reemplazar «Figura X (pendiente de insertar)» por la imagen y su pie, por ejemplo:
   `![Borrador de la oferta](../evidencia/2026-11-12_a1_linkedin-borrador-enlace-externo.png)` y debajo `*Figura 4.4. Borrador de la oferta con enlace externo. Se taparon: nombre de la cuenta.*`
3. Marcar el ítem como hecho en [EVIDENCIA_PENDIENTE.md](EVIDENCIA_PENDIENTE.md).

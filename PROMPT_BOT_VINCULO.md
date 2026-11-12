Mañana hay demostración ante el profesor. LinkedIn no nos deja publicar la vacante todavía (verificación de cuenta de hasta 30 días), así que la Puerta 0 no se puede hacer. Vas a construir esta noche, de corrido y en modo autónomo, el bot como ADAPTADOR DE SITIOS: hoy funcionará contra Vínculo (nuestra red simulada tipo LinkedIn) y el día que la Puerta 0 dé «sí», pasar a LinkedIn real será solo agregar el perfil del sitio «linkedin» (selectores y extracción), sin tocar el resto.

LEE PRIMERO: CLAUDE.md, docs/v4/CONTEXTO_V4.md, docs/v4/ESPECIFICACION_V4.md (sección R obligatoria; sección 8.3 del bot), docs/v4/INFORME_NOCHE.md, docs/estado.md y el prompt F4 de PROMPTS_V4.md (es la base; aquí se cambia el sitio de destino).

REGLAS: las de la sección R. Rama v4. Commit "v4 F4-V: bot con perfil Vínculo". NUNCA abras LinkedIn real ni crees nada que lo toque. No despliegues en Render.

QUÉ CONSTRUIR:
1. Revisa qué muestra hoy el panel del reclutador de Vínculo. El bot necesita, como usuario reclutador con sesión iniciada en Vínculo: la lista de sus vacantes, la lista de postulantes de una vacante, el detalle de un postulante con sus datos de contacto y la descarga de su CV. Si algo de eso falta en la interfaz de Vínculo, agrégalo de forma mínima en apps/vinculo (en esta fase sí puedes modificar apps/vinculo), con sus pruebas. Debe parecer un panel de reclutador normal, con su identidad visual propia.
2. apps/bot-linkedin con la estructura del prompt F4, pero con «perfiles de sitio»:
   - sitios/tipos.ts: la interfaz PerfilSitio (urlInicio, selectores, funciones de extracción, cómo detectar inicio de sesión/verificación).
   - sitios/vinculo/: perfil completo y probado contra Vínculo.
   - sitios/linkedin/: SOLO esqueleto con selectores vacíos marcados «pendiente de la Puerta 0» y una función que se niega a correr hasta que existan páginas anonimizadas. No inventes selectores de LinkedIn.
   - Variable BOT_SITIO=vinculo|linkedin (por defecto vinculo) y BOT_URL_SITIO (por defecto http://localhost:3001).
   - navegación, guardias, mapeo a PostulacionCanonica y envío a POST /api/entradas/v1/postulaciones con token: comunes a todos los sitios.
   - Comandos: bot:login (abre el navegador con perfil propio .bot-perfil-<sitio>/ para iniciar sesión a mano), bot, -- --vacante <id>, -- --seco. Ventana visible por defecto. Sin modo programado.
   - Pausas: BOT_PAUSA_MIN_MS / BOT_PAUSA_MAX_MS; para Vínculo usa por defecto 800–1500 ms para que la demo sea ágil; para LinkedIn los valores de la especificación (3000–8000). Máximo 25 por corrida.
   - Salvaguardas completas de la sección 8.3 (sin contraseñas guardadas, sin evasión, se detiene ante verificación o sesión cerrada con «Se requiere intervención humana»).
3. Script npm run demo:bot (o pasos documentados) que deje lista la demo: fuente «vinculo-bot» en el Puente con su token, correspondencia entre una vacante de Vínculo y un proceso de Talentia, y 3 postulaciones nuevas en esa vacante de Vínculo con CV ficticios. El token se muestra en consola una vez y se escribe en apps/bot-linkedin/.env (ignorado por git).

ACEPTACIÓN (pruebas automáticas):
BV-1 extracción del perfil Vínculo sobre HTML de sus páginas;
BV-2 guardias (página de inicio de sesión de Vínculo y una página de verificación de ejemplo);
BV-3 E2E: con las tres apps encendidas, el bot inicia en Vínculo con un usuario de prueba, recorre la vacante, envía al Puente y los postulantes aparecen en Postulantes de Talentia con el mismo SHA-256 del CV;
BV-4 segunda corrida = DUPLICADA, no crea nada;
BV-5 --seco no envía;
BV-6 BOT_SITIO=linkedin se niega a correr con el mensaje «perfil LinkedIn pendiente de la Puerta 0»;
BV-7 regresión completa en verde (antes 243 pruebas).
Si BV-3 no queda en verde tras intentos razonables, deja todo lo demás funcionando, commit «v4 F4-V: incompleto» y explica la causa.

DOCUMENTACIÓN: docs/manuales/bot.md (cómo correrlo contra Vínculo en Windows y qué falta para LinkedIn real), docs/decisiones.md (perfiles de sitio; por qué Vínculo primero), docs/guion-demo.md (agrega el bloque del bot), docs/estado.md.

AL TERMINAR: push de v4 y escribe docs/v4/REPORTE_F4V.md. Muéstrame como respuesta final:
1. Qué quedó funcionando y qué no.
2. GUION PARA LA DEMO DE MAÑANA, con comandos exactos de PowerShell, en este orden: encender todo, preparar la demo (demo:bot), iniciar sesión del bot en Vínculo, mostrar las 3 postulaciones en Vínculo, correr el bot con ventana visible, ver los postulantes en Talentia, correr otra vez y mostrar que no duplica, y mostrar el importador como segunda entrada.
3. Qué faltaría exactamente para pasar a LinkedIn real (lista corta).
4. Lo que tengo que hacer yo.

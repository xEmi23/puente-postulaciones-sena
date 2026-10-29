# Manual · Administrador/a del puente

Cuenta demo: `admin@puente.demo.test`. Todo lo del operador ([operador-puente.md](operador-puente.md)) más:

## Conexiones (`/conexiones`): asistente de 3 pasos

1. **Vínculo:** en el portal de desarrolladores de Vínculo crea una aplicación, copia el **Client ID** y el **Client Secret**, y pide a la empresa que la autorice (Integraciones). En el puente: URL base de Vínculo, Client ID y Client Secret → «Guardar y probar».
2. **Talentia:** crea una API Key con Lectura y Modificación (Administración → API Keys). En el puente: URL base de Talentia y API Key → «Guardar y probar».
3. **Webhook:** copia la URL que muestra el puente (`…/api/webhooks/vinculo`) y regístrala en la aplicación de Vínculo («Guardar y validar»). El puente marca «Vínculo validó el webhook».

Los secretos se guardan **cifrados** y nunca se vuelven a mostrar (solo `••••` y 4 caracteres). Para cambiarlos, escribe uno nuevo; para conservarlos, deja el campo vacío. «Probar conexión» repite la prueba; si el servicio está dormido (Render gratis) verás «Despertando…» hasta un minuto. «Desconectar» borra la conexión.

## Procesos (`/procesos`)

Lista los procesos de Talentia. **«Publicar en Vínculo»** crea la vacante con «Solicitud sencilla» y el webhook del puente; desde ese momento cada solicitud llega sola al proceso. «Cerrar en Vínculo» deja de recibir (las solicitudes hechas antes del cierre se respetan); «Publicar de nuevo» la reabre. **Publicación automática** (opcional): cada 2 minutos publica los procesos «Iniciados» nuevos.

## Correspondencias (`/correspondencias`)

Solo para vacantes creadas **a mano** en Vínculo con el ATS conectado: asocia su código (`VIN-AAAA-NNNN`) a un proceso de Talentia. «Desvincular» hace que las nuevas solicitudes se rechacen con `JOB_POSTING_CLOSED`.

## Controles de prueba (`/pruebas`)

Solo aparecen con `PUENTE_MODO_PRUEBAS=1` en un entorno local: simulan Talentia caída, respuesta perdida, lentitud, credenciales malas o un CV cortado, para mostrar los reintentos. «Quitar todos los fallos» los apaga. Nunca se activan en la demo pública.

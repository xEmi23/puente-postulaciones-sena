# Despliegue en Render (plan gratuito)

> Actualizado por Claude Code (2026-10-29). Repositorio privado `puente-postulaciones-sena`, rama `v2`. Blueprint: `render.yaml` (validado con `render blueprints validate`, ver docs/estado.md F7).

## Qué crea el Blueprint

| Recurso | Nombre | Plan | Notas |
|---|---|---|---|
| Servicio web | `vinculo-simulado` | free | Esquema `vinculo`; despachador de webhooks dentro del proceso |
| Servicio web | `talentia-simulado` | free | Esquema `talentia` |
| Servicio web | `puente-postulaciones` | free | Esquema `puente`; procesador, avisos y publicación automática dentro del proceso; `PUENTE_MODO_PRUEBAS=0` |
| PostgreSQL | `puente-postulaciones-db` | free | Una sola base; cada servicio usa su esquema (`DB_SCHEMA`) y su propia tabla de migraciones |

- **Secretos:** cada servicio genera los suyos (`generateValue`): `BETTER_AUTH_SECRET`, `VINCULO_CLAVE_CIFRADO`, `VINCULO_JWT_SECRET`, `PUENTE_CLAVE_CIFRADO`. No hay variables `sync: false` ni secretos en el repositorio. Las claves de cifrado aceptan el valor que genera Render (se deriva la clave con SHA-256; D-50).
- **Arranque:** `prisma migrate deploy` + siembra **solo si la base está vacía** (`seed.ts --si-vacio`) + `next start -p $PORT`. Despertar o reiniciar un servicio no borra lo hecho en la demo.
- **URL públicas:** cada app usa `RENDER_EXTERNAL_URL` (la pone Render) para sus enlaces, su cookie de sesión y, en el puente, la URL de su webhook.
- **Fuera de local**, Vínculo y el puente exigen https y rechazan destinos en redes privadas (SSRF); las URL `*.onrender.com` cumplen.

## Paso a paso

1. **Crear el Blueprint** (paso manual: la CLI de Render solo valida Blueprints, no los crea):
   Render → **New** → **Blueprint** → elegir el repositorio **puente-postulaciones-sena**, rama **v2** → **Deploy Blueprint**.
   Si Render no ve el repositorio privado, en GitHub dale acceso a la app de Render (Settings → Integrations → Render → acceso al repositorio).
2. **Esperar el primer despliegue** de los tres servicios (unos 5 a 10 minutos cada uno en el plan gratuito). Comprobar `https://<servicio>.onrender.com/api/salud` → `{"estado":"ok",…}`.
3. **Conectar los sistemas desde las pantallas** (es la demo del producto; ver docs/manuales/admin-puente.md):
   1. Talentia (`admin@andina.demo.test` / `Demo2026!`) → Administración → API Keys → nueva llave con **Lectura** y **Modificación** → copiarla.
   2. Vínculo (`reclutadora@andina.demo.test` / `Demo2026!`) → Desarrolladores → crear aplicación «Puente de postulaciones» → copiar Client ID y Client Secret. Luego Panel de reclutador → Integraciones → autorizar la aplicación con su Client ID.
   3. Puente (`admin@puente.demo.test` / `Demo2026!`) → Conexiones: URL de Vínculo (`https://vinculo-simulado….onrender.com`), Client ID, Client Secret → «Guardar y probar»; URL de Talentia y API Key → «Guardar y probar». Copiar la URL del webhook.
   4. Vínculo → Desarrolladores → la aplicación → pegar la URL del webhook → «Guardar y validar».
   5. Puente → Procesos → «Publicar en Vínculo» (por ejemplo 9001 y 9002).
4. **Probar:** en Vínculo como `valentina.rios@demo.test`, Solicitud sencilla a una vacante publicada; ver la operación «Completado» en el puente y la tarjeta en Talentia.

Las URL exactas de los servicios las muestra Render en cada servicio (si el nombre ya existe, Render agrega un sufijo).

## Límites del plan gratuito (Supuesto pendiente: revisar en render.com/pricing antes de presentar)

- Los servicios web gratuitos **se duermen tras unos 15 minutos sin tráfico** y tardan alrededor de un minuto en despertar. Mientras duermen, sus workers tampoco corren.
- Por eso: Vínculo reintenta cada entrega hasta 6 veces (unos 15 minutos) con 75 s de espera por intento; el puente espera hasta 75 s cuando el otro sistema lleva más de 10 minutos sin responder y reintenta hasta 10 veces (unos 13 minutos); «Probar conexión» muestra «Despertando…».
- La base PostgreSQL gratuita tiene capacidad limitada y **vence a los 30 días**: para una presentación posterior, crearla de nuevo (o pasar a un plan pago) y repetir el paso 3.
- Horas de instancia gratuitas limitadas por mes y por cuenta: apagar o suspender los servicios cuando no se usen.

## Cómo despertar antes de presentar (15 minutos antes)

1. Abrir en el navegador, uno tras otro, `https://<vinculo>/api/salud`, `https://<talentia>/api/salud` y `https://<puente>/api/salud` hasta que los tres respondan `ok`.
2. Puente → Conexiones → «Probar conexión» en Vínculo y en Talentia (las dos en verde).
3. Hacer una postulación de prueba y confirmar «Completado». Mantener las pestañas abiertas durante la presentación (el tráfico evita que se duerman).
4. **Plan B:** la demo local (`npm run dev` + `npm run demo:conectar`), mismo guion (docs/guion-demo.md).

## Restablecer los datos en Render

`demo:reset` se niega en producción a propósito. Para volver al estado inicial: en Render, borrar los esquemas (o recrear la base) y reiniciar los servicios; la siembra `--si-vacio` vuelve a cargar los datos demo. Luego repetir el paso 3.

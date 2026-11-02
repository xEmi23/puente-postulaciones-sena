# Despliegue en Render (plan gratuito)

> Actualizado por Claude Code (2026-10-29). Repositorio privado `puente-postulaciones-sena`, rama `v2`. Blueprint: `render.yaml` (validado con `render blueprints validate`, ver docs/estado.md F7).

## Despliegue actual (2026-10-29)

> Actualizado por Claude Code (2026-10-29).

| Sistema | URL pública | Servicio en Render |
|---|---|---|
| **Vínculo** (simulado) | https://vinculo-simulado.onrender.com | `vinculo-simulado` (`srv-dbhinc7f3r2c73d102d0`), plan free |
| **Talentia** (simulado) | https://talentia-simulado.onrender.com | `talentia-simulado` (`srv-dbhinc7f3r2c73d102bg`), plan free |
| **Puente** | https://puente-postulaciones.onrender.com | `puente-postulaciones` (`srv-dbhinc7f3r2c73d102dg`), plan free |
| Base | — | `puente-postulaciones-db` (`dpg-dbhin2vf3r2c73d0vhp0-a`), plan free, **vence el 2026-11-28** |

Los tres servicios desplegaron el commit `d706ddd` de la rama `v2` al primer intento (estado `live`, unos 2,5 minutos cada uno) y `/api/salud` responde `ok` en los tres.

**Cuentas de demostración** (contraseña `Demo2026!`, las mismas que en local):

| Sistema | Correo | Rol |
|---|---|---|
| Vínculo | `valentina.rios@demo.test` · `santiago.mejia@demo.test` | Candidatos |
| Vínculo | `reclutadora@andina.demo.test` | Reclutadora (Andina Software S.A.S., ficticia) |
| Talentia | `admin@andina.demo.test` · `reclutador@andina.demo.test` | Administradora · Reclutador |
| Puente | `admin@puente.demo.test` · `operador@puente.demo.test` | Administrador · Operador |

**Estado de los datos en Render (tras la prueba de humo):**

- Las conexiones del puente **ya están configuradas**: aplicación «Puente de postulaciones 202610291128» (`vin_b67d8160a16b763b`) autorizada por Andina, con webhook validado, y la API Key «Puente Render 202610291131» de Talentia.
- Quedaron revocadas una aplicación de Vínculo («… 202610291131») y una API Key («… 202610291128») creadas de más por una segunda ejecución accidental de la prueba de humo completa (ver docs/estado.md).
- El proceso **9001** está publicado en Vínculo con Solicitud sencilla y tiene dos postulaciones de prueba (Valentina y Santiago, ambas Completado y «CV descargado»). Para la demo conviene publicar y postular a otro proceso (por ejemplo 9003, como en el guion).

**Prueba de humo** (`e2e/humo-render.spec.ts`, configuración `playwright.render.config.ts`):

```bash
RENDER_HUMO=1 npx playwright test -c playwright.render.config.ts                    # recorrido completo (solo en un despliegue sin conectar)
RENDER_HUMO=1 RENDER_CANDIDATO=santiago npx playwright test -c playwright.render.config.ts -g "(0 ·|6 ·|7 ·|8 ·)"   # solo postular y verificar
```

Las URL se pueden cambiar con `RENDER_VIN`, `RENDER_TAL` y `RENDER_PUE`. **Atención:** los pasos 1 a 5 registran otra aplicación y otra llave y reconfiguran el puente; sobre un despliegue ya conectado dejan la vacante publicada en manos de una aplicación cuyo secreto el puente ya no tiene. En ese caso, solo ejecutar los pasos 0 y 6 a 8. Resultado en docs/resultados-pruebas.md.

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

1. **Crear el Blueprint** (paso manual: la CLI de Render solo valida Blueprints, no los crea; **hecho por el equipo el 2026-10-29**):
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

- Los servicios web gratuitos **se duermen tras unos 15 minutos sin tráfico** y tardan entre uno y dos minutos en despertar (medido el 2026-10-29 tras 17 minutos sin uso: Vínculo 65 s, Talentia 83 s, Puente 92 s). Mientras duermen, sus workers tampoco corren.
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

---

## V4 · Cómo desplegar (preparado, NO ejecutado)

> Actualizado por Claude Code (2026-11-02). Esta noche **no** se desplegó, no se hizo merge a `v2` (la rama del Blueprint) y no se aplicaron migraciones en Render: lo aprueba el equipo (PROMPT F5 con la frase «APROBADO PARA DESPLEGAR»). Lo que sigue es exactamente lo que se ejecutaría.

**Qué cambia en Render con la V4:** tres migraciones nuevas del Puente (`20261102120000_v4_f1_fuente`, `20261102180000_v4_f2_entrada_generica`, `20261103000000_v4_f3_importador`) que **no borran datos** (rellenan las filas existentes como `apply-connect`); tres variables nuevas del Puente en `render.yaml` (`ATS_DESTINO=talentia`, `RETENCION_CV_DIAS=30`, `PUENTE_MAX_INTENTOS=5`); la dependencia `unpdf` 1.9.0. Vínculo y Talentia no cambian.

1. **Revisión previa (local):**
   ```powershell
   git switch v4; git pull
   npm ci; npm run db:migrate
   npm run lint; npm run typecheck; npm test; npm run test:e2e
   render blueprints validate render.yaml
   ```
2. **Llevar la V4 a la rama del Blueprint** (`v2` es un ancestro de `v4`, el merge es directo):
   ```powershell
   git switch v2; git pull
   git merge --ff-only v4
   git push origin v2
   ```
   Render vuelve a desplegar los tres servicios por el push. Alternativa sin tocar `v2`: en Render → Blueprint → Settings → cambiar la rama a `v4` (y anotarlo).
3. **Migraciones:** las aplica el `startCommand` de cada servicio (`npx prisma migrate deploy`) al arrancar; no hay que hacer nada más. Para verlas: logs del servicio `puente-postulaciones` («All migrations have been successfully applied»). Nueva variable en el Blueprint: si Render no la toma sola, en el servicio → Environment → agregar `ATS_DESTINO=talentia`, `RETENCION_CV_DIAS=30`, `PUENTE_MAX_INTENTOS=5`.
4. **Verificación:**
   ```powershell
   render deploys list srv-dbhinc7f3r2c73d102dg -o json   # puente: estado live
   curl.exe -s https://puente-postulaciones.onrender.com/api/salud   # {"estado":"ok",…,"ats":{"destino":"talentia","implementado":true,…}}
   curl.exe -s https://vinculo-simulado.onrender.com/api/salud
   curl.exe -s https://talentia-simulado.onrender.com/api/salud
   ```
   Luego, en el Puente desplegado: **Fuentes** → crear `linkedin-bot` (solo si se construye el bot) y entregar su token al equipo por un canal privado (nunca en archivos); **Importar** → un PDF ficticio en un proceso de Talentia → «Enviada al ATS» → Talentia → Postulantes. Prueba de humo existente: `RENDER_HUMO=1 RENDER_CANDIDATO=santiago npx playwright test -c playwright.render.config.ts -g "(0 ·|6 ·|7 ·|8 ·)"`.
5. **Reversión (sin reescribir historia):** `git revert` de los commits V4 en `v2` y push; las columnas y tablas nuevas pueden quedarse (la v2 no las usa).

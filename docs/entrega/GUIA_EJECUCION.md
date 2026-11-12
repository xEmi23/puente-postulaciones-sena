# Guía de ejecución: comprobar el proyecto y grabar el video

> Para quien comprueba el proyecto o graba el video de la demostración, en **Windows** (CMD o PowerShell). Los comandos se ejecutaron de verdad el 11 y 12/11/2026 en la máquina del equipo (Windows 11, Node 24.2.0, PostgreSQL 16). Todo es simulado y con datos ficticios.

## 1. Requisitos (una vez)

| Qué | Cómo comprobarlo | Qué se ve |
|---|---|---|
| Node.js 22 o superior | `node -v` | `v24.2.0` (o 22+) |
| npm | `npm -v` | `11.3.0` (o similar) |
| PostgreSQL 16 o 17 **instalado** (solo se usan sus programas) | PowerShell: `Test-Path "C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe"` · CMD: `dir "C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe"` | `True` / el archivo listado. Si está en otra carpeta: `set PG_BIN=<carpeta bin>` (CMD) o `$env:PG_BIN="<carpeta bin>"` (PowerShell) |
| Git | `git --version` | La versión |

Los comandos de `npm` son **iguales** en CMD y en PowerShell. Solo cambian las variables de entorno y `curl` (sección 4).

## 2. Variante local desde cero

Abrir una terminal en la carpeta del proyecto (la que tiene `package.json`).

| Paso | Comando (CMD o PowerShell) | Qué se ve | Tiempo medido |
|---|---|---|---|
| 1. Dependencias | `npm install` | «added 686 packages» | 34 s |
| 2. Preparar todo | `npm run setup` | Crea los `.env`, enciende PostgreSQL local (puerto 5435, o el siguiente libre), migra y siembra. Termina con «✔ Listo. Ejecuta `npm run dev`…» | 34 s |
| 3. Encender las apps | `npm run dev` (**dejar esta ventana abierta**) | Tres líneas `Local: http://localhost:3001`, `:3002` y `:3003` | 20–60 s |
| 4. Conectar (en **otra** ventana, una vez) | `npm run demo:bot` | Cuatro líneas con «✔»; la tercera dice «conexión del Puente con el Simulador BUK guardada y probada» | 11 s |
| 5. Comprobar | PowerShell: `Invoke-RestMethod http://localhost:3003/api/salud` · CMD: `curl -s http://localhost:3003/api/salud` | `estado: ok`, `ATS Simulador BUK activo` | — |

Si apagas el equipo: `npm run pg:start` y luego `npm run dev` (paso 3). No hace falta repetir los pasos 1, 2 y 4.

### Recorrido por las pantallas

1. Abrir http://localhost:3003 → `admin@puente.demo.test` / `Demo2026!`.
2. **Formulario público** → «Crear enlace» en el proceso 9003 → «Copiar».
3. Abrir el enlace en una **ventana privada** (sin sesión) → llenar con datos ficticios (correo `@demo.test` nuevo) → adjuntar `fixtures\cv\cv-sofia-demo.pdf` → marcar la autorización → **esperar al menos 3 segundos** → «Enviar postulación». Se ve «Recibimos tu postulación» con un número de referencia.
4. Volver al Puente → **Operaciones**: la postulación aparece con «Completado» en 1–3 s. Al abrirla se ven los 4 pasos.
5. Abrir http://localhost:3002 → `reclutador@andina.demo.test` / `Demo2026!` → Selección → Procesos → **9003** → la tarjeta está en **«Postulantes»**. En la ficha, el CV tiene el mismo SHA-256 que muestra el Puente.
6. Repetir el paso 3 con el **mismo correo**: se ve la misma referencia y en el ATS sigue habiendo una sola tarjeta.

## 3. Variante en Render (sin instalar nada)

| Paso | Qué abrir | Cuánto esperar | Qué se ve |
|---|---|---|---|
| 1 | https://puente-postulaciones.onrender.com/api/salud | **Hasta 2 minutos** si estaba dormido (medido: ~80 s) | `{"estado":"ok","sistema":"puente",…}` |
| 2 | https://talentia-simulado.onrender.com/api/salud | Hasta 2 minutos (medido: 84 s) | `{"estado":"ok","sistema":"talentia"}` |
| 3 | https://puente-postulaciones.onrender.com/postular/cnibi7tmi252 | Inmediato si ya despertó | Formulario de la vacante de prueba (proceso 9006) |
| 4 | Panel del Puente y Simulador BUK (mismas cuentas que en local) | — | Igual que en local |

Despertar los servicios **15 minutos antes** de grabar o presentar y dejar las pestañas abiertas (el tráfico evita que se duerman). Usar un correo nuevo `@demo.test` en cada envío. La base gratuita vence el **28/11/2026**. Render tiene la versión `v4`; los dos arreglos del 11/11 solo están en la rama `entrega` (no cambian lo que se ve en la demo, salvo que en Render el detalle de una postulación del formulario puede mostrar «Aviso… Fallido»).

## 4. Entrada JSON (lo que pide la ficha)

Antes: Puente → **Fuentes** → crear una fuente → **Generar token** (copiarlo; se ve una sola vez) → **Correspondencias** → esa fuente, vacante `VAC-DEMO-1`, proceso 9001.

**PowerShell** (en la carpeta del proyecto):

```powershell
$env:TOKEN = "pega_aqui_el_token"
curl.exe -s -X POST http://localhost:3003/api/entradas/v1/postulaciones -H "Authorization: Bearer $env:TOKEN" -F "datos=<docs/entrega/postman/ejemplos/para-curl.json" -F "cv=@fixtures/cv/cv-camila-ejemplo.pdf;type=application/pdf"
```

**CMD**:

```bat
set TOKEN=pega_aqui_el_token
curl -s -X POST http://localhost:3003/api/entradas/v1/postulaciones -H "Authorization: Bearer %TOKEN%" -F "datos=<docs/entrega/postman/ejemplos/para-curl.json" -F "cv=@fixtures/cv/cv-camila-ejemplo.pdf;type=application/pdf"
```

Qué se ve: la primera vez `{"estado":"RECIBIDA",…}`; la segunda `{"estado":"DUPLICADA",…}` (mismo `idExterno`); sin token, 401. En PowerShell hay que escribir `curl.exe` (no `curl`, que es otro comando). Con Postman: [postman/GUIA.md](postman/GUIA.md).

## 5. Guion del video (5 minutos)

Grabar con Xbox Game Bar (`Win + Alt + R`) u OBS. Antes: apps encendidas (o Render despierto), las pestañas abiertas en este orden, un correo nuevo preparado y el CV a mano. Cerrar notificaciones y el gestor de contraseñas del navegador.

| Tiempo | Qué abrir | Qué decir (resumen) |
|---|---|---|
| 0:00–0:30 | README del repositorio (sección del problema) | «Según la ficha del reto, el reclutador descarga cada CV de LinkedIn y lo vuelve a digitar en BUK. La API de LinkedIn es solo para socios y no tenemos una llave de BUK, así que construimos un *middleware* que registra las postulaciones por API en un ATS simulado.» |
| 0:30–1:00 | Puente → **Formulario público** | «Cada vacante tiene un enlace. En LinkedIn se pone como enlace externo de la oferta; no automatizamos LinkedIn.» |
| 1:00–2:00 | El enlace en ventana privada → llenar → enviar → confirmación | «El candidato llena siete campos, autoriza el tratamiento según el aviso, que es un borrador, y recibe su referencia.» |
| 2:00–2:40 | Puente → **Operaciones** → abrir la postulación | «Un 202 no es una transferencia: aquí se ven los cuatro pasos hasta ‹Postulación creada›.» |
| 2:40–3:20 | Simulador BUK → proceso → **Postulantes** → ficha | «Llegó sola al proceso correcto, con el mismo SHA-256 del archivo enviado. El reclutador no descargó ni digitó nada.» |
| 3:20–3:50 | Enviar otra vez con el mismo correo | «Duplicados: misma referencia, una sola tarjeta.» |
| 3:50–4:20 | Terminal con el `curl` de la sección 4 (o Postman) | «Lo que pide la ficha: postulaciones simuladas en JSON. 202, y repetida, DUPLICADA.» |
| 4:20–4:50 | [06](06_pruebas_y_resultados.md) §6.3 | «Medimos: 45 de 45 registradas sin error, 1,16 s de mediana, 450 de 450 campos correctos.» |
| 4:50–5:00 | [08](08_uso_de_ia.md) | «El código y la documentación se hicieron con apoyo mayoritario de IA; el equipo definió el problema, eligió las alternativas y dirigió cada fase.» |

## 6. Si algo falla

| Síntoma | Solución |
|---|---|
| «Configuración inválida o incompleta» al arrancar | Falta un `.env`: `npm run setup` |
| `ECONNREFUSED` al puerto de la base | `npm run pg:start` |
| No encuentra `pg_ctl` | Definir `PG_BIN` (sección 1) |
| El formulario o una pantalla responde 500 («table … does not exist») | `npm run db:migrate` |
| La página se recarga sola sin parar en `npm run dev` («HMR hash mismatch» en la consola) | Cerrar `npm run dev`, borrar `apps\puente\.next\dev` (CMD: `rmdir /s /q apps\puente\.next\dev` · PowerShell: `Remove-Item -Recurse -Force apps\puente\.next\dev`) y volver a arrancar |
| El Puente dice «Configura primero la conexión» | `npm run demo:bot` |
| El formulario dice «Recibimos demasiados envíos desde tu conexión» | Es la protección (5 envíos por IP cada 10 minutos): esperar 10 minutos |
| El formulario dice «se envió demasiado rápido» | Esperar 3 segundos antes de enviar |
| La entrada JSON responde 422 | Falta la correspondencia de esa vacante (Puente → Correspondencias) |
| La entrada JSON responde 401 | Token mal copiado, revocado o rotado (Puente → Fuentes) |
| Un puerto está ocupado | Cerrar la otra aplicación, o cambiar el puerto en `apps\<app>\package.json` y `APP_BASE_URL` en su `.env` |
| Render no responde | Esperar hasta 2 minutos; si no, usar la variante local |

Más casos: [docs/README_TECNICO.md](../README_TECNICO.md) («Problemas frecuentes»).

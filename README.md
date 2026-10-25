# talent-bridge

Prototipo para el **Reto #1 SENA · Innovación Abierta 2026-2**: llevar automáticamente las postulaciones de un portal de empleo a un ATS, sin descargar hojas de vida ni volver a digitar datos.

> **Entorno de simulación.** No hay conexión con LinkedIn ni con BUK. El portal de origen y el ATS están **simulados**; el **puente** es el componente que se propone. Todos los datos son ficticios.

```
Portal de origen ──POST firmado (contrato Apply Connect)──▶ Puente ──HTTP (contrato del simulador)──▶ ATS
 /origen                                              /puente  (worker)                     /ats
```

Más detalle en [docs/arquitectura.md](docs/arquitectura.md).

## Requisitos

- **Node.js 22 o superior** (probado con 24.2.0) y npm.
- **PostgreSQL 16 o 17** instalado (solo se usan sus programas `initdb`, `pg_ctl`, `psql`, `createdb`; el proyecto crea su propio servidor en una carpeta local). En Windows se detecta en `C:\Program Files\PostgreSQL\16\bin`; en otro sistema, o si está en otra ruta, define `PG_BIN` con esa carpeta.
  - Alternativa con Docker: ver [Docker](#alternativa-con-docker).
- Para las pruebas E2E: el navegador de Playwright (`npx playwright install chromium`).

## Instalación desde cero

```bash
npm install                      # dependencias con versiones exactas
npm run setup                    # crea .env con secretos aleatorios, inicia PostgreSQL local, migra y siembra
```

`npm run setup` deja:

- `.env` (no se versiona) con contraseñas y claves aleatorias. Ahí están el usuario y la contraseña de la demo (`DEMO_ADMIN_USER`, `DEMO_ADMIN_PASSWORD`).
- Un PostgreSQL propio en `.pgdata/`, en el primer puerto libre desde el **5433**, con las bases `tb_dev`, `tb_test` y `tb_e2e`.
- Datos de demostración: procesos **9001** y **9002** en el ATS; vacantes **RT-2026-101 → 9001**, **RT-2026-102 → 9002** y **RT-2026-103** publicada pero sin vincular.

Si reinicias el equipo, vuelve a encender la base con `npm run pg:start`.

## Ejecutar

En dos terminales:

```bash
npm run dev      # app en http://localhost:3100 (los tres módulos)
npm run worker   # entrega las postulaciones y las procesa (sin esto no fluye nada)
```

| Módulo | URL | Acceso |
|---|---|---|
| Portal de origen («Vitrina Empleo») | http://localhost:3100/origen | público |
| Administración del simulador de origen | http://localhost:3100/origen/admin | sesión de demo |
| Panel del puente | http://localhost:3100/puente | sesión de demo |
| ATS simulado («Selecta») | http://localhost:3100/ats | sesión de demo |

La sesión de demo usa `DEMO_ADMIN_USER` y `DEMO_ADMIN_PASSWORD` de tu `.env`. Por seguridad solo funciona cuando la app se sirve desde `localhost`.

Para la demo con versión compilada: `npm run build` y luego `npm start` (en lugar de `npm run dev`).

## Demo en 6 pasos

Guion completo con tiempos: [docs/guion-demo.md](docs/guion-demo.md).

1. **Restablecer:** `npm run demo:reset`.
2. **Postular:** abre `/origen`, entra a «Desarrollador/a Backend Java», completa el formulario con datos ficticios y adjunta `fixtures/cv/cv-camila-ejemplo.pdf`.
3. **Ver la transferencia:** la confirmación cambia sola a «Entregada a la empresa». En `/puente`, la operación pasa a **Completado** con sus cuatro pasos.
4. **Ver en el ATS:** en `/ats/procesos/9001` aparece la tarjeta en **Postulantes**, «Sin calificar», fuente «LinkedIn Easy Apply (simulado)», con el aviso «1 postulante nuevo fue agregado al proceso».
5. **Descargar el CV:** en el detalle del candidato, el SHA-256 mostrado coincide con el del archivo original (`certutil -hashfile fixtures\cv\cv-camila-ejemplo.pdf SHA256` en Windows, `sha256sum` en Linux/macOS).
6. **Fiabilidad:** en `/origen/admin` pulsa «Reenviar evento»: responde `HTTP 200 · DUPLICADO` y el ATS sigue con una sola tarjeta. La consola (`/origen/admin/consola`) muestra los rechazos controlados.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run setup` | Primera instalación (ver arriba). Es seguro repetirlo: no sobrescribe `.env`. |
| `npm run pg:start` / `pg:stop` / `pg:status` | Enciende, apaga o consulta el PostgreSQL local. |
| `npm run dev` / `npm start` | App en modo desarrollo o compilada (puerto 3100). |
| `npm run worker` | Despachador del origen y procesador del puente. |
| `npm run lint` | ESLint. |
| `npm run typecheck` | Genera el cliente Prisma y ejecuta `tsc --noEmit`. |
| `npm test` | Vitest contra PostgreSQL real (`tb_test`). |
| `npm run test:e2e` | Compila y ejecuta Playwright (escritorio y móvil) contra `tb_e2e` en el puerto 3200. Requiere `npx playwright install chromium`. |
| `npm run build` | Compilación de producción. |
| `npm run db:migrate` / `db:seed` | Migraciones y datos de demostración. |
| `npm run demo:reset` | Borra y vuelve a sembrar **solo** datos marcados como demo. Se niega con `NODE_ENV=production` o con una base que no sea local. |

## Alternativa con Docker

```bash
npm install
node scripts/setup-env.mjs                     # genera .env
# toma la contraseña de DATABASE_URL en .env y expórtala:
export PG_PASSWORD=<contraseña>                 # PowerShell: $env:PG_PASSWORD="<contraseña>"
docker compose up -d                            # PostgreSQL 16 en el puerto 5433 con tb_dev, tb_test, tb_e2e
npm run db:migrate && npm run db:seed
```

Si `setup-env` eligió un puerto distinto de 5433 (porque estaba ocupado), ajusta el puerto en `docker-compose.yml` o en `.env`.

## Documentación

- [docs/contratos.md](docs/contratos.md): contratos verificados (LinkedIn Apply Connect, webhooks, BUK) y contrato del simulador.
- [docs/decisiones.md](docs/decisiones.md): registro de decisiones.
- [docs/arquitectura.md](docs/arquitectura.md): componentes, flujo y diagrama.
- [docs/mapeo-datos.md](docs/mapeo-datos.md): campo de origen → modelo interno → campo del ATS.
- [docs/guion-demo.md](docs/guion-demo.md): demostración de 5 a 7 minutos.
- [docs/resultados-pruebas.md](docs/resultados-pruebas.md): resultados de las pruebas.
- [docs/uso-ia.md](docs/uso-ia.md): qué hizo la IA y qué revisó el equipo.
- [docs/estado.md](docs/estado.md): estado por fase y pendientes.

## Problemas frecuentes

- **«Configuración inválida o incompleta en .env»**: falta `.env`. Ejecuta `npm run setup`.
- **`ECONNREFUSED` al puerto de la base**: la base está apagada. Ejecuta `npm run pg:start`.
- **No se encuentra `pg_ctl`**: define `PG_BIN` con la carpeta `bin` de PostgreSQL.
- **Las postulaciones se quedan en «Enviando a la empresa…»**: el worker no está corriendo (`npm run worker`).
- **El puerto 3100 está ocupado**: `npx next dev -p 3110` y ajusta `APP_BASE_URL`, `ORIGEN_BASE_URL`, `PUENTE_WEBHOOK_URL` y `ATS_BASE_URL` en `.env` a ese puerto.

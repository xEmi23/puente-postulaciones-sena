# Informe de la noche — V4 (02/11/2026)

> Claude Code (Claude Opus 5.5), modo autónomo nocturno según `PROMPT_NOCHE_V4.md`. Rama `v4` del repositorio privado `puente-postulaciones-sena` (único remoto: `origin`). Nada se desplegó.

## 1. Resumen

1. Las cuatro fases de la noche quedaron **completas y en verde**: F0 (auditoría), F1 (núcleo), F2 (entrada genérica), F3 (importador) y F5 (solo documentación).
2. El Puente ya **no depende de la fuente ni del ATS**: todo entra como `PostulacionCanonica v1` por una sola puerta (`registrarRecepcion`) y sale por la interfaz `ConectorATS`.
3. **Talentia** (simulado) es el único ATS activo; **BUK** existe como esqueleto **deshabilitado**, sin rutas inventadas.
4. Hay tres entradas funcionando: **importador manual** (nuevo), **entrada genérica con token** (nueva, para el bot u otra fuente) y **Apply Connect** de Vínculo (simulado, ahora pasa por la canónica).
5. Lo incompleto (sin correo, sin CV, datos sin confirmar) o el **posible duplicado** espera en «**Requiere revisión**» hasta que una persona decida; nada se fusiona solo.
6. Cada acción manual y cada cambio de estado deja un **evento de auditoría** con su actor, sin datos personales; los logs no muestran correos ni nombres.
7. **Retención y borrado:** el CV que el Puente conserva se borra a los 30 días; hay botón «Borrar datos del candidato».
8. Pruebas: de **166 a 243 en verde**; ninguna prueba anterior se debilitó ni cambió sus aserciones.
9. **No se hizo:** el bot de LinkedIn (Puerta 0 pendiente), el despliegue de la V4 en Render y el merge a `v2` (los aprueba el equipo).
10. Render sigue sirviendo la **v2** sin cambios; la V4 está lista en la rama `v4` con los comandos de despliegue escritos.

## 2. Tabla por fase

| Fase | Estado | Commit | Criterios de aceptación | Prueba que lo demuestra |
|---|---|---|---|---|
| F0 Auditoría | Completa | `d150102` | Línea base 166/166; informe con mapa, brechas, equivalencia, riesgos y plan | `docs/v4/INFORME_F0.md` |
| F1 Núcleo y ConectorATS | Completa | `d693b7e` | F1-1 anteriores sin cambios ✓ · F1-2 contrato canónico ✓ · F1-3 contrato de ConectorATS contra Talentia ✓ · F1-4 `ATS_DESTINO=buk` detiene el procesador y salud dice «ATS buk no implementado» ✓ · F1-5 Vínculo sigue llegando a Talentia ✓ · F1-6 nadie fuera de `salidas/` importa Talentia ✓ | `tests/canonica.test.ts`, `tests/conector-ats.test.ts`, `tests/nucleo-salidas.test.ts`, E2E `recorrido` y `tres-sistemas`, regla de ESLint |
| F2 Entrada genérica | Completa | `efcca0e` | G-1 202 RECIBIDA → Talentia ✓ · G-2 200 DUPLICADA ✓ · G-3 revisión sin correo/CV ✓ · G-4 401/422/415/413/429 ✓ · G-5 posible duplicado ✓ · G-6 5 fallos → FALLIDA_DEFINITIVA y reintento ✓ · G-7 retención con reloj simulado ✓ · G-8 auditoría con actor ✓ · G-9 logs sin datos personales ✓ · G-10 regresión ✓ | `tests/entrada-generica.test.ts` (19), `e2e/entrada-generica.spec.ts` (4) |
| F3 Importador | Completa | `946a0e3` | I-1 tres PDF llegan a Postulantes ✓ · I-2 reimportar = DUPLICADA ✓ · I-3 PDF sin texto → revisión ✓ · I-4 el CSV gana ✓ · I-5 no PDF / > 5 MB rechazados con mensaje ✓ · I-6 solo con sesión ✓ · I-7 E2E completo ✓ · I-8 regresión ✓ | `tests/importador.test.ts` (13), `e2e/importador.spec.ts` (4) |
| F5 Documentación | Completa (sin desplegar) | `e8eec15` | README, arquitectura, contratos, decisiones, seguridad, guion, resultados, uso de IA, estado y comandos de despliegue; revisión de honestidad sin hallazgos | `docs/v4/REPORTE_F5.md`; `render blueprints validate` → `valid: true` |

Reportes por fase: `docs/v4/REPORTE_F0.md`, `REPORTE_F1.md`, `REPORTE_F2.md`, `REPORTE_F3.md`, `REPORTE_F5.md`.

## 3. Última puerta de calidad (cierre de F3; F5 no cambió código)

| Comando | Resultado |
|---|---|
| `npm run lint` | 0 errores |
| `npm run typecheck` | 0 errores |
| `npm test` | Vínculo **26/26** · Talentia **30/30** · Puente **142/142** → **198 pasaron, 0 fallaron** |
| `npm run test:e2e` (build de las tres apps + Playwright escritorio y móvil) | **45/45 pasaron, 0 fallaron** (3,1 min) |

**Total: 243 pruebas en verde, 0 fallidas** (antes había 166: se agregaron 77). En el camino hubo fallos que se corrigieron antes de cerrar cada fase; están contados en cada reporte.

## 4. Qué cambió, para alguien que no lee código

- **El Puente ahora es un «enchufe universal».** Antes solo sabía recibir de Vínculo. Ahora cualquier fuente le entrega la postulación en un mismo formato (nombre, correo, teléfono, vacante, CV), y él hace siempre lo mismo: revisar, evitar duplicados, verificar el PDF y registrarla en el ATS.
- **Entradas nuevas:**
  - **Importador** (menú «Importar»): el reclutador elige el proceso, arrastra hasta 20 PDF que descargó de la vacante, el Puente lee cada PDF y propone el correo y el teléfono (sin inteligencia artificial: solo busca patrones), la persona revisa la tabla, corrige y confirma. Si importa el mismo PDF dos veces en el mismo proceso, no se duplica.
  - **Entrada genérica** (menú «Fuentes»): el administrador crea una «fuente» (por ejemplo, el futuro bot) y le genera una **llave secreta** que se ve una sola vez. Con esa llave, un programa puede enviar postulaciones al Puente. Así, conectar algo nuevo no exige tocar el Puente.
- **Estados nuevos:** «**Requiere revisión**» (falta el correo o el CV, o puede ser la misma persona que ya llegó por otra vía; una persona la completa, la aprueba o la descarta) y «**Fallida definitiva**» (tras 5 intentos o un error permanente; se recupera con «Reintentar»).
- **Interfaz hacia el ATS:** el Puente le habla al ATS por un «conector» con reglas fijas. Hoy el conector de **Talentia** (simulado) funciona; el de **BUK** existe pero está apagado a propósito: no escribimos nada de BUK sin su documentación. Si alguien lo activa, el Puente no envía nada y lo avisa en `/api/salud`.
- **Más control:** cada acción queda registrada (quién, qué, cuándo, sin datos personales), los CV que el Puente guarda se borran a los 30 días, y el administrador puede borrar los datos de un candidato a pedido.

## 5. Cómo lo pruebo en mi computador (PowerShell)

En la carpeta `talent-bridge-v2`:

1. **Traer la V4 y preparar** (una vez):
   ```powershell
   git switch v4
   git pull
   npm install
   npm run pg:status          # si dice que no corre: npm run pg:start
   npm run db:migrate
   ```
2. **Encender todo** (deja esta ventana abierta):
   ```powershell
   npm run dev
   ```
   Espera a que respondan http://localhost:3001, :3002 y :3003. En **otra** ventana de PowerShell, en la misma carpeta:
   ```powershell
   npm run demo:conectar
   ```
3. **Entrar al Puente:** http://localhost:3003 con `admin@puente.demo.test` / `Demo2026!`.
4. **Crear una fuente y su token:** menú **Fuentes** → Nombre corto `linkedin-bot` → **Crear fuente** → **Generar token** → copia el texto que empieza por `pf_` (no se vuelve a mostrar).
5. **Vincular su vacante:** menú **Correspondencias** → Fuente `linkedin-bot` → código `VAC-1` → proceso `9001` → **Guardar**.
6. **Probar la entrada genérica con curl** (en la segunda ventana de PowerShell):
   ```powershell
   $env:TOKEN = "pf_..."   # pega aquí tu token
   [IO.File]::WriteAllText("$PWD\datos.json", '{"version":"1","idExterno":"prueba-1","vacanteExterna":"VAC-1","candidato":{"nombres":"Ana","apellidos":"Ejemplo Ficticia","correo":"ana.ejemplo@demo.test","telefono":"300 123 4567"}}')
   curl.exe -s -X POST http://localhost:3003/api/entradas/v1/postulaciones -H "Authorization: Bearer $env:TOKEN" -F "datos=<datos.json" -F "cv=@fixtures/cv/cv-camila-ejemplo.pdf;type=application/pdf"
   ```
   Debe responder `{"estado":"RECIBIDA",...}`. Repite el mismo comando: `{"estado":"DUPLICADA",...}`. Para ver la revisión, cambia `prueba-1` por `prueba-2`, borra `"correo":"ana.ejemplo@demo.test",` del JSON y vuelve a enviar: `{"estado":"REQUIERE_REVISION","motivos":["sin_correo"]}`. En el Puente → **Operaciones** aparecen con la fuente `linkedin-bot`; abre la que está en revisión, escribe un correo, **Guardar datos** y **Aprobar y enviar al ATS**.
7. **Importar 3 PDF ficticios:** Puente → **Importar** → Proceso `9003 · Desarrollador/a Frontend React` → en «Hojas de vida» selecciona `fixtures\cv\cv-camila-ejemplo.pdf`, `fixtures\cv\cv-andres-prueba.pdf` y `fixtures\cv\cv-sofia-demo.pdf` → **Leer y sugerir datos** → revisa la tabla (correo y teléfono sugeridos) → **Confirmar e importar**. Deben decir «Enviada al ATS».
8. **Ver que llegan a Talentia:** http://localhost:3002 con `reclutador@andina.demo.test` / `Demo2026!` → Procesos → **9003** → columna **Postulantes**: las tarjetas con la fuente «Importador manual del Puente». Abre una y descarga el CV: es el mismo archivo.
9. (Opcional) Todas las pruebas: `npm run lint; npm run typecheck; npm test; npm run test:e2e`.

## 6. Decisiones nuevas y preguntas para el equipo

| # | Decisión (en `docs/decisiones.md`) |
|---|---|
| D-52 | Los estados de la base siguen siendo los de la v2 y se muestra un **estado V4 derivado** (para no cambiar pruebas existentes) |
| D-53 | Dónde vive cada capa en el código (`src/nucleo`, `src/entradas`, `src/salidas`) |
| D-54 | `ConectorATS` con parámetros opcionales para conservar lo que la v2 enviaba a Talentia |
| D-55 | `ATS_DESTINO` y `/api/salud` en 503 con BUK |
| D-56 | Teléfono a formato internacional (+57 por defecto) en todas las fuentes |
| D-57 | 5 intentos por defecto (antes 10) |
| D-58 | El CV se borra al completar si el ATS ya lo tiene; la retención de 30 días aplica a lo que el Puente conserva |
| D-59 | Tokens de fuente (hash, prefijo, tiempo constante) y límite de 60/min en memoria |
| D-60 | Correspondencias por fuente sin cambiar la clave existente |
| D-61 | Revisión humana y posible duplicado (mismo correo, mismo proceso, otra fuente) |
| D-62 | Lector de PDF: unpdf 1.9.0 |
| D-63 | El importador acepta CSV, no XLSX |
| D-64 | Importación en dos pasos con lote temporal (se borra a las 24 h) |

**Preguntas para el equipo (no bloquearon nada):**
- ¿Aceptan 5 intentos (especificación) en lugar de 10? Con Render dormido, el sistema igual se recupera (75 s por intento).
- ¿Están de acuerdo con borrar el CV del Puente apenas el ATS lo recibe (más estricto que los 30 días de la especificación)?
- ¿«Posible duplicado» por **proceso** (no por vacante) les sirve? Las vacantes de cada fuente tienen ids distintos; el proceso es lo que comparten.
- Hay archivos en la carpeta que **no** se versionaron porque no son del kit V4: `docs/v3/`, `PROMPTS_BOT.md`, `docs/insumos/` y `PROMPT_DOCUMENTACION.md`. **Este último contiene el nombre de la empresa del reto: no lo agreguen a git.**

## 7. Riesgos y deudas

- **El id del proceso del ATS es un número** (como en Talentia). Un ATS con ids de texto (posible en BUK) necesitará cambiar esa columna.
- **El límite de 60/min por token vive en memoria**: con varias instancias del Puente cada una cuenta por su lado (en Render gratuito hay una).
- **El posible duplicado** se compara con postulaciones que ya tienen proceso asignado; dos llegadas casi simultáneas desde fuentes distintas, antes de procesarse, no se marcan (el ATS igual reutiliza al postulante por correo).
- **Hipótesis sin verificar:** que los PDF descargados de LinkedIn tengan texto legible (si son imágenes, el importador no sugiere y van a revisión). Lo responde la Puerta 0.
- **Render:** la V4 no está desplegada; la base gratuita vence el **28/11/2026**; los servicios tardan ~1–1,5 min en despertar.
- **Capturas del manual del importador:** salen del entorno de pruebas local y muestran la franja «Modo prueba activo»; si se usan en la entrega, conviene repetirlas sin esa franja.
- **Configuración de git compartida:** esta carpeta es un worktree de la v1; el remoto `origin` vive en la configuración común (ya era así desde la v2). No se tocó la carpeta de la v1.

## 8. LO QUE TENGO QUE HACER YO

1. **Revisar este informe y probar en local** con los pasos de la sección 5 (unos 20 minutos). Si algo falla, anota el paso y el mensaje exacto.
2. **Hacer la Puerta 0 en LinkedIn y llenar `docs/v4/PUERTA0.md`** (especificación §10; fecha límite 3/11; ningún programa toca LinkedIn):
   1. Un integrante que acepta el riesgo usa su cuenta y crea la página de empresa del proyecto (nombre honesto, sin la marca de la empresa del reto).
   2. Publica una vacante gratuita «Vacante de prueba – proyecto académico SENA (no postular)» con postulación en LinkedIn y **captura las opciones de «cómo recibir postulantes»**.
   3. Entre 3 y 5 integrantes se postulan con postulación rápida y CV ficticios; **al menos uno sin CV**.
   4. Comprueba y deja evidencia (capturas tapadas, fuera del repositorio) de P0-1 a P0-8: publicación gratuita, lista de postulantes, ver y descargar el CV uno por uno, si se puede exigir el CV, qué datos de contacto aparecen, URLs/ids estables (guarda las páginas con Ctrl+S), opción de recibir por correo con el CV y exportación masiva.
   5. Decide: **Bot = sí** solo si pasan P0-2, P0-3 y P0-6; **Importador desde LinkedIn = sí** si pasa P0-3; **Adaptador de correo** solo si P0-7 muestra el CV. Anótalo en `PUERTA0.md` y avísame para registrarlo en `docs/decisiones.md`.
3. **Si la Puerta 0 dio «Bot = sí»:** copia las 3 páginas guardadas de LinkedIn a `fixtures/linkedin/originales/` (esa carpeta está fuera de git) y pégame el **PROMPT F4** de `PROMPTS_V4.md`.
4. **Para desplegar la V4 en Render:** pégame el **PROMPT F5** de `PROMPTS_V4.md` agregando la frase **APROBADO PARA DESPLEGAR** (y, si ya la hiciste, el resultado del importador en local y de la prueba del bot). Los pasos exactos están en `docs/despliegue.md`, sección «V4 · Cómo desplegar».
5. **Lo que solo una persona puede hacer:**
   - Pedir a la empresa, **por escrito**, la confirmación de que no hay API de LinkedIn ni llave de BUK, y su postura sobre mostrar el bot (pestaña «Validaciones pendientes»).
   - Si la empresa algún día entrega la exportación de `/apidocs` de BUK y una API Key de pruebas, guardarlas fuera del repositorio y avisarme: con eso se escribe `src/salidas/buk`.
   - Confirmar el encabezado real de la API Key de BUK (D-26) y la revisión legal de datos personales (Ley 1581; `docs/seguridad.md`).
   - Grabar el video de respaldo de la demo el 8/11 (con la fecha visible) y ensayar el guion V4 (`docs/guion-demo.md`) dos veces.
   - Repetir las capturas del manual del importador sin la franja de modo prueba si van al documento de entrega.

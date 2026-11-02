# Entregable 4. Prompts para Claude Code (V4)

**Son ocho prompts que se pegan en orden en Claude Code, abierto en la carpeta `talent-bridge-v2` en modo Auto. Cada uno hace una fase, termina con pruebas en verde, un commit y un reporte, y se detiene.** Ninguno se pega antes de revisar el reporte del anterior. Todos se apoyan en `docs/v4/ESPECIFICACION_V4.md`: la guía V4 en formato para el agente, que ya está en la carpeta junto con `docs/v4/PUERTA0.md`, la plantilla que llena el equipo.

| Prompt | Objetivo | Depende de | Lo revisa el equipo antes de seguir |
| --- | --- | --- | --- |
| F0 | Auditar el código actual frente a la V4, sin modificarlo | — | El informe de brechas y el plan de archivos |
| F1 | Contrato canónico, servicio de recepción y `ConectorATS` | F0 | Que las 166 pruebas sigan en verde |
| F2 | Entrada genérica, fuentes y tokens, revisión, auditoría y retención | F1 | Probar la entrada con el comando que da el reporte |
| F3 | Importador manual | F2 | Importar 3 PDF ficticios en local |
| F4 | Bot de LinkedIn (solo si la Puerta 0 dio «sí») | F2 y la Puerta 0 | Recorrido local con páginas anonimizadas |
| F4-A | Ajustar el bot cuando LinkedIn cambie | F4 | — |
| F5 | Prueba real, despliegue y documentación | F3 (y F4 si aplica) | Que el reporte diga qué se desplegó y cómo se verificó |
| RETOMAR | Continuar si se corta la sesión | — | — |

**Reglas comunes** (están en la sección R de la especificación y cada prompt las invoca):

1. Rama `v4` creada desde `v2`; un commit por fase con el mensaje `v4 FX: …`; push solo a `origin`.
2. Puerta de calidad al cerrar cada fase: lint, typecheck, todas las pruebas y build. Nunca se debilita una prueba existente. Solo se ajustan rutas de importación, y se registra el motivo.
3. Decisiones reversibles se toman y se registran en `docs/decisiones.md` desde D-52. Una decisión irreversible o que cambia la V4 detiene la fase y se reporta.
4. Prohibido: usar cualquier API de LinkedIn, abrir LinkedIn real desde código o pruebas, inventar rutas o encabezados de BUK, presentar algo simulado como real, guardar contraseñas, evasión de cualquier tipo, datos personales reales en el repositorio, tocar la carpeta `talent-bridge` (v1), modificar `apps/talentia` y `apps/vinculo` salvo que la fase lo diga, y escribir el nombre de la empresa del reto.
5. `docs/estado.md` al día al final de cada fase.
6. El reporte final de cada fase incluye: qué cambió (archivos), criterios con su prueba, comandos exactos para que el equipo lo compruebe, decisiones nuevas y pendientes.

## PROMPT F0 — Auditoría del código frente a la V4 (solo lectura)

```text
Lee completos: CLAUDE.md, docs/estado.md, docs/decisiones.md, docs/contratos.md, docs/arquitectura.md, docs/seguridad.md y docs/v4/ESPECIFICACION_V4.md (incluida la sección R, Reglas comunes, que debes cumplir).

OBJETIVO: entender el código real antes de cambiarlo. En esta fase NO modificas código, esquema ni pruebas.

1. Crea la rama v4 desde v2 (git switch v2 && git pull && git switch -c v4).
2. Ejecuta la línea base: lint, typecheck, todas las pruebas (Vitest y Playwright) y build. Anota cuántas pasan y cuánto tardan. Si algo ya falla, detente y repórtalo sin arreglarlo.
3. Escribe docs/v4/INFORME_F0.md con:
   a) Mapa real del Puente: archivo por archivo, dónde están la recepción del webhook de Vínculo, el modelo de recepción y sus estados, el procesador y sus pasos, el cliente de Talentia, la deduplicación, los reintentos, la reconciliación, el cifrado de la API Key, la autenticación y los roles, los logs y cualquier borrado o retención existente.
   b) Tabla «requisito de la V4 → existe / parcial / no existe → archivo», para cada punto de las secciones 6, 7, 8.1, 9 y 11 de la especificación.
   c) Equivalencia entre la estructura propuesta en la sección 5 y la organización real. Propón la mínima que cumpla la V4 sin mover archivos sin necesidad.
   d) Riesgos del refactor de F1 y F2: qué pruebas cubren cada parte y qué parte no tiene pruebas.
   e) Plan de archivos para F1, F2 y F3: lista exacta de archivos a crear y modificar y migraciones de Prisma necesarias, con cómo se migran los datos existentes.
4. Commit "v4 F0: informe de auditoría", push de la rama v4 a origin.

REPORTE: resumen del informe en 15 líneas como máximo, la línea base de pruebas y las dudas que el equipo debe resolver antes de F1. Detente.
```

## PROMPT F1 — Contrato canónico, servicio de recepción y ConectorATS

```text
Lee docs/v4/ESPECIFICACION_V4.md (secciones R, 5, 6, 7 y 9) y docs/v4/INFORME_F0.md. Cumple las Reglas comunes. Trabaja en la rama v4.

OBJETIVO: que el núcleo del Puente no conozca ni la fuente ni el ATS, sin cambiar el comportamiento visible.

CREA (ajusta las rutas a la equivalencia aprobada en el informe F0):
- nucleo/contrato: esquema Zod de PostulacionCanonica v1, normalización (correo, teléfono E.164 con +57 por defecto, espacios) y sus pruebas.
- nucleo/recepcion: registrarRecepcion(canonica, cv, actor) como ÚNICA puerta de entrada al núcleo. Valida, aplica la deduplicación dura UNIQUE(fuente, idExterno), guarda y encola.
- salidas/conector-ats.ts: la interfaz ConectorATS exactamente como la sección 9, incluido capacidades.
- salidas/talentia: traslada el cliente actual a esta interfaz sin cambiar su comportamiento.
- salidas/buk: esqueleto deshabilitado. verificarConexion responde «no configurado». Los demás métodos lanzan «no implementado: pendiente de la documentación oficial de /apidocs». Todas las capacidades en false. NO escribas rutas, encabezados ni formatos de BUK.
- Configuración ATS_DESTINO=talentia|buk (por defecto talentia). Con buk, el procesador no arranca y /api/salud lo informa.
- Pruebas de contrato de ConectorATS, escritas una vez y ejecutadas contra Talentia.

MODIFICA:
- El webhook de Vínculo: mapea a la canónica (fuente apply-connect, idExterno = id de la postulación) y llama a registrarRecepcion. La descarga del CV por URL y la firma HMAC quedan en el adaptador.
- El procesador: usa ConectorATS en lugar del cliente de Talentia. Si capacidades.adjuntarCV es false, omite documento_subido y completa con advertencia.
- Prisma: columnas fuente, idExterno y vacanteExterna con UNIQUE(fuente, idExterno). La migración rellena los registros existentes (fuente = 'apply-connect', idExterno = el id actual). Debe ser reversible o con copia previa documentada.

NO toques apps/talentia ni apps/vinculo.

ACEPTACIÓN:
F1-1 todas las pruebas anteriores pasan sin cambiar sus aserciones;
F1-2 las pruebas del contrato cubren casos válidos, inválidos y la normalización;
F1-3 las pruebas de contrato de ConectorATS pasan contra Talentia;
F1-4 con ATS_DESTINO=buk el procesador no arranca y /api/salud dice «ATS buk no implementado»;
F1-5 una postulación de Vínculo sigue llegando a Postulantes de Talentia (E2E existente);
F1-6 ningún archivo fuera de salidas/talentia importa el cliente de Talentia (prueba o regla de lint).

ERRORES: si mantener el comportamiento exige un cambio de diseño, detente y explícalo antes de hacerlo.
Cierre: puerta de calidad, docs/estado.md, commit "v4 F1: núcleo y ConectorATS", push y reporte.
```

## PROMPT F2 — Entrada genérica, fuentes, revisión, auditoría y retención

```text
Lee docs/v4/ESPECIFICACION_V4.md (secciones R, 3, 6, 7, 8.1 y 11) y el reporte de F1. Cumple las Reglas comunes. Rama v4.

OBJETIVO: que cualquier fuente nueva se conecte con un token, sin endpoints nuevos, y que lo incompleto espere a una persona.

CREA:
- Modelo Fuente (nombre único, hash SHA-256 del token, prefijo visible, activa, último uso) y su pantalla en Conexiones → Fuentes. Solo los administradores generan (el token se ve una vez), revocan y ven el último uso. Siembra la fuente apply-connect para el adaptador existente.
- Correspondencias genéricas: (fuente, vacanteExterna) → proceso del ATS. Migra las correspondencias existentes a la fuente apply-connect.
- GET /api/entradas/v1/vacantes y POST /api/entradas/v1/postulaciones con exactamente las respuestas de la sección 8.1. La fuente sale del token, nunca del cuerpo. Token comparado en tiempo constante. Límite de 60 peticiones por minuto por token (en memoria vale; documenta el límite con varias instancias).
- Estados REQUIERE_REVISION (con motivo: sin correo, sin CV, datos sin confirmar, posible duplicado) y FALLIDA_DEFINITIVA (máximo de intentos configurable, 5 por defecto).
- Aviso de posible duplicado: el mismo correo normalizado en la misma vacante desde otra fuente → REQUIERE_REVISION. Nunca fusiones solo.
- Acciones en Operaciones: completar correo o CV, aprobar, descartar y reintentar. Filtros por fuente y estado. Métricas por fuente.
- EventoAuditoria (actor = usuario o fuente, acción, idRecepcion, hora; sin datos personales) para cada acción manual y cada cambio de estado.
- Retención: tarea del Puente que borra el binario del CV RETENCION_CV_DIAS (30 por defecto) después de COMPLETADA y deja hash y metadatos. Más un botón «borrar datos del candidato» que elimina datos personales y CV y deja un evento.
- Logs con idRecepcion; correo y nombre enmascarados.

ACEPTACIÓN (con pruebas automáticas):
G-1 una postulación válida con token responde 202 RECIBIDA y llega a Talentia;
G-2 repetirla da 200 DUPLICADA y no crea nada;
G-3 sin correo o sin CV da 202 REQUIERE_REVISION y no llega al ATS hasta aprobarla;
G-4 token inválido o revocado da 401; vacante sin correspondencia, 422; archivo que no es PDF, 415; más de 5 MB, 413; más de 60 por minuto, 429;
G-5 el mismo correo por dos fuentes en la misma vacante queda como posible duplicado;
G-6 cinco fallos temporales seguidos llevan a FALLIDA_DEFINITIVA y «reintentar» la recupera;
G-7 la retención borra el binario y conserva el hash (con reloj simulado);
G-8 cada acción manual deja un evento con actor;
G-9 los logs de una corrida de prueba no contienen el correo ni el nombre de prueba;
G-10 regresión completa en verde.

En el reporte incluye un ejemplo curl con un PDF ficticio para que el equipo pruebe la entrada en local.
Cierre: puerta de calidad, docs/estado.md y docs/contratos.md (contrato de la entrada genérica), commit "v4 F2: entrada genérica", push y reporte.
```

## PROMPT F3 — Importador manual

```text
Lee docs/v4/ESPECIFICACION_V4.md (secciones R y 8.2) y el reporte de F2. Cumple las Reglas comunes. Rama v4.

OBJETIVO: que un reclutador lleve CV descargados al ATS sin digitar, confirmando los datos sugeridos.

CREA:
- Página Importar en el panel del Puente: elegir el proceso del ATS (o una correspondencia), arrastrar hasta 20 PDF (5 MB máximo cada uno) y, opcionalmente, un CSV con columnas archivo, nombres, apellidos, correo, telefono. Si el XLSX es simple de soportar con una librería mantenida y sin dependencias nativas, acéptalo también; si no, solo CSV, y regístralo como decisión.
- Lectura de texto del PDF con una librería en JavaScript puro que funcione en Render. Elígela y registra la decisión con la versión exacta. Sugiere el correo y el teléfono con expresiones regulares. El nombre sale del CSV o del nombre del archivo. Sin IA.
- Tabla de revisión: cada fila editable; la persona confirma. Los datos confirmados llevan origenDatos = confirmado-por-persona.
- Cada fila confirmada se convierte en una PostulacionCanonica (fuente = importador, idExterno = <idProceso>:<sha256 del PDF>) y entra por registrarRecepcion. No se crea otro camino hacia el ATS.
- Los PDF sin texto o sin correo quedan en REQUIERE_REVISION.
- Pruebas con tres PDF ficticios generados en la propia prueba con pdf-lib (sin datos reales).

ACEPTACIÓN:
I-1 tres PDF con correo en el texto llegan a Postulantes del proceso elegido en Talentia;
I-2 importar el mismo PDF otra vez en el mismo proceso da DUPLICADA;
I-3 un PDF sin texto queda en REQUIERE_REVISION;
I-4 el CSV completa los nombres y gana sobre lo sugerido;
I-5 un archivo que no es PDF o pesa más de 5 MB se rechaza con un mensaje claro;
I-6 solo usuarios con sesión iniciada pueden importar;
I-7 E2E con Playwright del recorrido completo;
I-8 regresión completa en verde.

Cierre: puerta de calidad, docs/manuales/importador.md (pasos para el reclutador, con capturas de la versión local), docs/estado.md, commit "v4 F3: importador", push y reporte.
```

## PROMPT F4 — Bot de LinkedIn (solo si la Puerta 0 dio «sí»)

```text
Lee docs/v4/ESPECIFICACION_V4.md (secciones R, 8.3, 10 y 11), docs/v4/PUERTA0.md con los resultados del equipo y el reporte de F2. Cumple las Reglas comunes. Rama v4.

CONDICIÓN: si docs/v4/PUERTA0.md no dice «Bot = sí» con P0-2, P0-3 y P0-6 aprobados, NO construyas nada. Repórtalo y detente.

ENTRADAS:
- El equipo dejó las páginas guardadas de LinkedIn en fixtures/linkedin/originales/. Esa carpeta debe estar en .gitignore; verifícalo antes de cualquier commit.

CREA:
1. scripts/anonimizar-fixtures: copia cada HTML a fixtures/linkedin/anonimizadas/, reemplaza nombres, correos, teléfonos, URL de perfil y fotos por valores ficticios, y quita los scripts. La prueba falla si queda en las copias algún correo o nombre de la lista de originales.
2. apps/bot-linkedin (Node, TypeScript y Playwright; no importa código de otras apps):
   - navegacion/ con selectores.ts (todos los selectores, comentados);
   - extraccion/ con funciones puras HTML → datos, derivadas de las páginas anonimizadas;
   - guardias/ (verificación, captcha, inicio de sesión, advertencia → detenerse con «Se requiere intervención humana»);
   - mapeo/ (datos → PostulacionCanonica sin fuente);
   - envio/ (multipart a POST /api/entradas/v1/postulaciones con reintentos que cubran ~90 s de arranque de Render);
   - comandos bot:login, bot, --vacante <id> y --seco;
   - .env.example sin secretos (PUENTE_URL, PUENTE_BOT_TOKEN, BOT_MAX_POR_EJECUCION=25, BOT_PAUSA_MIN_MS=3000, BOT_PAUSA_MAX_MS=8000, BOT_HORARIO=07-19, BOT_HEADLESS=false). Sin modo programado.
3. Salvaguardas obligatorias de la sección 8.3: ventana visible, sesión iniciada a mano en .bot-perfil/ (en .gitignore), sin contraseñas, sin evasión, solo vacantes que devuelve GET /api/entradas/v1/vacantes, pausas y límites.

ACEPTACIÓN:
B-1 la extracción da los campos esperados de cada página anonimizada;
B-2 las guardias detienen el bot ante páginas de verificación, captcha e inicio de sesión (HTML de ejemplo escritos para la prueba);
B-3 E2E local: un servidor de pruebas sirve las páginas anonimizadas como si fuera LinkedIn, el bot recorre, envía al Puente y el postulante aparece en Talentia con el mismo SHA-256;
B-4 una segunda corrida no crea nada (DUPLICADA);
B-5 --seco no envía nada;
B-6 límite por corrida y pausas respetados (reloj simulado);
B-7 ningún archivo de fixtures/linkedin/originales/ queda versionado;
B-8 regresión completa en verde.

NUNCA abras LinkedIn real ni desde el código ni desde las pruebas.
Cierre: puerta de calidad, docs/manuales/bot-linkedin.md (Windows y PowerShell), docs/seguridad.md (riesgo de la cláusula 8.2 y salvaguardas), docs/estado.md, commit "v4 F4: bot experimental", push y reporte.
```

## PROMPT F4-A — Ajustar el bot cuando LinkedIn cambie

```text
El bot se detuvo con «No se encontró el elemento». El equipo guardó de nuevo la página en fixtures/linkedin/originales/<nombre>.html. Cumple las Reglas comunes. Rama v4.
Ejecuta scripts/anonimizar-fixtures, ajusta solo selectores.ts y, si hace falta, extraccion/ a la estructura nueva. Actualiza las pruebas B-1 y B-3 con la página nueva y ejecuta la regresión completa. Registra el cambio en docs/decisiones.md con la fecha. No abras LinkedIn real.
Commit "v4 F4-A: selectores <fecha>", push y reporte.
```

## PROMPT F5 — Prueba real, despliegue y documentación

```text
Lee docs/v4/ESPECIFICACION_V4.md (secciones R, 14 y 15), docs/v4/PUERTA0.md y los reportes de F0 a F4. Cumple las Reglas comunes. Rama v4.

RESULTADOS DEL EQUIPO (los pega el equipo):
- Importador en local: <resultado>
- Prueba real del bot (si aplica): <fecha, cuántas postulaciones, cuántas llegaron, errores, enlace al video>

1. Si hubo errores, reprodúcelos con pruebas (páginas anonimizadas o PDF ficticios), corrige lo mínimo y ejecuta la regresión completa.
2. Despliegue. Solo si este prompt contiene la frase APROBADO PARA DESPLEGAR escrita por el equipo:
   a) haz merge de v4 en la rama que usa el Blueprint de Render (o cambia la rama del Blueprint) y explica cuál usaste;
   b) aplica las migraciones con prisma migrate deploy;
   c) crea en el Puente desplegado las fuentes importador y linkedin-bot (si aplica) y entrega los tokens al equipo por el reporte, nunca en archivos;
   d) verifica /api/salud de los tres servicios, una importación con un PDF ficticio y, si aplica, npm run bot -- --seco contra Render.
   Sin la frase, prepara todo, deja los comandos en el reporte y no despliegues.
3. Documentación: README (arquitectura V4 y cómo probar cada entrada), docs/arquitectura.md (capas), docs/contratos.md (canónica, entrada genérica y ConectorATS), docs/decisiones.md, docs/seguridad.md (datos personales, retención y obligaciones pendientes de la empresa; sin afirmar cumplimiento), docs/guion-demo.md (guion de la sección 15.3 y plan B), docs/resultados-pruebas.md (resultados reales con fecha), docs/uso-ia.md y docs/estado.md.
4. Revisa que ningún documento ni texto de la interfaz presente a Talentia o a Vínculo como servicios reales, ni al adaptador de BUK como conectado.

Cierre: commit "v4 F5: despliegue y documentación", push y reporte final con: qué está desplegado, qué es simulado, qué es experimental y qué falta para BUK real.
```

## RETOMAR — Si se corta la sesión

```text
Lee CLAUDE.md, docs/v4/ESPECIFICACION_V4.md, docs/estado.md y el último informe o reporte de docs/v4/. Cumple las Reglas comunes. Ejecuta las pruebas para conocer el estado real. Retoma el primer criterio de aceptación pendiente de la última fase iniciada, sin rehacer lo que ya pasa sus pruebas. Actualiza docs/estado.md y reporta.
```

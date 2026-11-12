# Especificación V4 — Puente de postulaciones (fuente de verdad para Claude Code)

> Actualizado por Claude Code (2026-11-12): no hubo correos, mensajes, entrevistas ni actas con la empresa. Lo relativo a la API de LinkedIn y a la llave de BUK cita la ficha del reto, numeral 2.8 (acceso a BUK controlado y guiado por un gestor acompañante; el equipo no tiene llave; no se afirma que la empresa se haya negado). Que la postulación empieza en LinkedIn lo dedujo el equipo analizando las interfaces de LinkedIn.

> Documento del equipo (01/11/2026). Reemplaza a docs/v3/ESPECIFICACION_BOT.md como especificación vigente; docs/v3 queda como historia.
> Etiquetas: **Comprobado** · **Hipótesis** · **Recomendación** · **Simulado**. Lo marcado **[V4]** es nuevo frente a la V3.
> Este archivo es del equipo: no lo reescribas. Si algo no se puede cumplir, regístralo en docs/decisiones.md con motivo y alternativa.

## R. Reglas comunes (obligatorias en todas las fases)

1. Rama `v4` creada desde `v2`; un commit por fase con mensaje `v4 FX: …`; push solo a `origin`.
2. Puerta de calidad al cerrar cada fase: lint, typecheck, todas las pruebas (Vitest y Playwright) y build. Nunca se debilita una prueba existente; solo se ajustan rutas de importación, registrando el motivo.
3. Decisiones reversibles: tómalas y regístralas en `docs/decisiones.md` desde D-52. Una decisión irreversible o que cambie esta especificación detiene la fase y se reporta.
4. Prohibido: usar cualquier API de LinkedIn; abrir LinkedIn real desde código o pruebas; inventar rutas, encabezados o formatos de BUK; presentar algo simulado como real; guardar contraseñas; evasión de cualquier tipo (captchas, anti-detección, proxies, rotación de IP); datos personales reales en el repositorio; tocar la carpeta `talent-bridge` (v1); modificar `apps/talentia` y `apps/vinculo` salvo que la fase lo diga; escribir el nombre de la empresa del reto.
5. `docs/estado.md` al día al final de cada fase.
6. Reporte final de cada fase: qué cambió (archivos), criterios con su prueba, comandos exactos para que el equipo lo compruebe, decisiones nuevas y pendientes.


**El producto es el Puente: un middleware que recibe postulaciones de cualquier fuente con un contrato común, las valida, evita duplicados, verifica el CV y las registra en Postulantes del proceso correcto del ATS, con trazabilidad completa.** Las fuentes son adaptadores intercambiables:

- un importador manual (legal y siempre disponible);
- un bot asistido para LinkedIn (experimental, condicionado a una verificación previa);
- la integración oficial Apply Connect, hoy demostrada con la red simulada Vínculo.

El destino también es un adaptador: Talentia (ATS simulado tipo BUK) en la demo y BUK real cuando haya documentación y llave.

**Cómo leer esta guía:** cada afirmación lleva una etiqueta.

| Etiqueta | Significado |
| --- | --- |
| **Comprobado** | Probado en el sistema o con fuente y fecha |
| **Hipótesis** | Pendiente de validar; tiene un ítem en la pestaña 5 |
| **Recomendación** | Decisión de diseño del equipo |
| **Simulado** | Funciona contra una simulación, no contra el servicio real |

Los cambios frente a la V3 llevan la marca **\[V4\]** y se explican en la pestaña 3.

## 1. Contexto, restricciones y alcance

**Reto:** pasar los postulantes de LinkedIn a Postulantes de la vacante correcta en el ATS de la empresa (BUK), sin descargas ni digitación manual (Reto #1, Innovación Abierta 2026-2, SENA Regional Antioquia). Sustentación el 13/11/2026.

| Restricción | Consecuencia |
| --- | --- |
| Sin API de LinkedIn: es solo para socios aprobados (**Comprobado**, Microsoft Learn) | Cualquier entrada desde LinkedIn es manual, un bot o la integración oficial que active el fabricante del ATS |
| Sin API Key de BUK; no se puede modificar BUK | El destino de la demo es Talentia (**Simulado**). BUK real queda preparado, pero deshabilitado |
| Que no dependa de la API de LinkedIn: según la ficha del reto, numeral 2.8. Que la postulación siga ocurriendo en LinkedIn: lo dedujo el equipo analizando las interfaces de LinkedIn | Se descartan las fuentes que sacan al candidato de LinkedIn |
| 12 días hasta la entrega; prototipo sin aprobaciones externas | Alcance mínimo y demostrable; fechas de decisión fijas |
| El repositorio se publica anonimizado | Sin el nombre de la empresa en código ni en documentos públicos |

**Alcance V4:** el Puente con la entrada genérica, el importador, el bot experimental si pasa la Puerta 0, el adaptador de salida para Talentia, el esqueleto deshabilitado de BUK, Vínculo como demostración de Apply Connect, el despliegue en Render y la documentación.

**Fuera de alcance:** conexión real con BUK, uso del bot con la cuenta de la empresa, modo programado, extracción de datos con IA y alta disponibilidad.

## 2. Principios de diseño

1. **Más confiable, no más grande.** Una función entra al alcance solo si se puede demostrar el 13/11.
2. **El núcleo no conoce la fuente ni el destino.** Fuentes y ATS son adaptadores; el núcleo trabaja con la postulación canónica y con `ConectorATS`.
3. **Nada simulado se presenta como real.** Talentia y Vínculo se nombran siempre como simulaciones; el adaptador de BUK no contiene rutas inventadas.
4. **Primero verificar, después programar.** Toda capacidad externa sin comprobar pasa por una prueba manual antes de convertirse en código.
5. **Ante la duda, una persona decide.** Lo incompleto o ambiguo queda en «requiere revisión»; nada se descarta ni se fusiona en silencio.
6. **Datos mínimos y con fecha de borrado.**
7. **Cada cambio de código deja pruebas en verde y no rompe lo que funciona** (las 166 pruebas actuales siguen pasando).

## 3. Qué es automático y qué requiere a una persona

**El sistema no es «100 % automático».** Automatiza todo lo que pasa después de que una postulación entra al Puente. La entrada desde LinkedIn necesita siempre una acción humana. **\[V4\]**

| Paso | Modo | Depende de |
| --- | --- | --- |
| El candidato se postula en LinkedIn | Humano (el candidato) | LinkedIn |
| Publicar la vacante y vincularla a un proceso en el Puente | Humano, una vez por vacante | LinkedIn y el Puente |
| Iniciar sesión en LinkedIn en el perfil del bot | Humano, cuando la sesión vence | LinkedIn |
| Llevar las postulaciones al Puente con el **bot** | Bajo demanda: el reclutador lo ejecuta; el recorrido es automático y se detiene ante cualquier verificación | LinkedIn (no garantizado) |
| Llevar los CV al Puente con el **importador** | Humano: descarga los CV y los arrastra al panel; el Puente sugiere los datos y la persona confirma | LinkedIn solo para descargar |
| Recibir postulaciones por **Apply Connect** (Vínculo) | Automático (webhook) | **Simulado**; en real depende de BUK y LinkedIn |
| Validar, deduplicar, verificar el PDF y registrar en el ATS | Automático, con reintentos | El ATS |
| Resolver lo marcado «requiere revisión» o «posible duplicado» | Humano, en el panel | — |
| Borrar los CV vencidos | Automático, programado en el Puente | — |

**Qué puede programarse:** solo tareas internas del Puente (reintentos, reconciliación, borrado). El bot no se programa en la V4.

## 4. Fuentes de candidatos: alternativas evaluadas

**Ninguna fuente cumple a la vez los cuatro deseos: postulación en LinkedIn, sin su API, automático y dentro de sus términos.** Por eso la V4 no elige una sola. Combina una entrada legal siempre disponible con un bot experimental y deja lista la entrada oficial. **\[V4\]**

| Alternativa | La postulación sigue en LinkedIn | Términos de LinkedIn | Automático | Qué la hace posible | Papel en la V4 |
| --- | --- | --- | --- | --- | --- |
| **Importador manual** (CV descargados, arrastrados al panel) | Sí | Cumple | No: descarga manual; la digitación se reduce a confirmar | Que el publicador pueda descargar CV (Puerta 0) | **Indispensable.** Entrada legal y plan B |
| **Bot asistido** (Playwright, sesión del reclutador) | Sí | **Infringe la cláusula 8.2** | Bajo demanda | Puerta 0 completa y cuenta que acepta el riesgo | **Experimental**, solo si pasa la Puerta 0 |
| **Apply Connect** (oficial, activado por el ATS) | Sí | Cumple | Sí | Que BUK lo ofrezca y la empresa lo active | **Objetivo futuro**; demostrado con Vínculo (**Simulado**) |
| **Importar la exportación de Recruiter** («Export all to XLSX») | Sí | Cumple | No: un clic | Licencia de Recruiter (no Lite) | **Opcional.** Solo si la empresa tiene Recruiter; el importador acepta ese XLSX |
| **Correo de notificación** de LinkedIn | Sí | Cumple si es correo propio | Sí | Que exista la opción y que el correo traiga el CV (**Hipótesis**) | **Condicionado** a la Puerta 0; no se programa sin evidencia |
| Formulario propio, buzón o WhatsApp | No | Cumple | Sí | — | Descartado: la postulación debe empezar en LinkedIn (lo dedujo el equipo analizando las interfaces de LinkedIn) |
| Bot en la nube, agente de IA o extensión de navegador | Sí | Infringe | Sí | — | Descartado: más riesgo de bloqueo y la sesión de LinkedIn fuera del PC del reclutador |

**Por qué el importador es indispensable aunque no sea automático:** el dolor del reto es doble, descargar y volver a digitar. El importador elimina la digitación y la carga en BUK, cumple los términos, no depende de selectores y sigue funcionando si LinkedIn cambia o bloquea. Con él, la demo siempre muestra un recorrido completo y real hasta el ATS.

## 5. Arquitectura por capas \[V4\]

**Toda fuente entra por el mismo contrato y todo ATS se alcanza por la misma interfaz. Cambiar una fuente o un destino no toca el núcleo.**

```
ADAPTADORES DE ENTRADA        PUENTE (EL PRODUCTO)                         ATS
+----------------------+      +--------------------------------------+
| Importador manual    |--+   | NÚCLEO                               |
| (indispensable)      |  |   |  Recepción: entrada genérica + token |
+----------------------+  |   |  Contrato canónico v1 (Zod)          |
| Bot de LinkedIn      |--+-->|                                      |
| (experimental)       |  |   | PROCESAMIENTO Y VALIDACIÓN           |
+----------------------+  |   |  Deduplicación y revisión            |
| Apply Connect        |--+   |  Cola y pasos reanudables            |
| (Vínculo, simulado)  |  |   |                                      |
+----------------------+  |   | ADAPTADOR DE SALIDA                  |   +------------------+
: Oficial futura       :..+   |  ConectorATS: talentia | buk         |-->| Talentia (activo,|
: (mismo contrato)     :      +--------------------------------------+   |  simulado)       |
+......................+                                          :....>: BUK real         :
                                                                         : (deshabilitado)  :
```

Las líneas punteadas son lo que no está activo hoy: la integración oficial futura y BUK real. Talentia es el único ATS conectado y es una simulación.

| Capa | Responsabilidad | No hace |
| --- | --- | --- |
| Adaptadores de entrada | Obtener la postulación en su origen y convertirla a la canónica | Validar reglas de negocio, deduplicar o hablar con el ATS |
| Núcleo del Puente | Autenticar la fuente, validar el contrato, normalizar y guardar la recepción | Saber de qué sitio vino |
| Procesamiento y validación | Deduplicar, enviar a revisión, ejecutar los pasos con reintentos, auditar y medir | Conocer rutas del ATS |
| Adaptador de salida (`ConectorATS`) | Traducir los pasos a la API de cada ATS | Decidir reintentos o estados |
| ATS | Guardar postulante, CV y postulación en Postulantes | — |

**Estructura del repositorio** (cambios en la V4):

```
apps/puente/src/
  nucleo/contrato/       PostulacionCanonica v1 (Zod) y normalización      [V4]
  nucleo/recepcion/      servicio único registrarRecepcion()               [V4]
  nucleo/procesador/     pasos, cola, reintentos (v2, sin conocer Talentia)
  entradas/generica/     POST /api/entradas/v1/postulaciones, tokens        [V4]
  entradas/apply-connect/ webhook de Vínculo → canónica                    [V4: mapeo]
  entradas/importador/   carga de PDF, sugerencia y confirmación           [V4]
  salidas/conector-ats.ts interfaz ConectorATS                             [V4]
  salidas/talentia/      cliente de la v2 trasladado                       [V4: traslado]
  salidas/buk/           esqueleto deshabilitado                           [V4]
apps/bot-linkedin/       adaptador experimental (solo si pasa la Puerta 0)
apps/talentia, apps/vinculo  sin cambios
```

Las rutas exactas las confirma F0 frente al código real; si la v2 ya usa otra organización, se respeta y se registra la equivalencia.

## 6. Contrato canónico de postulación \[V4\]

**Todo adaptador de entrada entrega una `PostulacionCanonica v1` y nada más.** El núcleo solo conoce este formato. Se valida con Zod en un solo módulo compartido.

```json
{
  "version": "1",
  "fuente": "linkedin-bot | importador | apply-connect | <otra>",
  "idExterno": "identificador de la postulación en la fuente",
  "vacanteExterna": "identificador de la vacante en la fuente",
  "recibidaEn": "2026-11-05T14:03:00-05:00",
  "candidato": {
    "nombres": "...", "apellidos": "...",
    "correo": "opcional", "telefono": "opcional, E.164",
    "ciudad": "opcional", "titular": "opcional", "perfilUrl": "opcional"
  },
  "cv": { "nombreArchivo": "...", "tipo": "application/pdf", "sha256": "...", "bytes": 123456 },
  "respuestas": [ { "pregunta": "...", "respuesta": "..." } ],
  "origenDatos": "fuente | extraido-del-cv | confirmado-por-persona"
}
```

| Regla | Detalle |
| --- | --- |
| Obligatorios | `version`, `fuente`, `idExterno`, `vacanteExterna`, `candidato.nombres` |
| Sin correo o sin CV | Se recibe, pero queda en `REQUIERE_REVISION`; no se envía al ATS hasta que una persona complete |
| `fuente` | La fija el token o el adaptador, nunca el cuerpo de la petición |
| Clave de deduplicación dura | `fuente + idExterno` (única en la base) |
| Normalización | Correo en minúsculas y sin espacios; teléfono a E.164 con +57 por defecto si no trae indicativo; nombres con espacios limpios |
| CV | El binario viaja aparte (multipart o descarga del adaptador). El contrato lleva su SHA-256 y tamaño |
| Versiones | Un cambio incompatible crea la `v2` del contrato; los adaptadores viejos siguen funcionando con la `v1` |

## 7. El Puente: núcleo de procesamiento

**El Puente recibe, valida, deduplica, guarda y registra con pasos reanudables. Cada postulación tiene un estado visible y cada acción deja un evento.**

**Estados de una recepción:**

1. `RECIBIDA`: entró y pasó la validación de forma.
2. `REQUIERE_REVISION` **\[V4\]**: falta correo o CV, el dato vino extraído sin confirmar, o es posible duplicado. Una persona la completa, la aprueba o la descarta en el panel.
3. `EN_PROCESO`: pasos `cv_verificado → postulante_listo → documento_subido → postulacion_creada`, cada uno idempotente y reanudable.
4. `COMPLETADA`: está en Postulantes del proceso del ATS.
5. `DUPLICADA`: la clave dura ya existía; no se crea nada.
6. `FALLIDA_REINTENTABLE`: error temporal (red, 5xx, 429); se reintenta con espera creciente.
7. `FALLIDA_DEFINITIVA` **\[V4\]**: error permanente (4xx de validación, proceso inexistente) o máximo de intentos. Botón «reintentar» en el panel.

| Mecanismo | Regla |
| --- | --- |
| Deduplicación dura | `UNIQUE(fuente, idExterno)`; la segunda llegada responde `DUPLICADA` |
| Posible duplicado **\[V4\]** | El mismo correo en la misma vacante desde otra fuente pasa a `REQUIERE_REVISION`; nunca se fusiona solo |
| Idempotencia hacia el ATS | `Idempotency-Key` por paso; antes de crear se consulta si ya existe (reconciliación) |
| Concurrencia | Trabajos tomados con `FOR UPDATE SKIP LOCKED` y arrendamiento con vencimiento |
| Reintentos | Máximo configurable (5 por defecto), espera creciente con variación aleatoria |
| Archivos | Solo PDF (`%PDF` en los primeros bytes), máximo 5 MB, SHA-256 al recibir y después de subir al ATS |
| Retención **\[V4\]** | El binario del CV se borra `RETENCION_CV_DIAS` después de completar (30 por defecto) o a pedido; quedan los metadatos y el hash |
| Eventos de auditoría **\[V4\]** | Cada acción guarda actor (usuario o token de fuente), acción, `idRecepcion` y hora, sin datos personales |
| Logs | Una línea por evento con `idRecepcion`; correo y nombre enmascarados |
| Métricas | Por fuente: recibidas, completadas, en revisión, duplicadas, fallidas; mediana y p95 de recepción a completada |
| Recuperación | Si el proceso se cae a mitad de un paso, al volver retoma el último paso confirmado |

## 8. Adaptadores de entrada

### 8.1 Entrada genérica del Puente \[V4\]

| Elemento | Detalle |
| --- | --- |
| Tokens por fuente | Conexiones → «Fuentes»: crear fuente (nombre corto, p. ej. `linkedin-bot`), generar token (se ve una vez, se guarda con hash SHA-256), revocar, ver último uso |
| Correspondencias | Genéricas: (fuente, vacante externa) → proceso del ATS |
| `GET /api/entradas/v1/vacantes` | Con token: vacantes vinculadas a esa fuente |
| `POST /api/entradas/v1/postulaciones` | Con token; multipart: `datos` (canónica sin `fuente`) + `cv` (PDF ≤ 5 MB) |
| Respuestas | 202 `RECIBIDA` · 202 `REQUIERE_REVISION` · 200 `DUPLICADA` · 400 validación · 401 token · 413 tamaño · 415 no PDF · 422 vacante sin correspondencia · 429 demasiadas peticiones |
| Límite | 60 peticiones por minuto por token |

Agregar una fuente nueva = crear la fuente, darle su token y escribir un adaptador que llame a esta entrada. El núcleo no cambia.

### 8.2 Importador manual \[V4\] (indispensable)

1. En el panel: **Importar** → elegir el proceso del ATS (o una correspondencia existente).
2. Arrastrar hasta 20 PDF. Opcional: un CSV o XLSX con columnas `archivo, nombres, apellidos, correo, telefono`. Sirve para la exportación de Recruiter si la empresa la tiene.
3. El Puente lee el texto del PDF y **sugiere** correo y teléfono con expresiones regulares (sin IA). El nombre sale del CSV o del nombre del archivo.
4. La persona revisa una tabla, corrige y confirma. Los datos quedan con `origenDatos = confirmado-por-persona`.
5. Cada fila se convierte en una canónica con `fuente = importador` e `idExterno = <proceso>:<sha256 del PDF>`. Así, importar dos veces el mismo PDF en el mismo proceso da `DUPLICADA`.

**Hipótesis:** que el texto de los PDF se pueda leer. Un PDF escaneado sin texto queda en `REQUIERE_REVISION` para digitar sus datos.

### 8.3 Bot asistido de LinkedIn (experimental, condicionado a la Puerta 0)

- **Se conserva de la V3:** Playwright con ventana visible, perfil propio `.bot-perfil/` con sesión iniciada a mano, sin contraseñas, sin evasión, se detiene ante verificaciones, pausas de 3 a 8 s, máximo 25 por corrida, horario 07–19, solo vacantes propias, selectores en un archivo y extracción con funciones puras probadas con páginas guardadas.
- **Cambia \[V4\]:** envía a la entrada genérica con el token de la fuente `linkedin-bot`. Arma la canónica en un módulo de mapeo. Sin modo programado. Las páginas guardadas se versionan solo anonimizadas.
- **Comandos:** `npm run bot:login -w apps/bot-linkedin`, `npm run bot -w apps/bot-linkedin`, con `-- --vacante <id>` y `-- --seco`.
- **Si la Puerta 0 muestra que el CV no se puede obtener**, el bot no se construye. Su lugar en la demo lo toma el importador.

### 8.4 Apply Connect (Vínculo, simulado)

El webhook firmado con HMAC de la v2 se mantiene como adaptador propio, porque descarga el CV por URL. **\[V4\]** Su mapeo produce la canónica con `fuente = apply-connect` y llama al mismo servicio de recepción. Es la ruta oficial futura: el día que BUK active Apply Connect, cambian las credenciales y la URL, no el núcleo.

### 8.5 Correo de notificación (condicionado)

Solo se diseña si la Puerta 0 muestra una opción de recibir postulaciones por correo que incluya el CV. En ese caso sería un adaptador que lee un buzón dedicado. **No se programa en la V4 sin esa evidencia.**

## 9. Adaptadores de salida: Talentia y BUK \[V4\]

**El procesador solo habla con la interfaz `ConectorATS`. Talentia la implementa completa y probada (Simulado). BUK queda como esqueleto deshabilitado, sin rutas inventadas.**

```ts
interface ConectorATS {
  nombre: 'talentia' | 'buk';
  capacidades: { adjuntarCV: boolean; buscarPorCorreo: boolean; idempotencia: boolean };
  verificarConexion(): Promise<ResultadoConexion>;
  listarProcesos(): Promise<ProcesoATS[]>;
  buscarPostulante(criterio: { correo: string }): Promise<PostulanteATS | null>;
  crearPostulante(datos: CandidatoCanonico, clave: string): Promise<PostulanteATS>;
  adjuntarCV(idPostulante: string, cv: ArchivoCV, clave: string): Promise<void>;
  crearPostulacion(idPostulante: string, idProceso: string, clave: string): Promise<PostulacionATS>;
  consultarPostulacion(idPostulante: string, idProceso: string): Promise<PostulacionATS | null>;
}
```

| Adaptador | Estado | Comportamiento |
| --- | --- | --- |
| `talentia` | **Simulado**, activo | Traslada el cliente actual de la v2 sin cambiar su comportamiento. Todas las capacidades en `true` |
| `buk` | Deshabilitado | Lee `ATS_URL_BASE` y la API Key de Conexiones. `verificarConexion` responde «no configurado». Los demás métodos lanzan «no implementado: pendiente de la documentación oficial de /apidocs». Capacidades en `false` hasta verificarlas |

**Selección del ambiente:** `ATS_DESTINO=talentia` (por defecto) o `buk`. Si `buk` no está implementado, el Puente no arranca el procesador y lo muestra en `/api/salud`. Así nunca «parece» conectado.

**Si un ATS no permite adjuntar el CV** (riesgo real en BUK, sección 12), el paso `documento_subido` se omite. La recepción se completa con la advertencia «CV no enviado: el ATS no lo admite por API» y el CV queda disponible en el Puente hasta su retención.

**Pruebas de contrato:** un mismo conjunto de pruebas describe lo que `ConectorATS` debe cumplir. Hoy corre contra Talentia. El día que haya API de BUK de pruebas, corre contra ella sin escribir pruebas nuevas.

**Para activar BUK real** (fuera del alcance de la entrega):

1. La empresa entrega la exportación de `/apidocs` y una API Key de pruebas.
2. Se escribe el adaptador contra esa documentación.
3. Pasan las pruebas de contrato.
4. Se cambia `ATS_DESTINO`.

## 10. Puerta 0: verificación en LinkedIn \[V4\]

**Antes de escribir una línea del bot, una persona comprueba a mano en LinkedIn las capacidades de las que depende.** Toma de 1 a 2 horas más la espera de las postulaciones. Fecha límite: 3/11. Ningún programa toca LinkedIn en esta prueba.

**Preparación:**

- Un integrante que acepta el riesgo usa su cuenta para crear la página de empresa del proyecto (nombre honesto, sin la marca de la empresa del reto).
- Publica una vacante gratuita titulada «Vacante de prueba – proyecto académico SENA (no postular)», con postulación en LinkedIn.
- Al publicar, anota todas las opciones de «cómo recibir postulantes» que muestra LinkedIn (captura).
- Entre 3 y 5 integrantes se postulan con postulación rápida y CV ficticios; al menos uno **sin** adjuntar CV.

| # | Se comprueba | Cómo | Evidencia | Si falla |
| --- | --- | --- | --- | --- |
| P0-1 | Se pudo publicar gratis | Publicación aceptada | Captura de la vacante activa | Probar con otra cuenta; si nadie puede, el bot se descarta y el importador se demuestra con CV ficticios |
| P0-2 | El publicador ve la lista de postulantes | Abrir la vacante → postulantes | Captura | Bot descartado |
| P0-3 | El CV adjunto se ve y se descarga uno por uno | Abrir un postulante → descargar | El PDF descargado | Bot e importador desde LinkedIn descartados; queda Apply Connect simulado |
| P0-4 | Se puede exigir el CV, o qué pasa sin él | Mirar las opciones al publicar y el postulante sin CV | Captura | Esos casos van a `REQUIERE_REVISION` |
| P0-5 | Qué datos de contacto aparecen (correo, teléfono) | Detalle del postulante | Captura con los datos tapados | Sin correo: todos van a revisión |
| P0-6 | La URL o la página tiene identificadores estables de vacante y postulación | Copiar URLs y guardar la página con Ctrl+S | Archivos guardados | Usar el id del perfil (decisión registrada) |
| P0-7 | Existe la opción de recibir postulaciones por correo y si el correo trae el CV | Opciones de la vacante y bandeja del publicador | Captura del correo | Se descarta el adaptador de correo |
| P0-8 | Hay exportación o descarga masiva en la vacante gratuita | Menús de la lista de postulantes | Captura | El importador acepta solo PDF |

**Decisión del 3/11:**

- **Bot = sí** si pasan P0-2, P0-3 y P0-6.
- **Importador desde LinkedIn = sí** si pasa P0-3.
- **Adaptador de correo = sí** solo si P0-7 muestra el CV.

El resultado se registra en `docs/decisiones.md` y en la pestaña 5. Las páginas guardadas se anonimizan antes de entrar al repositorio.

## 11. Seguridad y datos personales

**El prototipo trata solo datos de integrantes que consienten, con CV ficticios. Un uso real requiere que la empresa, como responsable, valide las obligaciones de la Ley 1581 de 2012.** No se afirma cumplimiento automático.

| Control | Implementación |
| --- | --- |
| Secretos | API Key del ATS cifrada con AES-256-GCM; tokens de fuente con hash SHA-256 y comparación en tiempo constante; `.env` fuera de git |
| Acceso al panel | Inicio de sesión (Better Auth). Solo administradores crean fuentes, generan tokens, borran datos y cambian `ATS_DESTINO` (verificar roles en F0) |
| Entrada | Límites de tamaño y de frecuencia; solo PDF; protección SSRF en descargas |
| Datos mínimos | Solo los campos del contrato; sin fotos ni perfil completo |
| Retención y supresión | `RETENCION_CV_DIAS` y borrado a pedido; el evento de borrado queda auditado |
| Logs | Sin datos personales; `idRecepcion` para correlacionar |
| Sesión de LinkedIn | Solo en el PC del reclutador, en una cuenta de Windows propia; se borra al cerrar el piloto |
| Páginas guardadas | Las originales fuera de git (`fixtures/linkedin/originales/` en `.gitignore`); se versionan copias anonimizadas |
| Repositorio | Privado; publicación anonimizada sin el nombre de la empresa |

**Obligaciones para un uso real (pendiente legal de la empresa):**

- Autorización previa, expresa e informada del candidato para este tratamiento, con finalidad y aviso de privacidad.
- Atención de los derechos del titular (conocer, actualizar, rectificar y suprimir).
- Contrato de transmisión con el proveedor de servidores en el exterior; la SIC publicó cláusulas modelo en la Circular Externa 003 de 2025. También hay que confirmar si el país está en su lista de nivel adecuado.
- Si la empresa está obligada, la inscripción de la base en el Registro Nacional de Bases de Datos.
- Aprobación de su área legal para cualquier uso del bot, por la cláusula 8.2 de LinkedIn.

*Esto no es asesoría jurídica.*

## 12. Matriz de riesgos

**Los dos riesgos más graves están fuera del control del equipo: que LinkedIn no deje obtener los CV y que BUK no acepte el CV por API.** La V4 no los esconde: los vuelve fechas de decisión y entradas alternativas. Criticidad = probabilidad × impacto (Baja 1, Media 2, Alta 3): **Crítica ≥ 6**, Alta 4, Media 2–3, Baja 1.

| # | Riesgo | P | I | Criticidad | Consecuencia técnica | Mitigación | Plan alternativo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | LinkedIn restringe la cuenta o bloquea el bot (cláusula 8.2) | Media | Alta | **Crítica (6)** | El bot deja de funcionar; puede perderse la cuenta | Cuenta de un integrante que acepta el riesgo; bot lento, con límites y detención; nunca la cuenta de la empresa | Importador y video de la prueba |
| R2 | La vacante gratuita no muestra o no deja descargar los CV | Media | Alta | **Crítica (6)** | No hay datos que llevar desde LinkedIn | Puerta 0 el 3/11, antes de programar | Apply Connect simulado (Vínculo) e importador con CV ficticios |
| R3 | Cambia la interfaz de LinkedIn | Media | Media | Alta (4) | Los selectores fallan; el bot se detiene con «no se encontró el elemento» | Selectores en un archivo; pruebas con páginas guardadas; F4 se ajusta con páginas nuevas | Importador |
| R4 | BUK no permite subir el CV por API o tiene otras rutas | Media | Alta | **Crítica (6)** | El paso `documento_subido` no existe en real | `capacidades.adjuntarCV` en la interfaz; nada de BUK se programa sin `/apidocs` | Completar con advertencia; el CV queda en el Puente |
| R5 | Duplicados (dos corridas, dos fuentes, misma persona) | Alta | Media | **Crítica (6)** | Postulantes repetidos en el ATS | Clave única, reconciliación antes de crear y aviso de posible duplicado | Revisión humana en el panel |
| R6 | Pérdida del CV entre la fuente y el ATS | Baja | Alta | Media (3) | Postulación sin documento | SHA-256 al recibir y después de subir; el binario se borra solo después de completar | Reintento manual |
| R7 | Exposición de datos personales (logs, repositorio, PC) | Baja | Alta | Media (3) | Incidente de datos | Logs sin datos personales, páginas guardadas anonimizadas, retención, CV ficticios en la prueba | Borrado a pedido y registro del evento |
| R8 | Falla la transmisión (Render dormido, red, 5xx) | Alta | Baja | Media (3) | Envíos lentos o repetidos | Reintentos del bot y del Puente; idempotencia; despertar los servicios 15 minutos antes | Demo local con `npm run dev` |
| R9 | Dependencias externas: la base de Render vence el 28/11 y los servicios duermen | Alta | Baja | Media (3) | La demo después del 28/11 no funciona | Fecha anotada; plan pago (\~US$27 al mes) si se mantiene | Demo local |
| R10 | No alcanza el tiempo | Media | Alta | **Crítica (6)** | Entrega incompleta | Fases pequeñas; el bot es lo último y es opcional; código congelado el 9/11 | Presentar F0 a F3 sin bot |
| R11 | La empresa o el jurado rechazan el bot por legalidad | Alta | Media | **Crítica (6)** | El bot no se puede mostrar como solución | Presentarlo como alternativa evaluada; la solución es el Puente | Importador y Apply Connect |
| R12 | Claude Code rompe algo que funcionaba | Media | Media | Alta (4) | Regresiones | F0 de solo lectura; un commit por fase; las 166 pruebas en cada fase | Volver al commit anterior |
| R13 | Los PDF importados no tienen texto (escaneados) | Media | Baja | Media (2) | No se sugieren datos | Estado de revisión | Digitación en el panel |

## 13. MVP: qué entra y qué espera

**El MVP es el Puente independiente de la fuente con dos entradas que funcionan (importador y Apply Connect simulado) y una salida probada (Talentia).** El bot suma si pasa la Puerta 0, pero el MVP no depende de él.

| Clase | Funcionalidades | Dificultad |
| --- | --- | --- |
| **Indispensable** | Contrato canónico y servicio de recepción único (F1) | Media: refactor con riesgo de regresión |
| **Indispensable** | `ConectorATS` con Talentia (F1) | Media |
| **Indispensable** | Entrada genérica, tokens por fuente, correspondencias genéricas, `REQUIERE_REVISION`, eventos y retención (F2) | Media |
| **Indispensable** | Importador con sugerencia de datos y confirmación (F3) | Media: lectura de PDF |
| **Indispensable** | Despliegue en Render y documentación (F5) | Baja |
| **Condicional** | Bot asistido (F4), solo si pasa la Puerta 0 | **Alta:** depende de LinkedIn |
| **Simulado** | Talentia (destino), Vínculo (Apply Connect) | — |
| **Esqueleto, sin conexión real** | Adaptador de BUK deshabilitado | Baja |
| **Necesita validación externa** | BUK real (`/apidocs` y API Key), uso del bot con la cuenta de la empresa, política de datos, exportación de Recruiter | — |
| **Puede esperar** | Adaptador de correo, modo programado, extracción con IA, varios reclutadores con sesiones distintas, alta disponibilidad | — |

## 14. Plan de implementación \[V4\]

**El orden protege la entrega: primero lo que siempre funciona (núcleo, entrada genérica, importador), después lo que depende de LinkedIn (bot), y el código se congela el 9/11.** La Puerta 0 corre en paralelo con F0 y F1, así que no frena nada.

| Fase o hito | Fechas (nov 2026) |
| --- | --- |
| Puerta 0 en LinkedIn (equipo) | 2 a 3 |
| **Decisión: ¿se construye el bot?** | **3** |
| F0 auditoría y F1 núcleo | 2 a 3 |
| F2 entrada genérica | 4 |
| F3 importador | 5 |
| F4 bot (si pasa la Puerta 0) | 6 a 7 |
| F5 prueba, despliegue, video | 8 |
| Decisión: ¿bot en la demo? | 8 |
| Código congelado | 9 |
| Documentos y capturas | 9 a 10 |
| Ensayo de la demo | 11 a 12 |
| Entrega y sustentación | 13 |

| Fase | Quién | Depende de | Sale cuando |
| --- | --- | --- | --- |
| Puerta 0 | Equipo, de 2 a 3 h | — | P0-1 a P0-8 respondidos con evidencia; decisión registrada el 3/11 |
| F0 Auditoría del código | Claude Code, \~0,5 h, solo lectura | — | Informe de brechas frente a la V4 revisado por el equipo |
| F1 Núcleo y salida | Claude Code, de 3 a 4 h | F0 | Canónica, `registrarRecepcion()` y `ConectorATS` con Talentia; Vínculo pasa por la canónica; las 166 pruebas en verde |
| F2 Entrada genérica | Claude Code, de 3 a 4 h | F1 | Endpoint, fuentes y tokens, correspondencias genéricas, `REQUIERE_REVISION`, posible duplicado, eventos, retención y pruebas |
| F3 Importador | Claude Code, de 3 a 4 h | F2 | Importar 3 PDF ficticios llega a Talentia; reimportar da `DUPLICADA` |
| F4 Bot | Claude Code, de 4 a 6 h | F2 y Puerta 0 = sí | Pruebas con páginas guardadas anonimizadas; recorrido local de punta a punta |
| F5 Prueba real y despliegue | Equipo + Claude Code, de 2 a 3 h | F3 (y F4 si aplica) | Prueba real grabada, Render actualizado, `/api/salud` en verde |
| Documentos y ensayo | Equipo | F5 | Word de entrega con la V4, capturas, dos ensayos cronometrados |

**Si F4 no termina el 7/11,** el 8/11 se decide sin bot y la demo usa el importador y Apply Connect simulado. El bot se presenta como alternativa evaluada.

## 15. Uso del sistema, demostración y plan B

### 15.1 Configuración inicial (una vez)

1. Talentia: crear la API Key con Lectura y Modificación; en el Puente → Conexiones, pegarla y «Guardar y probar» (ya hecho en Render).
2. Puente → Fuentes: crear `importador` y `linkedin-bot` (si aplica) y copiar el token del bot.
3. Puente → Correspondencias: vincular cada vacante externa con su proceso del ATS.
4. Bot (si aplica): `.env` con `PUENTE_URL` y `PUENTE_BOT_TOKEN`; `npm run bot:login -w apps/bot-linkedin` e iniciar sesión a mano.

### 15.2 Día a día

- **Con el importador:** descargar los CV de la vacante, Importar → elegir proceso → arrastrar → revisar la tabla → confirmar.
- **Con el bot:** `npm run bot -w apps/bot-linkedin`; el bot muestra la vacante, cuántos encontró y cuántos envió.
- **Siempre:** Puente → Operaciones para ver estados y resolver «requiere revisión»; Talentia → Postulantes del proceso.

| Mensaje | Qué hacer |
| --- | --- |
| «Se requiere intervención humana» (bot) | Resolver la verificación en la ventana y volver a ejecutar |
| «Sesión cerrada» (bot) | `bot:login` |
| «No se encontró el elemento» (bot) | LinkedIn cambió: guardar la página, anonimizarla y pasar el prompt F4 en modo ajuste; mientras tanto, importador |
| 422 «vacante sin correspondencia» | Vincularla en Correspondencias |
| «Requiere revisión» | Completar correo o CV, o descartar |
| `/api/salud` muestra «ATS no configurado» | `ATS_DESTINO` apunta a un adaptador sin implementar |

### 15.3 Guion de la demo (unos 5 minutos)

1. **Problema** (30 s): descargar y digitar CV por vacante; sin API de LinkedIn ni llave de BUK.
2. **Arquitectura** (30 s): el diagrama de capas; «el producto es el Puente».
3. **Importador** (1 min): tres CV ficticios descargados de la vacante de prueba → confirmar → aparecen en Postulantes de Talentia.
4. **Bot** (1 min, si pasó la Puerta 0): `npm run bot` con ventana visible → envía → Talentia. Volver a ejecutar: no duplica.
5. **Apply Connect simulado** (45 s): postular en Vínculo → llega solo. «Así sería la integración oficial».
6. **Confiabilidad** (45 s): panel con estados, un posible duplicado en revisión, métricas por fuente.
7. **Honestidad** (30 s): qué es simulado (Talentia, Vínculo), qué es experimental (bot) y qué falta para BUK real.

**Mensaje central:** «No construimos un truco para LinkedIn: construimos un Puente que recibe postulaciones de cualquier fuente y las registra en el ATS de forma confiable. Hoy lo alimentan un importador legal y, de forma experimental, un bot. Mañana lo alimenta la integración oficial sin reconstruir nada. Talentia simula BUK porque no tenemos su llave; el adaptador real se activa con su documentación.»

### 15.4 Plan B

| Si pasa | Se hace |
| --- | --- |
| La Puerta 0 falla | Demo sin bot: importador, Apply Connect simulado y el bot presentado como alternativa evaluada y descartada, con su motivo |
| LinkedIn pide verificación en vivo | El bot se detiene (muestra la salvaguarda); se pasa al video grabado |
| Render no despierta | Demo local con `npm run dev` |
| Algo falla en vivo | Video de la prueba completa, grabado el 8/11 con la fecha visible |

## 16. Recursos, costos y fuentes

**Hasta el 13/11 el costo es US$0. Lo único nuevo que hace falta es una cuenta de LinkedIn de un integrante con página de empresa y una vacante gratuita.**

| Recurso | Estado |
| --- | --- |
| Repositorio privado `puente-postulaciones-sena` (rama `v2`), GitHub CLI y Render CLI | Listo |
| Render: tres servicios y Postgres gratuitos (la base vence el 28/11/2026) | Listo |
| Claude Code en modo Auto, Node.js 24, PostgreSQL local y Playwright | Listo |
| Cuenta de LinkedIn de un integrante, página de empresa y vacante de prueba | Falta (Puerta 0) |
| 3 a 5 postulaciones con CV ficticios | Falta |
| Grabador de pantalla (Xbox Game Bar u OBS) | Listo en Windows |
| Librería para leer texto de PDF en el importador (la elige Claude Code en F3 y la registra como decisión) | Falta, gratuita |

| Costo | Hasta el 13/11 | Después, si se mantiene |
| --- | --- | --- |
| Render | US$0 | Unos US$27 al mes (3 servicios de US$7 y Postgres de US$6) |
| LinkedIn | US$0 (vacante gratuita) | Recruiter, solo si la empresa quiere su exportación |
| Bot, importador y Puente | US$0 | US$0 |

**Tiempo estimado:** Claude Code, de 14 a 22 horas en seis fases. El equipo, de 6 a 9 horas: Puerta 0 de 2 a 3 h, revisión de reportes 1 h, prueba real 1 h, documentos y ensayo de 2 a 4 h.

**Fuentes** (consultadas entre el 25/10 y el 1/11/2026):

- [Microsoft Learn: acceso a las API de LinkedIn](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access) y [Apply Connect](https://learn.microsoft.com/en-us/linkedin/talent/apply-connect)
- [ConnectSafely: Acuerdo de Usuario de LinkedIn, 8.2](https://connectsafely.ai/articles/is-linkedin-automation-safe-tos-scraping-guide-2026) (20/07/2026) y [LinkedIn: Prohibited software and extensions](https://www.linkedin.com/help/linkedin/answer/a1341387)
- [LinkedIn: Applicant options for your job post](https://www.linkedin.com/help/linkedin/answer/a517570) y [Reviewing job applicants](https://www.linkedin.com/help/linkedin/answer/a517574) (solo títulos; bloqueadas a lectura automática)
- [Jobscan: Easy Apply para empleadores](https://www.jobscan.co/blog/linkedin-easy-apply-employers/) (07/08/2023)
- [Reczee: Easy Apply para reclutadores](https://www.reczee.com/blog/linkedin-easy-apply-for-recruiters) (29/05/2025) y [ApplicantSync](https://www.applicantsync.com/articles/how-to-see-applicants-on-linkedin-job) (vendedores de exportadores)
- [ExportMyResume: aviso de CV descargado](https://www.exportmyresume.com/blog/linkedin-resume-downloaded-notification/) (04/10/2026)
- [Comunidad de LinkedIn: exportar postulantes a XLSX en Recruiter](https://tcommunity.linkedin.com/product-tips-190/bulk-export-job-applicants-into-an-xlsx-file-1458) (15/04/2025)
- [100Hires: publicar empleo en LinkedIn en 2026](https://100hires.com/how-to-post-a-job-on-linkedin.html)
- [BUK: integración del módulo de Selección por API](https://supportcenter.buk.co/hc/es-419/articles/49474572553755-Integraci%C3%B3n-del-m%C3%B3dulo-de-Selecci%C3%B3n-por-API) y [APIs.io: catálogo de la API de BUK](https://apis.io/apis/buk/buk-application-api/) (terceros; solo indicio)
- [SIC: Circular Externa 003 de 2025, cláusulas modelo](https://sedeelectronica.sic.gov.co/sites/default/files/normativa/Circular%20Externa%20003%20de%202025.pdf) y [BUK: transferencia internacional de datos en Colombia](https://www.buk.co/blog/transferencia-internacional-datos-personales-colombia) (31/08/2026)
- [Render: precios](https://render.com/pricing) y [plan gratuito](https://render.com/docs/free)

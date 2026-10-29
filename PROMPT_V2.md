# Prompts para Claude Code — versión 2

Se usan tres prompts:
1. **PROMPT PRINCIPAL**: construye todo (fases F0 a F7) en modo autónomo.
2. **PROMPT DESPLIEGUE**: después de que hagas el único clic en Render («New → Blueprint»).
3. **RETOMAR**: si la sesión se corta.


## 1. PROMPT PRINCIPAL

```text
Trabajas en la carpeta talent-bridge-v2, en la rama v2 (un git worktree de talent-bridge). Aquí está la v1 que funciona; vas a convertirla en la v2.

LEE PRIMERO, COMPLETOS: docs/v2/SOLUCION.md (el qué y el por qué), docs/v2/ESPECIFICACION.md (el cómo, criterios de aceptación y documentación), CLAUDE.md, docs/estado.md, docs/decisiones.md, docs/contratos.md, docs/referencia-ats.md y la ficha en docs/ficha/. Los documentos de docs/v2/ son del equipo: no los reescribas; si algo de ellos no se puede cumplir, regístralo en docs/decisiones.md con el motivo y la alternativa.

MODO AUTÓNOMO. Ejecuta las fases F0 a F7 en orden, sin detenerte a pedirme aprobación. Toma tú las decisiones reversibles y regístralas en docs/decisiones.md (desde D-20: fecha, decisión, alternativa descartada, motivo). Si algo depende de mí o de un tercero, márcalo PENDIENTE en docs/estado.md y sigue con la alternativa.

PUERTA DE CALIDAD AL CERRAR CADA FASE: typecheck, lint, pruebas unitarias e integración (PostgreSQL real) y las E2E que correspondan, más build de las apps afectadas. Si algo falla, corrígelo antes de avanzar. Nunca desactives ni debilites pruebas. Luego: actualiza docs/estado.md (qué se hizo, comandos con su resultado real, pendientes, riesgos) y haz commit "v2 FX: <resumen>". No hagas push hasta F7.

FASES
F0 · Monorepo. Reorganiza en npm workspaces: apps/vinculo (sale del origen de v1), apps/talentia (sale del ATS de v1), apps/puente (sale del puente de v1 con su worker). Cada app con su package.json, su prisma/schema.prisma, sus migraciones, su cliente generado propio y su esquema (vinculo, talentia, puente). PostgreSQL local del proyecto en el puerto 5435 (la v1 usa 5433 y puede estar encendida: no la toques). Puertos 3001, 3002, 3003. npm run setup y npm run dev levantan todo. Prohibido importar código de dominio entre apps; si hoy se comparte, duplícalo en cada app o muévelo a packages/ solo si no es dominio. Puerta: las pruebas de v1 (adaptadas a la nueva estructura) siguen pasando y el recorrido v1 sigue funcionando.

F1 · Talentia completo según ESPECIFICACION §3: autenticación con roles, pantallas, 9 etapas, vista columna y tabla, mover tarjetas, ficha del postulante, API Keys con permisos, registro de actividad, /apidocs, API v1 con límites, errores uniformes e Idempotency-Key. Investiga el encabezado de la API Key de BUK en su centro de ayuda público; si no se verifica, usa auth_token y márcalo Supuesto. Puerta: criterios 2 y 3.

F2 · Vínculo completo según ESPECIFICACION §2: autenticación por rol, perfiles, buscador, detalle, «Solicitud sencilla», mis postulaciones con estados, páginas de empresa, panel del reclutador, integraciones, portal de desarrolladores, documentación, API (token, jobPostings, validación de webhook, entrega firmada con outbox y reintentos, mediaUrl con token, lifecycle). Puerta: criterio 4 y pruebas de contrato contra docs/contratos.md.

F3 · Puente según ESPECIFICACION §4: conectores HTTP nuevos hacia las APIs de F1 y F2, secretos cifrados, /conexiones con asistente y «Probar conexión», /procesos con «Publicar en Vínculo», correspondencias, operaciones, rechazos, métricas, pruebas (solo con PUENTE_MODO_PRUEBAS=1), aviso RESUME_DOWNLOADED, manejo de 401/429/arranque en frío. Puerta: criterios 1, 5 a 13, con una E2E que recorre los tres sistemas configurando las conexiones por la interfaz.

F4 · Datos de demostración y realismo según ESPECIFICACION §5: generadores de perfiles, empresas, vacantes y CV PDF ficticios de aspecto profesional; demo:reset por app; script demo:conectar. Pulido visual: tres identidades propias claramente distintas, estados de carga, vacío y error, aviso «Entorno de simulación», móvil y teclado. Revisa a mano (capturas con Playwright) cada pantalla principal y corrige lo que se vea mal. Puerta: criterio 14.

F5 · Documentación según ESPECIFICACION §8, toda contra el estado real del código. Actualiza CLAUDE.md (reglas del equipo + comandos reales + arquitectura v2). Actualiza docs/uso-ia.md.

F6 · Auditoría final: revisa el código buscando duplicados posibles, falsos "completado", fugas de secretos o datos personales en logs y respuestas, SSRF, rutas sin autorización, cookies compartidas entre apps. Ejecuta todo dos veces seguidas para detectar pruebas inestables. Haz una instalación limpia en una carpeta temporal siguiendo solo el README. Puerta: criterio 15 (parte local) y todo en verde.

F7 · Preparar despliegue en Render (plan gratuito) según ESPECIFICACION §6: render.yaml, scripts de arranque con migración y siembra idempotentes, workers dentro del proceso web, tiempos de espera para arranques en frío. Ejecuta `render blueprints validate`. Luego:
  1. Verifica que .gitignore excluye .env, .pgdata, docs/ficha y cualquier secreto, y que el nombre de la empresa retadora no aparece en ningún archivo versionado (busca también en docs). Si aparece, corrígelo.
  2. Crea un repositorio PRIVADO en GitHub llamado puente-postulaciones-sena con `gh repo create puente-postulaciones-sena --private --source . --remote origin` y haz push de la rama v2 (`git push -u origin v2`). Esta es la única ubicación remota autorizada.
  3. Intenta crear el despliegue sin mi intervención con el Render CLI (ya inicié sesión con `render login`): si el CLI o la API de Render permiten crear la Blueprint, la base gratuita y los servicios gratuitos desde render.yaml, hazlo. Si no es posible, NO busques atajos: escribe en docs/despliegue.md y en tu reporte final las instrucciones exactas del único paso manual (Render → New → Blueprint → elegir el repo puente-postulaciones-sena, rama v2 → Deploy Blueprint).

NUNCA: usar servicios reales de LinkedIn o BUK; scraping; datos o nombres reales; el nombre de la empresa retadora fuera de docs/ficha; secretos en el repositorio; borrar archivos fuera de esta carpeta; tocar la carpeta talent-bridge (v1) salvo leerla; push a otro repositorio distinto de puente-postulaciones-sena.

Si la sesión se corta o el contexto se llena, debe quedar commit hecho y docs/estado.md al día.

REPORTE FINAL (en el chat):
- Qué funciona y cómo lo compruebo yo localmente (comandos exactos y cuentas de demostración).
- Tabla de los 15 criterios de aceptación: cumple / no cumple y por qué, con la prueba que lo verifica.
- Pruebas ejecutadas y resultados; lo que no se pudo ejecutar.
- Estado del despliegue y, si falta, el paso manual exacto.
- Pendientes que dependen del equipo o de la empresa.
```

---

## 2. PROMPT DESPLIEGUE (después del clic en Render, o si F7 ya desplegó)

```text
Lee docs/estado.md y docs/despliegue.md. El Blueprint de Render ya está creado. Con el Render CLI:
1. Verifica que existen los 3 servicios web gratuitos y la base gratuita (`render services -o json`), y espera a que los despliegues terminen (`render deploys list` / `--wait`). Si alguno falla, lee sus logs, corrige el código o el render.yaml, haz commit y push a v2 y repite hasta que los 3 estén vivos.
2. Obtén las 3 URLs públicas y ejecuta contra ellas una prueba de humo con Playwright: login en cada sistema, configurar las conexiones del puente por la interfaz (o con demo:conectar apuntando a las URLs públicas), publicar un proceso en Vínculo, postular con un candidato de demo y verificar la tarjeta en Postulantes de Talentia y el SHA-256 del CV. Ten en cuenta el arranque en frío (~1 min por servicio).
3. Escribe las URLs, las cuentas de demostración y el resultado de la prueba de humo en docs/despliegue.md y docs/resultados-pruebas.md, actualiza docs/estado.md, commit y push.
Reporta: las 3 URLs, qué pasó en la prueba de humo y cualquier pendiente.
```

---

## 3. RETOMAR

```text
Lee CLAUDE.md, docs/v2/ESPECIFICACION.md y docs/estado.md. Verifica con pruebas el estado real antes de asumir nada (git log, typecheck, pruebas). Retoma la primera fase pendiente del PROMPT PRINCIPAL en modo autónomo, sin rehacer lo que funciona. Para cada fallo: reprodúcelo, escribe una prueba que lo detecte, corrige lo mínimo y ejecuta las regresiones. Sigue hasta terminar F7 y entrega el REPORTE FINAL.
```

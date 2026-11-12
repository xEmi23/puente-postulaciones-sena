# 15. Lecciones aprendidas

> Sacadas de lo que consta en el repositorio (decisiones, reportes de fase, auditorías y la verificación final). Las lecciones personales de cada integrante: **PENDIENTE**.

| # | Lección | De dónde sale |
|---|---|---|
| 1 | **Verificar antes de programar.** Lo que no se puede comprobar (rutas de BUK, qué deja ver LinkedIn) no se escribe en código: se deja como supuesto o como adaptador deshabilitado | Principio 4 de ESPECIFICACION_V4; adaptador de BUK vacío; Puerta 0 |
| 2 | **Separar el producto de sus fuentes.** Cambiar de fuente tres veces (Apply Connect → bot → formulario) costó poco porque el núcleo no conoce la fuente | V4 (D-52 a D-56); D-75 |
| 3 | **Un acuse no es una transferencia.** Medir en el ATS y no en la respuesta del Puente evitó dar por registrado lo que no lo estaba | Regla de CLAUDE.md; medición del 11/11 |
| 4 | **La legalidad decide la arquitectura.** El bot funcionaba en el simulador y aun así se descartó por los términos de LinkedIn | D-75; [03](03_metodologia.md) §3.6 |
| 5 | **Las pruebas encuentran lo que la revisión no.** Varios defectos aparecieron solo al probar (zona horaria, `--seco` en PowerShell, mensajes en inglés, aviso innecesario) | D-10, D-72, commits `e7a9871` y `ffcafcf` |
| 6 | **Medir con cuidado también es parte del trabajo.** Una corrida de medición se descartó por un error del propio script | [medicion/RESULTADO.md](medicion/RESULTADO.md) |
| 7 | **Los límites del entorno importan.** El plan gratuito de Render se duerme, el ATS limita a 120 peticiones por minuto y el modo desarrollo puede fallar donde la versión compilada no | [06](06_pruebas_y_resultados.md) §6.8 |
| 8 | **Documentar lo que no se sabe.** Distinguir «verificado», «supuesto» y «pendiente» evitó presentar como hecho lo que solo se entendió de oídas | Etiquetas de todos los documentos; reescrituras del 12/11 |
| 9 | **La IA acelera, pero necesita dirección.** Las fases cortas con criterios verificables y un reporte por fase permitieron dirigir el trabajo de la IA | [08](08_uso_de_ia.md) |
| 10 | **Dejar evidencia a tiempo.** Faltan capturas de conversaciones, acta y línea base porque no se guardaron cuando ocurrieron | [EVIDENCIA_PENDIENTE.md](EVIDENCIA_PENDIENTE.md) |

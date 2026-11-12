# 10. Trabajo futuro

> En orden de prioridad para que la empresa retadora pueda usarlo. Cada paso dice de qué depende.

| # | Paso | Depende de | Esfuerzo estimado |
|---|---|---|---|
| 1 | **Adaptador de BUK real**: implementar `apps/puente/src/salidas/buk/index.ts` (verificar conexión, buscar/crear postulante, adjuntar CV, crear postulación, consultar) con el `/apidocs` de la cuenta; poner `ATS_DESTINO=buk` | Llave de la API con permisos de Lectura y Modificación, entorno de pruebas, gestor acompañante | 2–4 días con pruebas de contrato |
| 2 | **Validación legal** del aviso de privacidad; responsable identificado; `PRIVACIDAD_CORREO` real; contrato de transmisión si el servidor está fuera de Colombia | Área legal de la empresa | — |
| 3 | **Piloto con una vacante real**: oferta en LinkedIn con enlace externo al formulario; medir tasa de postulación y tiempo ahorrado contra la línea base | Cuenta de LinkedIn de la empresa verificada; línea base de horas | 2 semanas |
| 4 | Despliegue en infraestructura de la empresa (o plan pago) con base persistente, copias de seguridad y dominio propio | TI de la empresa | 1–2 días |
| 5 | Límites anti-abuso en PostgreSQL (varias instancias) y verificación del encabezado de IP confiable del proxy | Paso 4 | 0,5 días |
| 6 | Notificaciones: correo al candidato con su referencia; alerta al operador cuando algo queda en revisión o falla | Servicio de correo de la empresa | 1 día |
| 7 | Accesibilidad y textos revisados con usuarios reales (candidatos y reclutadores) | Prueba con usuarios | — |
| 8 | Importador: aceptar la exportación XLSX de LinkedIn Recruiter si la empresa tiene esa licencia | Licencia Recruiter | 1 día |
| 9 | Apply Connect oficial (la «vía oficial futura», hoy demostrada con el Simulador LinkedIn) si BUK lo ofrece y la empresa lo activa | BUK y LinkedIn | Depende del fabricante |

**Lo que no se recomienda:** retomar el bot sobre LinkedIn real (D-75) ni agregar IA al traslado (el valor está en que sea determinista y auditable).

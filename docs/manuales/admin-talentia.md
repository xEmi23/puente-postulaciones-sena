# Manual · Administrador/a de Talentia

Todo lo del reclutador ([reclutador-talentia.md](reclutador-talentia.md)) más **Administración**:

- **API Keys** (`/admin/api-keys`): «Nueva API Key» con nombre y permisos del módulo Selección: **Lectura** (GET) y **Modificación** (POST y PATCH). El puente necesita ambos. La llave **se muestra una sola vez**; en la lista solo queda su prefijo (`tal_xxxxxxxx…`), quién la creó y su último uso. **Revocar** la anula de inmediato: las llamadas responden 401 y el puente se detiene con un mensaje claro.
- **Actividad de la API** (`/admin/actividad-api`): cada llamada con llave, ruta, código de respuesta y hora. Sirve para ver cuándo entró una postulación y si hubo 401, 403 o 429.
- **Documentación de la API** (`/apidocs`): contrato del simulador (rutas de Selección, encabezado `auth_token` marcado como Supuesto pendiente, límite de 120 solicitudes por minuto, `Idempotency-Key`).

Para conectar el puente: crea la llave con Lectura y Modificación, cópiala y pégala en el Puente → «Conexiones» → Talentia.

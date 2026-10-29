# Manual · Desarrollador/a (portal de Vínculo)

Portal: `/developers`. Documentación interactiva (OpenAPI 3.1): `/developers/docs`. Es un **contrato del simulador modelado sobre Apply Connect**, no la API de LinkedIn (docs/contratos.md §5).

1. **Crear aplicación:** nombre y (opcional) URL del webhook. El **Client Secret se muestra una sola vez**: cópialo. Puedes regenerarlo (invalida el anterior y sus tokens) o revocar la aplicación.
2. **Pedir autorización:** la empresa la autoriza en «Integraciones» con tu Client ID.
3. **Token:** `POST /oauth/v2/accessToken` con `grant_type=client_credentials`, `client_id` y `client_secret` → `access_token` (3600 s).
4. **Webhook:** regístralo en la página de la aplicación («Guardar y validar»). Vínculo hace `GET ?challengeCode=` y espera `challengeResponse = hex(HMAC-SHA256(challengeCode, clientSecret))`.
5. **Publicar vacantes:** `POST /api/v1/jobPostings` con `externalJobId`, `companyId` (de `GET /api/v1/autorizaciones`), título, descripción, ubicación y `onsiteApply.jobApplicationWebhookUrl`. Cerrar: `POST /api/v1/jobPostings/{externalJobId}/close`.
6. **Recibir solicitudes:** `POST` a tu webhook con `X-LI-Signature = hex(HMAC-SHA256("hmacsha256=" + cuerpo, clientSecret))`. Responde 200 para aceptar; con otro código Vínculo reintenta hasta 6 veces (unos 15 minutos).
7. **Descargar el CV:** `GET mediaUrl` con `Authorization: Bearer <token>` (vale 30 días; solo para tu aplicación).
8. **Informar el avance:** `POST /api/v1/jobApplications/{id}/lifecycle` con `VIEWED`, `RESUME_DOWNLOADED` o `REJECTED`.

En la página de la aplicación verás las entregas con su resultado, «Reenviar evento» y una **consola de pruebas** que manda casos inválidos (firma mala, falta el correo, vacante sin proceso…) a tu webhook.

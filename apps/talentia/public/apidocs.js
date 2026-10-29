// Inicializa Swagger UI en /apidocs con el documento OpenAPI de Talentia. «Authorize» pide la API Key (encabezado auth_token).
(function iniciar() {
  if (!window.SwaggerUIBundle || !document.getElementById("swagger")) return setTimeout(iniciar, 50);
  window.SwaggerUIBundle({ url: "/api/openapi.json", dom_id: "#swagger", deepLinking: true, tryItOutEnabled: true, defaultModelsExpandDepth: 0 });
})();

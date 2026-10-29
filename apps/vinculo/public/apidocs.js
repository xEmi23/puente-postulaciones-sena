// Inicializa Swagger UI con el documento OpenAPI de esta app. «Authorize» permite probar con las credenciales.
// Sin deepLinking (sus enlaces quedaban dentro de botones) y con nombre accesible para el selector de servidor.
(function iniciar() {
  if (!window.SwaggerUIBundle || !document.getElementById("swagger")) return setTimeout(iniciar, 50);
  window.SwaggerUIBundle({
    url: "/api/openapi.json",
    dom_id: "#swagger",
    deepLinking: false,
    tryItOutEnabled: true,
    defaultModelsExpandDepth: 0,
    onComplete: function () {
      var servidores = document.getElementById("servers");
      if (servidores) servidores.setAttribute("aria-label", "Servidor de la API");
    },
  });
})();

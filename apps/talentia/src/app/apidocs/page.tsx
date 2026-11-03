import Script from "next/script";
import "swagger-ui-dist/swagger-ui.css";
import "./swagger-accesible.css";
import "../talentia.css";

export const metadata = { title: "Documentación de la API" };

// Documentación interactiva pública (Swagger UI sobre /api/openapi.json). «Authorize» permite probar con una API Key.
export default function ApiDocs() {
  return (
    <main id="contenido" className="t-apidocs">
      <header className="t-apidocs-cabecera">
        <p className="t-ingreso-marca">
          <span className="a-marca-logo" aria-hidden="true">
            T
          </span>{" "}
          Simulador BUK · API v1
        </p>
        <h1>Documentación de la API del Simulador BUK</h1>
        <p>
          Contrato del simulador (no es la API oficial de BUK). Autenticación con la API Key en el encabezado <code>auth_token</code>; crea una en{" "}
          <a href="/admin/api-keys">Administración → API Keys</a>. Límite: 120 solicitudes por minuto por llave. Documento:{" "}
          <a href="/api/openapi.json">/api/openapi.json</a>.
        </p>
      </header>
      <div id="swagger" data-testid="swagger" />
      <Script src="/vendor/swagger-ui/swagger-ui-bundle.js" strategy="afterInteractive" />
      <Script src="/apidocs.js" strategy="afterInteractive" />
    </main>
  );
}

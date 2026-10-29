import Script from "next/script";
import Link from "next/link";
import "swagger-ui-dist/swagger-ui.css";
import "./swagger-accesible.css";

export const metadata = { title: "Documentación de la API" };

// Documentación pública (Swagger UI sobre /api/openapi.json): token, vacantes, CV, ciclo de vida y los webhooks.
export default function DocsApi() {
  return (
    <>
      <h1>Documentación de la API de Vínculo</h1>
      <p className="v-subtitulo">
        Modelada sobre Apply Connect de LinkedIn (formato de la entrega, firma, desafío y descarga del CV, según su documentación pública). Las rutas
        propias del simulador están marcadas así. Documento: <a href="/api/openapi.json">/api/openapi.json</a> · <Link href="/developers">Mis aplicaciones</Link>.
      </p>
      <div className="v-tarjeta" style={{ padding: 0, overflow: "hidden" }}>
        <div id="swagger" data-testid="swagger" />
      </div>
      <Script src="/vendor/swagger-ui/swagger-ui-bundle.js" strategy="afterInteractive" />
      <Script src="/apidocs.js" strategy="afterInteractive" />
    </>
  );
}

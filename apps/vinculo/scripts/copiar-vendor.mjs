// Copia Swagger UI desde node_modules a public/vendor (ignorado por git) para servir /apidocs sin CDN externos.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const origen = path.dirname(require.resolve("swagger-ui-dist/package.json"));
const destino = path.resolve(import.meta.dirname, "../public/vendor/swagger-ui");
mkdirSync(destino, { recursive: true });
for (const f of ["swagger-ui-bundle.js"]) copyFileSync(path.join(origen, f), path.join(destino, f));
console.log("Swagger UI copiado a public/vendor/swagger-ui.");

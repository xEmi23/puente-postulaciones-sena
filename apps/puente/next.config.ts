import path from "node:path";
import type { NextConfig } from "next";

// Monorepo con npm workspaces: las dependencias viven en la raíz.
const raiz = path.resolve(process.cwd(), "../..");

const nextConfig: NextConfig = {
  // El CV puede pesar hasta CV_MAX_BYTES (5 MB); el límite del Server Action queda por encima
  // para que el rechazo lo haga nuestra validación con un mensaje claro.
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
  },
  // unpdf (lector de PDF del importador) se carga desde node_modules, sin empaquetar.
  serverExternalPackages: ["pg", "unpdf"],
  poweredByHeader: false,
  // La portada es la lista de operaciones. Redirección HTTP (no en la página) para que no ocurra en pleno streaming.
  redirects: async () => [{ source: "/", destination: "/operaciones", permanent: false }],
  // Evita que `next dev` genere AGENTS.md en el repositorio.
  agentRules: false,
  turbopack: { root: raiz },
  outputFileTracingRoot: raiz,
};

export default nextConfig;

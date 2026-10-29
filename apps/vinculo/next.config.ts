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
  serverExternalPackages: ["pg"],
  poweredByHeader: false,
  // Evita que `next dev` genere AGENTS.md en el repositorio.
  agentRules: false,
  turbopack: { root: raiz },
  outputFileTracingRoot: raiz,
};

export default nextConfig;

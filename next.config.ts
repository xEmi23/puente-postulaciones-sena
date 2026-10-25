import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El CV puede pesar hasta CV_MAX_BYTES (5 MB); el límite del Server Action queda por encima
  // para que el rechazo lo haga nuestra validación con un mensaje claro.
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
  },
  serverExternalPackages: ["pg"],
  poweredByHeader: false,
};

export default nextConfig;

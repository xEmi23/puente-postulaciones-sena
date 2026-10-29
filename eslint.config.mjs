import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  { settings: { next: { rootDir: ["apps/vinculo/", "apps/talentia/", "apps/puente/"] } } },
  globalIgnores([
    "**/.next/**",
    "apps/*/src/generated/**",
    "apps/*/public/vendor/**",
    ".pgdata/**",
    ".instalacion-limpia/**",
    "playwright-report/**",
    "test-results/**",
    "**/next-env.d.ts",
  ]),
]);

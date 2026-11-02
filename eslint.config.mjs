import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  { settings: { next: { rootDir: ["apps/vinculo/", "apps/talentia/", "apps/puente/"] } } },
  // V4 (F1-6): el núcleo del Puente solo habla con el ATS por la interfaz ConectorATS (apps/puente/src/salidas).
  // Fuera de src/salidas nadie importa un adaptador concreto (Talentia o BUK).
  {
    files: ["apps/puente/**/*.{ts,tsx}"],
    ignores: ["apps/puente/src/salidas/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/salidas/talentia", "@/salidas/talentia/*", "**/salidas/talentia", "**/salidas/talentia/*", "@/salidas/buk", "@/salidas/buk/*", "**/salidas/buk", "**/salidas/buk/*"],
              message: "Usa conectorATS() de @/salidas: el núcleo no conoce el ATS concreto (ESPECIFICACION_V4 §9).",
            },
          ],
        },
      ],
    },
  },
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

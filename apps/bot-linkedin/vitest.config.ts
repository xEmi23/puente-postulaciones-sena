import { defineConfig } from "vitest/config";

// Pruebas del bot sin navegador ni red: extracción y guardias sobre HTML guardado, mapeo, envío con fetch doble,
// límites y pausas con reloj simulado. El recorrido real contra Vínculo está en e2e/bot.spec.ts.
export default defineConfig({
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});

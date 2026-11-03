import base from "./playwright.render.config";

// Prueba de humo del formulario público contra Render (e2e/humo-formulario-render.spec.ts). No reconfigura conexiones.
//   RENDER_HUMO=1 npx playwright test -c playwright.render-formulario.config.ts
const config = { ...base, testMatch: "humo-formulario-render.spec.ts" };
export default config;

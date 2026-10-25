import { config as cargarEnv } from "dotenv";

// Variables de entorno de las pruebas de Vitest: base aislada y hosts ficticios que se resuelven
// en proceso (tests/http-en-proceso.ts). No hay red: el origen, el puente y el ATS son los route handlers reales.
export function prepararEntornoPruebas() {
  cargarEnv({ quiet: true });
  const urlPruebas = process.env.DATABASE_URL_TEST;
  if (!urlPruebas) throw new Error("Falta DATABASE_URL_TEST en .env");
  if (!new URL(urlPruebas).pathname.endsWith("_test")) throw new Error("DATABASE_URL_TEST debe apuntar a una base *_test");
  Object.assign(process.env, {
    DATABASE_URL: urlPruebas,
    APP_BASE_URL: "http://app.test",
    ORIGEN_BASE_URL: "http://app.test",
    PUENTE_WEBHOOK_URL: "http://app.test/api/puente/webhook",
    ATS_BASE_URL: "http://app.test/api/ats/v1",
    SIMULADOR_MODO_PRUEBA: "true",
    CV_MAX_BYTES: "1048576",
  });
}

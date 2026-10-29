import { config as cargarEnv } from "dotenv";

// Variables de entorno de las pruebas del puente: base aislada (tb2_test, esquema puente) y hosts ficticios.
// No hay red: el webhook del puente se llama en proceso y Vínculo y Talentia son dobles que cumplen su contrato HTTP.
// Las conexiones con Vínculo y Talentia se guardan en la base (como en /conexiones) en tests/utilidades.ts.
export function prepararEntornoPruebas() {
  cargarEnv({ quiet: true });
  const urlPruebas = process.env.DATABASE_URL_TEST;
  if (!urlPruebas) throw new Error("Falta DATABASE_URL_TEST en .env");
  if (!new URL(urlPruebas).pathname.endsWith("_test")) throw new Error("DATABASE_URL_TEST debe apuntar a una base *_test");
  Object.assign(process.env, {
    DATABASE_URL: urlPruebas,
    APP_BASE_URL: "http://puente.test",
    BETTER_AUTH_SECRET: "secreto-de-sesion-de-pruebas-0123456789abcdef",
    PUENTE_CLAVE_CIFRADO: "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
    PUENTE_MODO_PRUEBAS: "1",
    PUENTE_TIMEOUT_MS: "10000",
    CV_MAX_BYTES: "1048576",
  });
}

import { config as cargarEnv } from "dotenv";

// Variables de entorno de las pruebas del puente: base aislada (tb2_test, esquema puente) y hosts ficticios.
// No hay red: el webhook del puente se llama en proceso y Vínculo y Talentia son dobles que cumplen su contrato HTTP.
export function prepararEntornoPruebas() {
  cargarEnv({ quiet: true });
  const urlPruebas = process.env.DATABASE_URL_TEST;
  if (!urlPruebas) throw new Error("Falta DATABASE_URL_TEST en .env");
  if (!new URL(urlPruebas).pathname.endsWith("_test")) throw new Error("DATABASE_URL_TEST debe apuntar a una base *_test");
  Object.assign(process.env, {
    DATABASE_URL: urlPruebas,
    APP_BASE_URL: "http://puente.test",
    ORIGEN_BASE_URL: "http://vinculo.test",
    ATS_BASE_URL: "http://talentia.test",
    SIM_CLIENT_SECRET: "secreto-cliente-de-pruebas-0123456789",
    VINCULO_CLIENT_ID: "vin_cliente_de_pruebas",
    ATS_API_KEY: "clave-api-de-pruebas-0123456789",
    PUENTE_MODO_PRUEBAS: "1",
    CV_MAX_BYTES: "1048576",
  });
}

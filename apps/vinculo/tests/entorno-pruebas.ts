import { config as cargarEnv } from "dotenv";

// Variables de entorno de las pruebas de Vínculo: base aislada (tb2_test, esquema vinculo) y hosts ficticios.
// No hay red: las rutas de Vínculo se llaman en proceso y el webhook del integrador es un doble de prueba.
export function prepararEntornoPruebas() {
  cargarEnv({ quiet: true });
  const urlPruebas = process.env.DATABASE_URL_TEST;
  if (!urlPruebas) throw new Error("Falta DATABASE_URL_TEST en .env");
  if (!new URL(urlPruebas).pathname.endsWith("_test")) throw new Error("DATABASE_URL_TEST debe apuntar a una base *_test");
  Object.assign(process.env, {
    DATABASE_URL: urlPruebas,
    APP_BASE_URL: "http://vinculo.test",
    BETTER_AUTH_SECRET: "secreto-de-sesion-de-pruebas-0123456789abcdef",
    VINCULO_CLAVE_CIFRADO: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    VINCULO_JWT_SECRET: "secreto-jwt-de-pruebas-0123456789abcdef0123",
    VINCULO_CLIENT_ID_PUENTE: "",
    VINCULO_SECRETO_PUENTE: "",
    PUENTE_WEBHOOK_URL: "",
    CV_MAX_BYTES: "1048576",
    // Las pruebas existentes ejercitan la API tipo Apply Connect: se prende explícitamente (D-68). api-apagada.test.ts la apaga.
    VINCULO_API_HABILITADA: "true",
  });
}

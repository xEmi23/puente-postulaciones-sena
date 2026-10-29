import { config as cargarEnv } from "dotenv";

// Variables de entorno de las pruebas de Talentia: base aislada (tb2_test, esquema talentia).
// No hay red: las rutas de la API se llaman en proceso.
export function prepararEntornoPruebas() {
  cargarEnv({ quiet: true });
  const urlPruebas = process.env.DATABASE_URL_TEST;
  if (!urlPruebas) throw new Error("Falta DATABASE_URL_TEST en .env");
  if (!new URL(urlPruebas).pathname.endsWith("_test")) throw new Error("DATABASE_URL_TEST debe apuntar a una base *_test");
  Object.assign(process.env, {
    DATABASE_URL: urlPruebas,
    APP_BASE_URL: "http://talentia.test",
    BETTER_AUTH_SECRET: "secreto-de-sesion-de-pruebas-0123456789abcdef",
    TALENTIA_LLAVE_PUENTE: "",
    CV_MAX_BYTES: "1048576",
  });
}

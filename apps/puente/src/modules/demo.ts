// Cuentas de demostración del puente (ESPECIFICACION §4.1). La contraseña es pública a propósito:
// entorno de simulación con datos ficticios.

export const CLAVE_DEMO = "Demo2026!";

export const USUARIOS_DEMO = [
  { nombre: "Camilo Arango", correo: "admin@puente.demo.test", rol: "ADMIN", cargo: "Administrador (configura conexiones)" },
  { nombre: "Sara Villegas", correo: "operador@puente.demo.test", rol: "OPERADOR", cargo: "Operadora (supervisa)" },
] as const;

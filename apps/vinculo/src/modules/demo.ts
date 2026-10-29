// Cuentas de demostración de Vínculo (ESPECIFICACION §2.1: 2 candidatos y 1 reclutador con contraseña común).
// La contraseña es pública a propósito: entorno de simulación con datos ficticios.

export const CLAVE_DEMO = "Demo2026!";

export const CUENTAS_DEMO = [
  { tipo: "Candidata", correo: "valentina.rios@demo.test" },
  { tipo: "Candidato", correo: "santiago.mejia@demo.test" },
  { tipo: "Reclutadora · Andina Software", correo: "reclutadora@andina.demo.test" },
] as const;

// Cuentas de demostración de Talentia (empresa ficticia «Andina Software S.A.S.»).
// La contraseña es pública a propósito: entorno de simulación con datos ficticios (ESPECIFICACION §3.1).

export const EMPRESA_DEMO = "Andina Software S.A.S.";
export const CLAVE_DEMO = "Demo2026!";

export const USUARIOS_DEMO = [
  { nombre: "Mariana Ocampo", correo: "admin@andina.demo.test", rol: "ADMIN", cargo: "Administradora" },
  { nombre: "Julián Herrera", correo: "reclutador@andina.demo.test", rol: "RECLUTADOR", cargo: "Reclutador" },
] as const;

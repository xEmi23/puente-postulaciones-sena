/** Enmascara un correo para listados: "laura.ejemplo@demo.test" → "la•••@demo.test". */
export function enmascararCorreo(correo: string): string {
  const [usuario, dominio] = correo.split("@");
  if (!dominio) return "•••";
  return `${usuario.slice(0, 2)}•••@${dominio}`;
}

/** Referencia corta legible para operaciones: últimos 8 caracteres del identificador. */
export function referenciaCorta(id: string): string {
  return id.replace(/[^A-Za-z0-9]/g, "").slice(-8).toUpperCase();
}

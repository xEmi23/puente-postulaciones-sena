/** Enmascara un correo para listados: "laura.ejemplo@demo.test" → "la•••@demo.test". */
export function enmascararCorreo(correo: string | null | undefined): string {
  if (!correo) return "sin correo";
  const [usuario, dominio] = correo.split("@");
  if (!dominio) return "•••";
  return `${usuario.slice(0, 2)}•••@${dominio}`;
}

/** Referencia corta legible para operaciones: últimos 8 caracteres del identificador. */
export function referenciaCorta(id: string): string {
  return id.replace(/[^A-Za-z0-9]/g, "").slice(-8).toUpperCase();
}

/** Para logs: enmascara cualquier correo dentro de un texto ("ana.perez@demo.test" → "an•••@demo.test"). */
export function enmascararTexto(texto: string): string {
  return texto.replace(/([A-Za-z0-9._%+-]{1,2})[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, "$1•••@$2");
}

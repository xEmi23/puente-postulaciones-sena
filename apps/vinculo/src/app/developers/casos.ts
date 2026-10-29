// Consola de pruebas: equivale a enviar payloads con Postman (ficha 2.8). Cada caso es una entrega INVÁLIDA a propósito.
export const CASOS_CONSOLA = {
  firma_invalida: "Firma X-LI-Signature inválida",
  falta_correo: "Falta el correo (respuesta obligatoria)",
  correo_invalido: "Correo con formato inválido",
  sin_vincular: "Vacante que el ATS no conoce (externalJobId inexistente)",
  host_no_autorizado: "mediaUrl de un host no autorizado",
  json_ilegible: "Cuerpo que no es JSON",
} as const;

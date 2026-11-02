import { ErrorConectorATS, type ConectorATS } from "../conector-ats";

// Adaptador de salida para BUK: ESQUELETO DESHABILITADO (ESPECIFICACION_V4 §9).
// No contiene rutas, encabezados ni formatos de BUK: ninguno está verificado (la empresa no entrega la API Key ni la
// documentación de /apidocs). Para activarlo: (1) la empresa entrega la exportación de /apidocs y una API Key de
// pruebas, (2) se escribe este adaptador contra esa documentación, (3) pasan las pruebas de contrato de ConectorATS
// (tests/conector-ats.test.ts), (4) se cambia ATS_DESTINO=buk.

const PENDIENTE = "no implementado: pendiente de la documentación oficial de /apidocs";

export function crearConectorBuk(): ConectorATS {
  const noImplementado = async (): Promise<never> => {
    throw new ErrorConectorATS("no_implementado", PENDIENTE);
  };
  return {
    nombre: "buk",
    // Todas en false hasta verificarlas contra la documentación oficial.
    capacidades: { adjuntarCV: false, buscarPorCorreo: false, idempotencia: false },
    async verificarConexion() {
      return { ok: false, detalle: "no configurado: el adaptador de BUK está deshabilitado (falta la documentación oficial de /apidocs y una API Key de pruebas)." };
    },
    listarProcesos: noImplementado,
    buscarPostulante: noImplementado,
    crearPostulante: noImplementado,
    adjuntarCV: noImplementado,
    crearPostulacion: noImplementado,
    consultarPostulacion: noImplementado,
  };
}

export const MENSAJE_BUK_PENDIENTE = PENDIENTE;

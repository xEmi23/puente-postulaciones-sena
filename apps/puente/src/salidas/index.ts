import type { ConectorATS, NombreATS } from "./conector-ats";
import { crearConectorTalentia } from "./talentia";
import { crearConectorBuk } from "./buk";

// Selección del ATS de destino: ATS_DESTINO=talentia (por defecto) | buk. El resto del Puente obtiene su conector
// aquí y nunca importa un adaptador concreto (regla de lint en eslint.config.mjs y prueba en tests/salidas.test.ts).

export type { ConectorATS } from "./conector-ats";
export { ErrorConectorATS } from "./conector-ats";

const IMPLEMENTADOS: Record<NombreATS, boolean> = { talentia: true, buk: false };

export function destinoConfigurado(): NombreATS {
  const v = (process.env.ATS_DESTINO ?? "talentia").trim().toLowerCase();
  return v === "buk" ? "buk" : "talentia";
}

/** ¿El adaptador del destino configurado está implementado? Si no, el procesador no arranca y /api/salud lo informa. */
export function estadoDestino(): { destino: NombreATS; implementado: boolean; mensaje: string } {
  const destino = destinoConfigurado();
  const implementado = IMPLEMENTADOS[destino];
  return {
    destino,
    implementado,
    mensaje: implementado
      ? destino === "talentia"
        ? "ATS Simulador BUK activo"
        : `ATS ${destino} activo`
      : `ATS ${destino} no implementado`,
  };
}

let sustituto: ConectorATS | null = null;

/** Solo pruebas: reemplaza el conector (p. ej., un ATS que no admite adjuntar el CV). `null` vuelve al real. */
export function usarConectorDePrueba(c: ConectorATS | null) {
  sustituto = c;
}

export function conectorATS(opciones: { fetchImpl?: typeof fetch } = {}): ConectorATS {
  if (sustituto) return sustituto;
  return destinoConfigurado() === "buk" ? crearConectorBuk() : crearConectorTalentia(opciones);
}

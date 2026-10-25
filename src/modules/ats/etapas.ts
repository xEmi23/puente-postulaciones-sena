// Etapas de un proceso del ATS simulado. Única fuente: la usan los datos de demo y «Nuevo proceso».
//
// Nombres y orden: observación directa del ATS de la empresa en la socialización (15/10/2026), descrita por el equipo
//   (docs/referencia-ats.md). La foto se corta en «Suspendido».
// «Contratados» (última): Verificado en el centro de ayuda de BUK (docs/contratos.md F6), no en la foto.
// Tipo de etapa (Filtro / Validaciones / Entrevistas): SUPUESTO PENDIENTE para cada etapa hasta confirmarlo con
//   docs/referencia-ats.md; corregirlo aquí y ejecutar `npm run demo:reset`.

export type TipoEtapa = "Filtro" | "Validaciones" | "Entrevistas";

export interface DefinicionEtapa {
  nombre: string;
  tipo: TipoEtapa | null;
  fuente: "ATS de la empresa (15/10/2026)" | "Centro de ayuda de BUK (verificado)";
}

const ATS = "ATS de la empresa (15/10/2026)" as const;

export const ETAPAS_REFERENCIA: readonly DefinicionEtapa[] = [
  { nombre: "Postulantes", tipo: "Filtro", fuente: ATS },
  { nombre: "Por contactar", tipo: "Filtro", fuente: ATS },
  { nombre: "Referidos", tipo: "Filtro", fuente: ATS },
  { nombre: "Sagrilaft", tipo: "Validaciones", fuente: ATS },
  { nombre: "Prueba técnica", tipo: "Validaciones", fuente: ATS },
  { nombre: "Entrevista técnica", tipo: "Entrevistas", fuente: ATS },
  { nombre: "Valoración psicológica", tipo: "Validaciones", fuente: ATS },
  { nombre: "Suspendido", tipo: "Filtro", fuente: ATS },
  { nombre: "Contratados", tipo: null, fuente: "Centro de ayuda de BUK (verificado)" },
];

/** Filas para crear las etapas de un proceso (orden 1…n). */
export function etapasParaCrear() {
  return ETAPAS_REFERENCIA.map((e, i) => ({ nombre: e.nombre, tipo: e.tipo, orden: i + 1 }));
}

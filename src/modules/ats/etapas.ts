// Etapas de un proceso del ATS simulado. Única fuente: la usan los datos de demo y «Nuevo proceso».
//
// Nombres, orden y tipo (Filtro / Validaciones / Entrevistas): observación directa del ATS de la empresa en la
//   socialización (15/10/2026), docs/referencia-ats.md. «Postulantes» es la etapa de entrada (sin tipo).
//   La foto se corta en «Suspendido».
// «Contratados» (última, sin tipo): Verificado en el centro de ayuda de BUK (docs/contratos.md F6), no en la foto.

export type TipoEtapa = "Filtro" | "Validaciones" | "Entrevistas";

export interface DefinicionEtapa {
  nombre: string;
  tipo: TipoEtapa | null;
  fuente: "ATS de la empresa (15/10/2026)" | "Centro de ayuda de BUK (verificado)";
}

const ATS = "ATS de la empresa (15/10/2026)" as const;

export const ETAPAS_REFERENCIA: readonly DefinicionEtapa[] = [
  { nombre: "Postulantes", tipo: null, fuente: ATS },
  { nombre: "Por contactar", tipo: "Filtro", fuente: ATS },
  { nombre: "Referidos", tipo: "Validaciones", fuente: ATS },
  { nombre: "Sagrilaft", tipo: "Validaciones", fuente: ATS },
  { nombre: "Prueba técnica", tipo: "Filtro", fuente: ATS },
  { nombre: "Entrevista técnica", tipo: "Entrevistas", fuente: ATS },
  { nombre: "Valoración psicológica", tipo: "Entrevistas", fuente: ATS },
  { nombre: "Suspendido", tipo: "Filtro", fuente: ATS },
  { nombre: "Contratados", tipo: null, fuente: "Centro de ayuda de BUK (verificado)" },
];

/** Texto del tipo en el tablero: las etapas sin tipo son la de entrada (primera) o la final (última). */
export function etiquetaTipo(tipo: string | null, orden: number): string {
  if (tipo) return tipo;
  return orden === 1 ? "Entrada" : "Etapa final";
}

/** Filas para crear las etapas de un proceso (orden 1…n). */
export function etapasParaCrear() {
  return ETAPAS_REFERENCIA.map((e, i) => ({ nombre: e.nombre, tipo: e.tipo, orden: i + 1 }));
}

// Texto visible de cada fuente en el ATS y en el panel. Se rotula siempre como simulador: ningún texto afirma conexión
// con LinkedIn ni con BUK (CLAUDE.md, D-74). El identificador interno (p. ej., «vinculo-bot») no cambia.

const ETIQUETAS: Record<string, string> = {
  "apply-connect": "Simulador LinkedIn (Apply Connect)",
  importador: "Importador manual",
  "formulario-publico": "Formulario público",
  "vinculo-bot": "LinkedIn (bot, simulador)",
  "linkedin-bot": "Bot experimental (LinkedIn)",
};

export function etiquetaFuente(fuente: string): string {
  return ETIQUETAS[fuente] ?? `Puente · fuente «${fuente}»`;
}

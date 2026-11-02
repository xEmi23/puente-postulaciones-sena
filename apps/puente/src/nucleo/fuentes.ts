// Texto visible de cada fuente en el ATS y en el panel. Ningún texto afirma conexión con LinkedIn (CLAUDE.md, D-19).

const ETIQUETAS: Record<string, string> = {
  "apply-connect": "Portal simulado (tipo LinkedIn)",
  importador: "Importador manual del Puente",
  "linkedin-bot": "Bot experimental (LinkedIn)",
};

export function etiquetaFuente(fuente: string): string {
  return ETIQUETAS[fuente] ?? `Puente · fuente «${fuente}»`;
}

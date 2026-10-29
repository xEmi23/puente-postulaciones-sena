// Punto único de las solicitudes HTTP que Vínculo hace hacia afuera (desafío y entregas a los webhooks).
// Las pruebas lo sustituyen por un fetch en proceso; en ejecución normal es el fetch global.

let actual: typeof fetch | null = null;

export function fetchSaliente(): typeof fetch {
  return actual ?? fetch;
}

/** Solo pruebas. */
export function usarFetchSaliente(f: typeof fetch | null) {
  actual = f;
}

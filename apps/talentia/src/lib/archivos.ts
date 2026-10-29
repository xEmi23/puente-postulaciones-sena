import { createHash } from "node:crypto";

export function sha256Hex(datos: Uint8Array): string {
  return createHash("sha256").update(datos).digest("hex");
}

/** Un PDF válido empieza con la firma "%PDF-". No basta con la extensión ni con el tipo MIME declarado. */
export function pareceUnPdf(datos: Uint8Array): boolean {
  return datos.length >= 5 && Buffer.from(datos.subarray(0, 5)).toString("latin1") === "%PDF-";
}

export function nombreArchivoSeguro(nombre: string): string {
  const base = nombre.split(/[\/]/).pop() ?? "cv.pdf";
  const limpio = base.normalize("NFKD").replace(/[^\w.\- ]+/g, "").trim().slice(0, 120);
  return limpio.toLowerCase().endsWith(".pdf") ? limpio : `${limpio || "cv"}.pdf`;
}

export function formatoTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

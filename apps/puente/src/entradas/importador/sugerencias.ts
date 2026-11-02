import { extractText, getDocumentProxy } from "unpdf";
import { normalizarCorreo, normalizarTelefono, normalizarTexto } from "@/nucleo/contrato/canonica";

// Importador (ESPECIFICACION_V4 §8.2): el Puente lee el texto del PDF y SUGIERE correo y teléfono con expresiones
// regulares (sin IA); el nombre sale del CSV o del nombre del archivo. La persona revisa y confirma todo.
// Librería: unpdf 1.9.0 (JavaScript puro, incluye pdf.js; funciona en Render sin dependencias nativas; D-62).

/** Texto del PDF, o "" si no tiene texto (escaneado) o no se puede leer. Nunca lanza. */
export async function leerTextoPdf(bytes: Uint8Array): Promise<string> {
  try {
    const pdf = await getDocumentProxy(bytes.slice());
    const { text } = await extractText(pdf, { mergePages: true });
    return (Array.isArray(text) ? text.join("\n") : text).trim();
  } catch {
    return "";
  }
}

const RE_CORREO = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** Primer correo del texto, normalizado. */
export function sugerirCorreo(texto: string): string {
  const m = texto.match(RE_CORREO);
  return m ? normalizarCorreo(m[0]) : "";
}

// Grupos de dígitos con +, espacios, puntos, guiones o paréntesis entre ellos (de 7 a 15 dígitos en total).
const RE_TELEFONO = /(?:\+|00)?\d[\d\s().-]{6,20}\d/g;

/**
 * Primer teléfono plausible, en E.164 (+57 por defecto). Prefiere móviles colombianos (10 dígitos que empiezan por 3)
 * o números con indicativo; descarta años y rangos como «2019 - 2022».
 */
export function sugerirTelefono(texto: string): string {
  const candidatos = (texto.match(RE_TELEFONO) ?? [])
    .map((c) => c.trim())
    .filter((c) => {
      const digitos = c.replace(/\D/g, "");
      if (digitos.length < 7 || digitos.length > 15) return false;
      if (/^\d{4}\s*[-–]\s*\d{4}$/.test(c)) return false; // rango de años
      return c.startsWith("+") || c.startsWith("00") || /^3\d{9}$/.test(digitos) || /^57\d{10}$/.test(digitos);
    });
  for (const c of candidatos) {
    const e164 = normalizarTelefono(c);
    if (e164) return e164;
  }
  return "";
}

const PALABRAS_DE_ARCHIVO = new Set(["cv", "hv", "hoja", "de", "vida", "curriculum", "currículum", "resume", "pdf", "final", "actualizado", "v1", "v2"]);

/** «cv-camila-ejemplo.pdf» → { nombres: "Camila", apellidos: "Ejemplo" }. */
export function nombreDesdeArchivo(nombreArchivo: string): { nombres: string; apellidos: string } {
  const base = nombreArchivo.replace(/\.[^.]+$/, "");
  const partes = base
    .split(/[\s_.\-]+/)
    .filter((p) => p && !PALABRAS_DE_ARCHIVO.has(p.toLowerCase()) && !/^\d+$/.test(p))
    .map((p) => p.charAt(0).toLocaleUpperCase("es") + p.slice(1).toLocaleLowerCase("es"));
  if (partes.length === 0) return { nombres: "", apellidos: "" };
  return { nombres: normalizarTexto(partes[0]), apellidos: normalizarTexto(partes.slice(1).join(" ")) };
}

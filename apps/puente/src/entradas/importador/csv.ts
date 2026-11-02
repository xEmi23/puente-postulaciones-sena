// CSV opcional del importador (ESPECIFICACION_V4 §8.2): columnas archivo, nombres, apellidos, correo, telefono.
// Sirve para la exportación de Recruiter guardada como CSV. Separador «,» o «;» (Excel en español usa «;»), comillas
// dobles para valores con separadores. Solo CSV: el XLSX no se acepta (D-63). Lo que trae el CSV gana sobre lo sugerido.

export interface FilaCsv {
  archivo: string;
  nombres?: string;
  apellidos?: string;
  correo?: string;
  telefono?: string;
}

function partirLinea(linea: string, sep: string): string[] {
  const campos: string[] = [];
  let actual = "";
  let comillas = false;
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i];
    if (comillas) {
      if (ch === '"' && linea[i + 1] === '"') {
        actual += '"';
        i++;
      } else if (ch === '"') comillas = false;
      else actual += ch;
    } else if (ch === '"') comillas = true;
    else if (ch === sep) {
      campos.push(actual);
      actual = "";
    } else actual += ch;
  }
  campos.push(actual);
  return campos.map((c) => c.trim());
}

const ALIAS: Record<string, keyof FilaCsv> = {
  archivo: "archivo",
  nombre_archivo: "archivo",
  nombres: "nombres",
  nombre: "nombres",
  apellidos: "apellidos",
  apellido: "apellidos",
  correo: "correo",
  email: "correo",
  telefono: "telefono",
  teléfono: "telefono",
};

export type ResultadoCsv = { ok: true; filas: Map<string, FilaCsv> } | { ok: false; mensaje: string };

/** Filas por nombre de archivo (en minúsculas). */
export function leerCsv(texto: string): ResultadoCsv {
  const lineas = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lineas.length === 0) return { ok: true, filas: new Map() };
  const sep = (lineas[0].match(/;/g)?.length ?? 0) > (lineas[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const encabezado = partirLinea(lineas[0], sep).map((h) => ALIAS[h.toLowerCase()] ?? null);
  if (!encabezado.includes("archivo")) return { ok: false, mensaje: "El CSV debe tener la columna «archivo» (y opcionalmente nombres, apellidos, correo, telefono)." };
  const filas = new Map<string, FilaCsv>();
  for (const linea of lineas.slice(1)) {
    const valores = partirLinea(linea, sep);
    const fila: Partial<FilaCsv> = {};
    encabezado.forEach((col, i) => {
      if (col && valores[i]) fila[col] = valores[i];
    });
    if (fila.archivo) filas.set(fila.archivo.toLowerCase(), fila as FilaCsv);
  }
  return { ok: true, filas };
}

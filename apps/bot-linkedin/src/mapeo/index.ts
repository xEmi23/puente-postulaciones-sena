import { createHash } from "node:crypto";
import type { DetallePostulante } from "../sitios/tipos";

// Mapeo de lo extraído a la PostulacionCanonica v1 del Puente (ESPECIFICACION_V4 §6), SIN `fuente`: la fija el token.
// El bot no importa código del Puente (cada app es independiente); este es el contrato publicado en docs/contratos.md §8.

export interface CanonicaSinFuente {
  version: "1";
  idExterno: string;
  vacanteExterna: string;
  recibidaEn?: string;
  candidato: { nombres: string; apellidos?: string; correo?: string; telefono?: string; ciudad?: string; titular?: string; perfilUrl?: string };
  cv?: { nombreArchivo: string; tipo: "application/pdf"; sha256: string; bytes: number };
  origenDatos: "fuente";
}

const opcional = (v: string) => (v.trim() ? v.trim() : undefined);

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function aCanonica(d: DetallePostulante, cv: { bytes: Uint8Array; nombreArchivo: string } | null): CanonicaSinFuente {
  return {
    version: "1",
    idExterno: d.idExterno,
    vacanteExterna: d.vacanteExterna,
    recibidaEn: opcional(d.recibidaEn),
    candidato: {
      nombres: d.nombres.trim(),
      apellidos: opcional(d.apellidos),
      correo: opcional(d.correo),
      telefono: opcional(d.telefono),
      ciudad: opcional(d.ciudad),
      titular: opcional(d.titular),
      perfilUrl: opcional(d.perfilUrl),
    },
    ...(cv ? { cv: { nombreArchivo: cv.nombreArchivo, tipo: "application/pdf" as const, sha256: sha256(cv.bytes), bytes: cv.bytes.length } } : {}),
    origenDatos: "fuente",
  };
}

export const esPdf = (b: Uint8Array) => b.length >= 5 && Buffer.from(b.subarray(0, 5)).toString("latin1") === "%PDF-";

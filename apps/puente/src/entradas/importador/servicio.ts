import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import { pareceUnPdf, sha256Hex, formatoTamano } from "@/lib/archivos";
import { VERSION_CONTRATO } from "@/nucleo/contrato/canonica";
import { registrarRecepcion } from "@/nucleo/recepcion/registrar";
import { auditar, type Actor } from "@/nucleo/auditoria";
import { leerCsv } from "./csv";
import { leerTextoPdf, nombreDesdeArchivo, sugerirCorreo, sugerirTelefono } from "./sugerencias";

// Importador manual (ESPECIFICACION_V4 §8.2): una persona sube hasta 20 PDF (y, si quiere, un CSV) para un proceso del
// ATS; el Puente sugiere los datos, la persona revisa la tabla y confirma. Cada fila confirmada es una
// PostulacionCanonica (fuente = importador, idExterno = <proceso>:<sha256 del PDF>) que entra por registrarRecepcion():
// no existe otro camino hacia el ATS. Importar dos veces el mismo PDF en el mismo proceso da DUPLICADA.

export const FUENTE_IMPORTADOR = "importador";
export const MAX_ARCHIVOS = 20;

export type ResultadoLote = { ok: true; loteId: string } | { ok: false; mensaje: string };

export async function asegurarFuenteImportador() {
  await prisma.fuente.upsert({
    where: { nombre: FUENTE_IMPORTADOR },
    create: { nombre: FUENTE_IMPORTADOR, descripcion: "Importador manual del panel (sin token: actúa la persona con sesión)", sistema: true },
    update: {},
  });
}

/** Valida los archivos, lee el texto, sugiere los datos y guarda el lote en espera de la confirmación de la persona. */
export async function crearLote(
  usuarioId: string,
  procesoAtsId: number,
  archivos: { nombre: string; bytes: Uint8Array }[],
  csvTexto?: string,
): Promise<ResultadoLote> {
  if (!Number.isInteger(procesoAtsId) || procesoAtsId <= 0) return { ok: false, mensaje: "Elige el proceso del ATS." };
  if (archivos.length === 0) return { ok: false, mensaje: "Adjunta al menos un PDF." };
  if (archivos.length > MAX_ARCHIVOS) return { ok: false, mensaje: `Máximo ${MAX_ARCHIVOS} PDF por importación (llegaron ${archivos.length}).` };
  const csv = csvTexto?.trim() ? leerCsv(csvTexto) : null;
  if (csv && !csv.ok) return { ok: false, mensaje: csv.mensaje };
  const max = config().CV_MAX_BYTES;

  const filas = [];
  for (const [orden, a] of archivos.entries()) {
    const base = { orden, nombreArchivo: a.nombre.slice(0, 200), tamano: a.bytes.length };
    if (a.bytes.length > max) {
      filas.push({ ...base, error: `«${a.nombre}» pesa ${formatoTamano(a.bytes.length)}: el máximo es ${formatoTamano(max)}.` });
      continue;
    }
    if (!pareceUnPdf(a.bytes)) {
      filas.push({ ...base, error: `«${a.nombre}» no es un PDF (solo se aceptan PDF).` });
      continue;
    }
    const texto = await leerTextoPdf(a.bytes);
    const deArchivo = nombreDesdeArchivo(a.nombre);
    const deCsv = csv?.ok ? csv.filas.get(a.nombre.toLowerCase()) : undefined;
    filas.push({
      ...base,
      contenido: Buffer.from(a.bytes),
      sha256: sha256Hex(a.bytes),
      textoLeido: texto.length > 0,
      // El CSV gana sobre lo sugerido (I-4).
      nombres: deCsv?.nombres ?? deArchivo.nombres,
      apellidos: deCsv?.apellidos ?? deArchivo.apellidos,
      correo: deCsv?.correo ?? sugerirCorreo(texto),
      telefono: deCsv?.telefono ?? sugerirTelefono(texto),
      origenNombre: deCsv?.nombres ? "csv" : "archivo",
    });
  }
  const lote = await prisma.loteImportacion.create({ data: { usuarioId, procesoAtsId, archivos: { create: filas } } });
  await auditar({ tipo: "usuario", id: usuarioId }, "importador.lote_creado", null, `${filas.length} archivo(s) para el proceso ${procesoAtsId}`);
  return { ok: true, loteId: lote.id };
}

export interface FilaConfirmada {
  id: string;
  incluir: boolean;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string;
}

/** La persona confirmó la tabla: cada fila incluida entra al núcleo con origenDatos = confirmado-por-persona. */
export async function confirmarLote(loteId: string, filas: FilaConfirmada[], actor: Actor): Promise<{ ok: boolean; mensaje: string }> {
  const lote = await prisma.loteImportacion.findUnique({ where: { id: loteId }, include: { archivos: { orderBy: { orden: "asc" } } } });
  if (!lote) return { ok: false, mensaje: "La importación no existe o ya venció." };
  if (lote.confirmadoEn) return { ok: false, mensaje: "Esta importación ya se confirmó." };
  await asegurarFuenteImportador();
  const porId = new Map(filas.map((f) => [f.id, f]));
  const conteo: Record<string, number> = {};
  for (const a of lote.archivos) {
    const f = porId.get(a.id);
    if (a.error || !a.contenido || !a.sha256 || !f?.incluir) {
      await prisma.archivoImportacion.update({ where: { id: a.id }, data: { contenido: null, resultado: a.error ? "RECHAZADO" : "OMITIDO" } });
      continue;
    }
    const bytes = new Uint8Array(a.contenido);
    const canonica = {
      version: VERSION_CONTRATO,
      fuente: FUENTE_IMPORTADOR,
      idExterno: `${lote.procesoAtsId}:${a.sha256}`,
      vacanteExterna: String(lote.procesoAtsId),
      candidato: { nombres: f.nombres, apellidos: f.apellidos || undefined, correo: f.correo || undefined, telefono: f.telefono || undefined },
      cv: { nombreArchivo: a.nombreArchivo, tipo: "application/pdf", sha256: a.sha256, bytes: bytes.length },
      origenDatos: "confirmado-por-persona",
    };
    const r = await registrarRecepcion(canonica, { tipo: "binario", bytes, nombreArchivo: a.nombreArchivo }, actor, {
      procesoAtsId: lote.procesoAtsId,
      detalleRecibido: `Importada por una persona en el panel (datos confirmados${a.textoLeido ? "" : "; el PDF no tenía texto legible"}).`,
    });
    const resultado = r.resultado === "INVALIDA" || r.resultado === "CV_INVALIDO" || r.resultado === "SIN_CORRESPONDENCIA" ? "ERROR" : r.resultado;
    const detalle = r.resultado === "INVALIDA" ? r.errores.map((e) => `${e.campo}: ${e.mensaje}`).join("; ") : r.resultado === "CV_INVALIDO" ? r.mensaje : r.resultado === "SIN_CORRESPONDENCIA" ? r.motivo : null;
    conteo[resultado] = (conteo[resultado] ?? 0) + 1;
    await prisma.archivoImportacion.update({
      where: { id: a.id },
      data: {
        contenido: null,
        resultado,
        error: detalle,
        recepcionId: "recepcionId" in r ? r.recepcionId : null,
        nombres: f.nombres,
        apellidos: f.apellidos,
        correo: f.correo,
        telefono: f.telefono,
      },
    });
  }
  await prisma.loteImportacion.update({ where: { id: loteId }, data: { confirmadoEn: new Date() } });
  await auditar(actor, "importador.lote_confirmado", null, Object.entries(conteo).map(([k, v]) => `${k}=${v}`).join(","));
  const partes = [
    conteo.RECIBIDA ? `${conteo.RECIBIDA} enviada(s) al ATS` : null,
    conteo.REQUIERE_REVISION ? `${conteo.REQUIERE_REVISION} en revisión` : null,
    conteo.DUPLICADA ? `${conteo.DUPLICADA} duplicada(s)` : null,
    conteo.ERROR ? `${conteo.ERROR} con error` : null,
  ].filter(Boolean);
  return { ok: true, mensaje: partes.length ? `Importación confirmada: ${partes.join(", ")}.` : "No había filas para importar." };
}

/** Lotes sin confirmar con más de 24 h: se borran (tienen CV y datos personales). */
export async function borrarLotesVencidos(ahora = new Date()) {
  const r = await prisma.loteImportacion.deleteMany({ where: { confirmadoEn: null, creadoEn: { lt: new Date(ahora.getTime() - 24 * 3600_000) } } });
  return r.count;
}

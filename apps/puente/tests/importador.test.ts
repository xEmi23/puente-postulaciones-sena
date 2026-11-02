import { beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { confirmarLote, crearLote, type FilaConfirmada } from "@/entradas/importador/servicio";
import { recibirSubida } from "@/entradas/importador/http";
import { leerTextoPdf, nombreDesdeArchivo, sugerirCorreo, sugerirTelefono } from "@/entradas/importador/sugerencias";
import { leerCsv } from "@/entradas/importador/csv";
import { drenar, prisma, reiniciarBd, talentia } from "./utilidades";

// F3: importador manual (ESPECIFICACION_V4 §8.2). PDF ficticios generados en la prueba con pdf-lib (sin datos reales).

const USUARIO = "usuario-importador-pruebas";
const actor = { tipo: "usuario" as const, id: USUARIO };
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

async function pdfConTexto(lineas: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const pagina = doc.addPage([595, 842]);
  const fuente = await doc.embedFont(StandardFonts.Helvetica);
  lineas.forEach((l, i) => pagina.drawText(l, { x: 40, y: 780 - i * 18, size: 11, font: fuente }));
  return doc.save();
}

/** PDF «escaneado»: solo una figura, sin texto. */
async function pdfSinTexto(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([595, 842]).drawRectangle({ x: 40, y: 600, width: 300, height: 150 });
  return doc.save();
}

const TRES = [
  { nombre: "cv-ana-gomez.pdf", lineas: ["Ana Gómez Ficticia", "ana.gomez@demo.test · 300 111 2233", "Experiencia 2019 - 2022 en empresa ficticia"] },
  { nombre: "cv-bruno-diaz.pdf", lineas: ["Bruno Díaz Ficticio", "Correo: Bruno.Diaz@Demo.Test", "Tel: +57 (301) 222-3344"] },
  { nombre: "cv-carla-ruiz.pdf", lineas: ["Carla Ruiz Ficticia", "carla.ruiz@demo.test", "Celular 3023334455"] },
];

const filasDe = async (loteId: string, cambios: Partial<FilaConfirmada> = {}): Promise<FilaConfirmada[]> =>
  (await prisma.archivoImportacion.findMany({ where: { loteId }, orderBy: { orden: "asc" } })).map((a) => ({
    id: a.id,
    incluir: true,
    nombres: a.nombres,
    apellidos: a.apellidos,
    correo: a.correo,
    telefono: a.telefono,
    ...cambios,
  }));

beforeEach(async () => {
  await reiniciarBd();
  await prisma.$executeRawUnsafe(`TRUNCATE "LoteImportacion", "ArchivoImportacion", "EventoAuditoria" CASCADE`);
});

describe("sugerencias (sin IA)", () => {
  it("lee el texto de un PDF y sugiere correo y teléfono en E.164; ignora rangos de años", async () => {
    const texto = await leerTextoPdf(await pdfConTexto(TRES[0].lineas));
    expect(texto).toContain("ana.gomez@demo.test");
    expect(sugerirCorreo(texto)).toBe("ana.gomez@demo.test");
    expect(sugerirTelefono(texto)).toBe("+573001112233");
    expect(sugerirTelefono("Trabajé 2019 - 2022 y 2023-2024")).toBe("");
    expect(sugerirTelefono("Tel: +57 (301) 222-3344")).toBe("+573012223344");
  });

  it("el nombre sale del nombre del archivo", () => {
    expect(nombreDesdeArchivo("cv-camila-ejemplo.pdf")).toEqual({ nombres: "Camila", apellidos: "Ejemplo" });
    expect(nombreDesdeArchivo("Hoja_de_vida_ANA_MARIA_PEREZ_2026.pdf")).toEqual({ nombres: "Ana", apellidos: "Maria Perez" });
  });

  it("un PDF sin texto devuelve texto vacío (no lanza)", async () => {
    expect(await leerTextoPdf(await pdfSinTexto())).toBe("");
    expect(await leerTextoPdf(new TextEncoder().encode("%PDF-roto"))).toBe("");
  });

  it("el CSV acepta «,» o «;», comillas y alias de columnas", () => {
    const r = leerCsv('archivo;nombre;apellidos;email\n"cv a.pdf";Ana;"Gómez; Pérez";ana@demo.test\n');
    expect(r.ok && r.filas.get("cv a.pdf")).toEqual({ archivo: "cv a.pdf", nombres: "Ana", apellidos: "Gómez; Pérez", correo: "ana@demo.test" });
    expect(leerCsv("nombre,correo\nAna,a@demo.test").ok).toBe(false);
  });
});

describe("I-1 · tres PDF con correo en el texto llegan a Postulantes del proceso elegido en Talentia", () => {
  it("sugiere, la persona confirma y llegan los tres al proceso 9002 con el mismo SHA-256", async () => {
    const archivos = await Promise.all(TRES.map(async (t) => ({ nombre: t.nombre, bytes: await pdfConTexto(t.lineas) })));
    const r = await crearLote(USUARIO, 9002, archivos);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const sugeridas = await prisma.archivoImportacion.findMany({ where: { loteId: r.loteId }, orderBy: { orden: "asc" } });
    expect(sugeridas.map((s) => [s.nombres, s.apellidos, s.correo, s.telefono, s.textoLeido])).toEqual([
      ["Ana", "Gomez", "ana.gomez@demo.test", "+573001112233", true],
      ["Bruno", "Diaz", "bruno.diaz@demo.test", "+573012223344", true],
      ["Carla", "Ruiz", "carla.ruiz@demo.test", "+573023334455", true],
    ]);
    const c = await confirmarLote(r.loteId, await filasDe(r.loteId), actor);
    expect(c.mensaje).toContain("3 enviada(s) al ATS");
    await drenar();
    const recs = await prisma.recepcion.findMany({ orderBy: { recibidaEn: "asc" } });
    expect(recs).toHaveLength(3);
    for (const rec of recs) expect(rec).toMatchObject({ fuente: "importador", estado: "COMPLETADO", procesoAtsId: 9002 });
    expect(recs[0].idExterno).toBe(`9002:${sha(archivos[0].bytes)}`);
    expect(talentia.postulaciones.map((p) => p.procesoId)).toEqual([9002, 9002, 9002]);
    expect(talentia.postulaciones[0].fuente).toBe("Importador manual del Puente");
    expect(talentia.documentos.map((d) => d.sha256).sort()).toEqual(archivos.map((a) => sha(a.bytes)).sort());
    // Los bytes se borran del lote al confirmar.
    expect(await prisma.archivoImportacion.count({ where: { loteId: r.loteId, contenido: { not: null } } })).toBe(0);
    // Y la entrada quedó auditada con el usuario como actor.
    expect(await prisma.eventoAuditoria.count({ where: { actorId: USUARIO, accion: "recepcion.recibida" } })).toBe(3);
  });
});

describe("I-2 · importar el mismo PDF otra vez en el mismo proceso da DUPLICADA", () => {
  it("segundo lote con el mismo archivo", async () => {
    const bytes = await pdfConTexto(TRES[0].lineas);
    const a = await crearLote(USUARIO, 9002, [{ nombre: TRES[0].nombre, bytes }]);
    if (!a.ok) throw new Error(a.mensaje);
    await confirmarLote(a.loteId, await filasDe(a.loteId), actor);
    const b = await crearLote(USUARIO, 9002, [{ nombre: "otro-nombre.pdf", bytes }]);
    if (!b.ok) throw new Error(b.mensaje);
    const c = await confirmarLote(b.loteId, await filasDe(b.loteId, { nombres: "Ana" }), actor);
    expect(c.mensaje).toContain("1 duplicada(s)");
    expect((await prisma.archivoImportacion.findFirstOrThrow({ where: { loteId: b.loteId } })).resultado).toBe("DUPLICADA");
    await drenar();
    expect(await prisma.recepcion.count()).toBe(1);
    expect(talentia.conteo().postulaciones).toBe(1);
  });

  it("el mismo PDF en OTRO proceso sí es otra postulación", async () => {
    const bytes = await pdfConTexto(TRES[0].lineas);
    for (const proceso of [9001, 9002]) {
      const l = await crearLote(USUARIO, proceso, [{ nombre: TRES[0].nombre, bytes }]);
      if (!l.ok) throw new Error(l.mensaje);
      await confirmarLote(l.loteId, await filasDe(l.loteId), actor);
    }
    expect(await prisma.recepcion.count()).toBe(2);
  });
});

describe("I-3 · un PDF sin texto queda en REQUIERE_REVISION", () => {
  it("no se sugiere correo; al confirmar queda en revisión y no llega al ATS", async () => {
    const l = await crearLote(USUARIO, 9002, [{ nombre: "cv-escaneado-diego-mora.pdf", bytes: await pdfSinTexto() }]);
    if (!l.ok) throw new Error(l.mensaje);
    const fila = await prisma.archivoImportacion.findFirstOrThrow({ where: { loteId: l.loteId } });
    expect(fila).toMatchObject({ textoLeido: false, correo: "", telefono: "", nombres: "Escaneado" });
    await confirmarLote(l.loteId, await filasDe(l.loteId, { nombres: "Diego", apellidos: "Mora" }), actor);
    await drenar();
    expect(await prisma.recepcion.findFirstOrThrow()).toMatchObject({ estado: "REQUIERE_REVISION", motivoRevision: "sin_correo" });
    expect(talentia.conteo().postulaciones).toBe(0);
  });
});

describe("I-4 · el CSV completa los nombres y gana sobre lo sugerido", () => {
  it("nombres, apellidos y correo del CSV", async () => {
    const csv = "archivo,nombres,apellidos,correo,telefono\ncv-ana-gomez.pdf,Lucía,Csv Gana,lucia.csv@demo.test,3109998877\n";
    const l = await crearLote(USUARIO, 9002, [{ nombre: "cv-ana-gomez.pdf", bytes: await pdfConTexto(TRES[0].lineas) }], csv);
    if (!l.ok) throw new Error(l.mensaje);
    expect(await prisma.archivoImportacion.findFirstOrThrow({ where: { loteId: l.loteId } })).toMatchObject({
      nombres: "Lucía",
      apellidos: "Csv Gana",
      correo: "lucia.csv@demo.test",
      telefono: "3109998877",
      origenNombre: "csv",
    });
    await confirmarLote(l.loteId, await filasDe(l.loteId), actor);
    await drenar();
    expect(await prisma.recepcion.findFirstOrThrow()).toMatchObject({ nombre: "Lucía", apellido: "Csv Gana", correo: "lucia.csv@demo.test", telefono: "+573109998877", estado: "COMPLETADO" });
  });
});

describe("I-5 · un archivo que no es PDF o pesa más de 5 MB se rechaza con un mensaje claro", () => {
  it("errores por archivo, el resto sigue", async () => {
    const grande = new Uint8Array(Number(process.env.CV_MAX_BYTES) + 1);
    grande.set(new TextEncoder().encode("%PDF-1.4"));
    const l = await crearLote(USUARIO, 9002, [
      { nombre: "notas.docx", bytes: new TextEncoder().encode("no soy un pdf") },
      { nombre: "cv-enorme.pdf", bytes: grande },
      { nombre: TRES[1].nombre, bytes: await pdfConTexto(TRES[1].lineas) },
    ]);
    if (!l.ok) throw new Error(l.mensaje);
    const filas = await prisma.archivoImportacion.findMany({ where: { loteId: l.loteId }, orderBy: { orden: "asc" } });
    expect(filas[0].error).toBe("«notas.docx» no es un PDF (solo se aceptan PDF).");
    expect(filas[1].error).toMatch(/^«cv-enorme\.pdf» pesa .* el máximo es/);
    expect(filas[2].error).toBeNull();
    await confirmarLote(l.loteId, await filasDe(l.loteId), actor);
    await drenar();
    expect(await prisma.recepcion.count()).toBe(1);
  });

  it("más de 20 PDF o ninguno: se rechaza el lote completo", async () => {
    const bytes = await pdfConTexto(["x"]);
    expect(await crearLote(USUARIO, 9002, Array.from({ length: 21 }, (_, i) => ({ nombre: `cv-${i}.pdf`, bytes })))).toMatchObject({ ok: false, mensaje: expect.stringContaining("Máximo 20") });
    expect(await crearLote(USUARIO, 9002, [])).toMatchObject({ ok: false });
  });
});

describe("I-6 · solo usuarios con sesión iniciada pueden importar", () => {
  const solicitud = async () => {
    const fd = new FormData();
    fd.set("procesoAtsId", "9002");
    fd.append("archivos", new File([(await pdfConTexto(TRES[2].lineas)).slice()], TRES[2].nombre, { type: "application/pdf" }));
    return new Request("http://puente.test/api/importador/lotes", { method: "POST", body: fd });
  };

  it("sin sesión: 401 y no se guarda nada", async () => {
    const r = await recibirSubida(await solicitud(), null);
    expect(r.status).toBe(401);
    expect(await prisma.loteImportacion.count()).toBe(0);
  });

  it("con sesión: crea el lote y lleva a la tabla de revisión", async () => {
    const r = await recibirSubida(await solicitud(), { id: USUARIO });
    expect(r.status).toBe(303);
    const lote = await prisma.loteImportacion.findFirstOrThrow();
    expect(r.headers.get("location")).toBe(`http://puente.test/importar/${lote.id}`);
  });
});

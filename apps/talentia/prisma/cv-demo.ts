import { createHash } from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// CV ficticio de una página para los postulantes sembrados en Talentia (los que llegan por el puente traen el suyo).
// Generado aquí y no importado de Vínculo: cada sistema es independiente.

export async function cvDemo(nombre: string, apellido: string, cargo: string, correo: string) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`CV ficticio · ${nombre} ${apellido}`);
  pdf.setProducer("Talentia (simulado)");
  const pagina = pdf.addPage([595, 842]);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const tinta = rgb(0.12, 0.11, 0.29);
  pagina.drawRectangle({ x: 0, y: 772, width: 595, height: 70, color: rgb(0.26, 0.22, 0.79) });
  pagina.drawText(`${nombre} ${apellido}`, { x: 40, y: 805, size: 22, font: negrita, color: rgb(1, 1, 1) });
  pagina.drawText(`Aspirante a ${cargo}`, { x: 40, y: 785, size: 11, font: normal, color: rgb(0.9, 0.9, 1) });
  const lineas: [string, boolean][] = [
    ["Contacto", true],
    [`${correo} · Medellín, Colombia`, false],
    ["", false],
    ["Perfil", true],
    ["Profesional con experiencia en equipos ágiles de desarrollo de software.", false],
    ["Interés en el cargo por el proyecto y la cultura de la empresa.", false],
    ["", false],
    ["Experiencia", true],
    ["2022 – hoy · Empresa ficticia del sector software", false],
    ["2019 – 2022 · Empresa ficticia de servicios", false],
    ["", false],
    ["Educación", true],
    ["Formación técnica o profesional (institución ficticia)", false],
  ];
  let y = 730;
  for (const [texto, titulo] of lineas) {
    if (texto) pagina.drawText(texto, { x: 40, y, size: titulo ? 13 : 10.5, font: titulo ? negrita : normal, color: tinta });
    y -= titulo ? 20 : 16;
  }
  pagina.drawText("Documento ficticio generado para un prototipo académico. No corresponde a una persona real.", {
    x: 40,
    y: 40,
    size: 8,
    font: normal,
    color: rgb(0.45, 0.45, 0.5),
  });
  const bytes = await pdf.save();
  return { bytes: new Uint8Array(bytes), sha256: createHash("sha256").update(bytes).digest("hex") };
}

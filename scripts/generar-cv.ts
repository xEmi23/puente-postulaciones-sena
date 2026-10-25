// Genera CV en PDF de personas ficticias (fixtures/cv/*.pdf). Ningún dato corresponde a personas reales.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface PersonaFicticia {
  archivo: string;
  nombre: string;
  apellido: string;
  correo: string;
  telefono: string;
  ciudad: string;
  perfil: string;
  experiencia: string[];
}

export const PERSONAS: PersonaFicticia[] = [
  {
    archivo: "cv-camila-ejemplo.pdf",
    nombre: "Camila",
    apellido: "Ejemplo Ficticia",
    correo: "camila.ejemplo@demo.test",
    telefono: "3000000001",
    ciudad: "Medellín",
    perfil: "Desarrolladora backend con 3 años de experiencia en Java y Spring Boot (perfil ficticio).",
    experiencia: ["Empresa Demo Uno — Desarrolladora Java (2023–2026)", "Proyecto Simulado — API REST de pedidos"],
  },
  {
    archivo: "cv-andres-prueba.pdf",
    nombre: "Andrés",
    apellido: "Prueba Simulado",
    correo: "andres.prueba@demo.test",
    telefono: "3000000002",
    ciudad: "Envigado",
    perfil: "Analista de calidad de software con experiencia en pruebas automatizadas (perfil ficticio).",
    experiencia: ["Empresa Demo Dos — Analista QA (2022–2026)", "Automatización con Playwright en proyecto simulado"],
  },
  {
    archivo: "cv-sofia-demo.pdf",
    nombre: "Sofía",
    apellido: "Demo Inventada",
    correo: "sofia.demo@demo.test",
    telefono: "3000000003",
    ciudad: "Bello",
    perfil: "Ingeniera de software junior interesada en integración de sistemas (perfil ficticio).",
    experiencia: ["Empresa Demo Tres — Practicante de desarrollo (2025–2026)"],
  },
];

export async function generarPdf(p: PersonaFicticia): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Hoja de vida ficticia — ${p.nombre} ${p.apellido}`);
  doc.setAuthor("talent-bridge (datos ficticios)");
  doc.setCreationDate(new Date("2026-10-25T00:00:00Z"));
  doc.setModificationDate(new Date("2026-10-25T00:00:00Z"));
  const pagina = doc.addPage([595, 842]);
  const negrita = await doc.embedFont(StandardFonts.HelveticaBold);
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  let y = 780;
  const linea = (texto: string, tam = 11, fuente = normal) => {
    pagina.drawText(texto, { x: 56, y, size: tam, font: fuente, color: rgb(0.1, 0.1, 0.15) });
    y -= tam + 10;
  };
  linea(`${p.nombre} ${p.apellido}`, 22, negrita);
  linea(`${p.correo} · ${p.telefono} · ${p.ciudad}`);
  y -= 8;
  linea("DOCUMENTO FICTICIO PARA PRUEBAS — NO CORRESPONDE A UNA PERSONA REAL", 9, negrita);
  y -= 8;
  linea("Perfil", 14, negrita);
  linea(p.perfil.replace(/[^\x20-\x7E -ÿ]/g, "-"));
  y -= 4;
  linea("Experiencia", 14, negrita);
  for (const e of p.experiencia) linea(`• ${e}`.replace(/[^\x20-\x7E -ÿ]/g, "-"));
  return doc.save({ useObjectStreams: false });
}

async function main() {
  const dir = path.resolve("fixtures/cv");
  mkdirSync(dir, { recursive: true });
  for (const p of PERSONAS) {
    writeFileSync(path.join(dir, p.archivo), await generarPdf(p));
    console.log(`Generado fixtures/cv/${p.archivo}`);
  }
  // Archivo que NO es PDF (para probar rechazos): texto con extensión .pdf
  writeFileSync(path.join(dir, "no-es-pdf.pdf"), "Esto es texto plano con extensión .pdf\n");
  console.log("Generado fixtures/cv/no-es-pdf.pdf");
}

if (process.argv[1]?.includes("generar-cv")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

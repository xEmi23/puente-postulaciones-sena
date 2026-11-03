import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

// Generador determinista de datos FICTICIOS para Vínculo (ESPECIFICACION §5). Nombres colombianos plausibles por
// combinación, sin fotos ni datos de personas reales; se descartan combinaciones que coinciden con figuras públicas.

export function azar(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOMBRES = ["Valentina", "Santiago", "Mariana", "Sebastián", "Isabella", "Mateo", "Daniela", "Samuel", "Laura", "Nicolás", "Camila", "Alejandro", "Sara", "Juan Pablo", "Manuela", "Tomás", "Gabriela", "David", "Natalia", "Andrés", "Paula", "Felipe", "Juliana", "Esteban", "Luisa", "Simón", "Carolina", "Miguel Ángel", "Antonia", "Emilio", "Verónica", "Julián", "Catalina", "Martín", "Ana María", "Jerónimo", "Melissa", "Cristian", "Lorena", "Hernán"];
const APELLIDOS = ["Restrepo", "Mejía", "Zuluaga", "Arango", "Vélez", "Ospina", "Cardona", "Giraldo", "Henao", "Montoya", "Agudelo", "Castaño", "Echeverri", "Gaviria", "Londoño", "Quintero", "Salazar", "Toro", "Uribe", "Betancur", "Duque", "Jaramillo", "Osorio", "Patiño", "Rendón", "Arbeláez", "Correa", "Builes", "Muñoz", "Ríos", "Tamayo", "Villegas", "Marín", "Bedoya", "Posada", "Lopera", "Sierra", "Ochoa", "Franco", "Valencia"];
// Combinaciones (nombre + primer apellido) que coinciden con figuras públicas colombianas conocidas: se descartan.
const DESCARTADOS = new Set(["juan pablo montoya", "alvaro uribe", "ivan duque", "juan manuel santos", "gustavo petro", "carolina giraldo", "juan luis londono", "jose osorio", "mariana pajon", "egan bernal", "catalina ochoa"]);
const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export interface PersonaFicticia {
  nombre: string;
  apellido: string;
  correo: string;
  telefono: string;
  ciudad: string;
  titular: string;
  acercaDe: string;
  habilidades: string[];
  experiencia: { cargo: string; empresa: string; desde: string; hasta: string | null; descripcion: string }[];
  educacion: { institucion: string; titulo: string; desde: string; hasta: string | null }[];
}

const CIUDADES = ["Medellín", "Bogotá", "Cali", "Envigado", "Bello", "Itagüí", "Rionegro", "Barranquilla", "Bucaramanga", "Pereira"];
const PERFILES = [
  { titular: "Desarrollador/a backend Java y Spring Boot", habilidades: ["Java", "Spring Boot", "PostgreSQL", "Docker", "Pruebas unitarias", "Git"], cargo: "Desarrollador/a backend" },
  { titular: "Desarrollador/a frontend React y TypeScript", habilidades: ["React", "TypeScript", "Next.js", "CSS", "Accesibilidad web", "Jest"], cargo: "Desarrollador/a frontend" },
  { titular: "Analista de calidad de software", habilidades: ["Pruebas funcionales", "Playwright", "Selenium", "Postman", "Jira", "SQL"], cargo: "Analista QA" },
  { titular: "Ingeniero/a DevOps y nube", habilidades: ["AWS", "Terraform", "Kubernetes", "CI/CD", "Linux", "Observabilidad"], cargo: "Ingeniero/a DevOps" },
  { titular: "Diseñador/a UX/UI", habilidades: ["Figma", "Investigación con usuarios", "Prototipado", "Design systems", "Usabilidad"], cargo: "Diseñador/a de producto" },
  { titular: "Analista de datos", habilidades: ["SQL", "Python", "Power BI", "Estadística", "ETL", "Excel avanzado"], cargo: "Analista de datos" },
  { titular: "Estudiante de ingeniería de sistemas", habilidades: ["Java", "Python", "Bases de datos", "Trabajo en equipo", "Scrum"], cargo: "Monitor/a académico" },
  { titular: "Scrum Master y facilitador/a ágil", habilidades: ["Scrum", "Kanban", "Facilitación", "Jira", "Gestión de riesgos"], cargo: "Scrum Master" },
];
const EMPRESAS_PREVIAS = ["Nubeteca Analítica", "Ruta Kafé Logística", "Selva Digital Studio", "Cumbre Energía Renovable", "Altamira Salud Integral", "Consultora Quebrada Clara", "Taller de Software Guayacán"];
const INSTITUCIONES = ["Universidad del Valle de Aburrá (ficticia)", "Politécnico Ciudad Montaña (ficticio)", "Institución Universitaria Los Andes del Sur (ficticia)", "Centro de Formación Técnica Nevado (ficticio)"];

export function generarPersonas(cuantas: number, semilla = 2026): PersonaFicticia[] {
  const r = azar(semilla);
  const elegir = <T>(l: readonly T[]) => l[Math.floor(r() * l.length)];
  const usadas = new Set<string>();
  const personas: PersonaFicticia[] = [];
  while (personas.length < cuantas) {
    const nombre = elegir(NOMBRES);
    const a1 = elegir(APELLIDOS);
    let a2 = elegir(APELLIDOS);
    if (a2 === a1) a2 = APELLIDOS[(APELLIDOS.indexOf(a1) + 7) % APELLIDOS.length];
    const clave = sinTildes(`${nombre} ${a1}`);
    if (DESCARTADOS.has(clave) || usadas.has(sinTildes(`${nombre} ${a1} ${a2}`))) continue;
    usadas.add(sinTildes(`${nombre} ${a1} ${a2}`));
    const perfil = elegir(PERFILES);
    const ciudad = elegir(CIUDADES);
    const anios = 1 + Math.floor(r() * 9);
    const inicioCarrera = 2026 - anios;
    const correo = `${sinTildes(nombre).split(" ")[0]}.${sinTildes(a1)}${personas.length + 1}@demo.test`;
    const empresaA = elegir(EMPRESAS_PREVIAS);
    let empresaB = elegir(EMPRESAS_PREVIAS);
    if (empresaB === empresaA) empresaB = EMPRESAS_PREVIAS[(EMPRESAS_PREVIAS.indexOf(empresaA) + 1) % EMPRESAS_PREVIAS.length];
    const mitad = inicioCarrera + Math.max(1, Math.floor(anios / 2));
    personas.push({
      nombre,
      apellido: `${a1} ${a2}`,
      correo,
      telefono: `+573${String(Math.floor(r() * 1e9)).padStart(9, "0")}`,
      ciudad,
      titular: perfil.titular,
      acercaDe: `Profesional con ${anios} ${anios === 1 ? "año" : "años"} de experiencia como ${perfil.cargo.toLowerCase()}. Me interesa construir productos útiles con equipos colaborativos, aprender de forma continua y cuidar la calidad de lo que entrego. Perfil ficticio de la demostración.`,
      habilidades: perfil.habilidades,
      experiencia: [
        { cargo: perfil.cargo, empresa: empresaA, desde: `${mitad}-0${1 + Math.floor(r() * 9)}`, hasta: null, descripcion: `Trabajo en un equipo ágil. Principales herramientas: ${perfil.habilidades.slice(0, 3).join(", ")}.` },
        ...(anios > 2 ? [{ cargo: `${perfil.cargo} junior`, empresa: empresaB, desde: `${inicioCarrera}-02`, hasta: `${mitad}-01`, descripcion: "Apoyo en el desarrollo y mantenimiento de soluciones para clientes internos." }] : []),
      ],
      educacion: [{ institucion: elegir(INSTITUCIONES), titulo: perfil.cargo.includes("Diseñador") ? "Diseño gráfico" : perfil.cargo.includes("datos") ? "Ingeniería industrial" : "Ingeniería de sistemas", desde: `${inicioCarrera - 5}-01`, hasta: `${inicioCarrera}-12` }],
    });
  }
  return personas;
}

// ───────────── CV en PDF (una página, diseño sobrio con banda de color) ─────────────

function envolver(texto: string, fuente: PDFFont, tamano: number, ancho: number): string[] {
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of texto.split(/\s+/)) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (fuente.widthOfTextAtSize(prueba, tamano) > ancho && actual) {
      lineas.push(actual);
      actual = palabra;
    } else actual = prueba;
  }
  if (actual) lineas.push(actual);
  return lineas;
}

const mes = (aaaamm: string | null) => {
  if (!aaaamm) return "actual";
  const [a, m] = aaaamm.split("-");
  return `${["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][Number(m) - 1]} ${a}`;
};

export async function cvPdf(p: PersonaFicticia): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Hoja de vida · ${p.nombre} ${p.apellido} (ficticia)`);
  doc.setAuthor("Simulador LinkedIn · datos ficticios");
  doc.setCreationDate(new Date("2026-10-01T12:00:00Z"));
  doc.setModificationDate(new Date("2026-10-01T12:00:00Z"));
  const page: PDFPage = doc.addPage([595.28, 841.89]);
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const negrita = await doc.embedFont(StandardFonts.HelveticaBold);
  const acento = rgb(0.06, 0.46, 0.43);
  const gris = rgb(0.3, 0.33, 0.36);
  const margen = 48;
  const ancho = 595.28 - margen * 2;

  page.drawRectangle({ x: 0, y: 841.89 - 120, width: 595.28, height: 120, color: acento });
  page.drawText(`${p.nombre} ${p.apellido}`, { x: margen, y: 841.89 - 60, size: 24, font: negrita, color: rgb(1, 1, 1) });
  page.drawText(p.titular, { x: margen, y: 841.89 - 84, size: 12, font: normal, color: rgb(0.86, 0.97, 0.95) });
  page.drawText(`${p.correo}  ·  ${p.telefono}  ·  ${p.ciudad}, Colombia`, { x: margen, y: 841.89 - 104, size: 10, font: normal, color: rgb(1, 1, 1) });

  let y = 841.89 - 150;
  const seccion = (titulo: string) => {
    page.drawText(titulo.toUpperCase(), { x: margen, y, size: 11, font: negrita, color: acento });
    page.drawLine({ start: { x: margen, y: y - 4 }, end: { x: margen + ancho, y: y - 4 }, thickness: 0.8, color: acento });
    y -= 20;
  };
  const parrafo = (texto: string, tamano = 10, fuente = normal, color = gris, sangria = 0) => {
    for (const l of envolver(texto, fuente, tamano, ancho - sangria)) {
      page.drawText(l, { x: margen + sangria, y, size: tamano, font: fuente, color });
      y -= tamano + 4;
    }
  };

  seccion("Perfil");
  parrafo(p.acercaDe);
  y -= 8;
  seccion("Experiencia");
  for (const e of p.experiencia) {
    parrafo(`${e.cargo} · ${e.empresa}`, 11, negrita, rgb(0.1, 0.1, 0.12));
    parrafo(`${mes(e.desde)} – ${mes(e.hasta)}`, 9);
    parrafo(e.descripcion, 10, normal, gris, 8);
    y -= 6;
  }
  seccion("Educación");
  for (const ed of p.educacion) {
    parrafo(`${ed.titulo} · ${ed.institucion}`, 11, negrita, rgb(0.1, 0.1, 0.12));
    parrafo(`${mes(ed.desde)} – ${mes(ed.hasta)}`, 9);
    y -= 6;
  }
  seccion("Habilidades");
  parrafo(p.habilidades.join("  ·  "));
  page.drawText("Documento ficticio generado para un entorno de simulación. No corresponde a una persona real.", {
    x: margen,
    y: 30,
    size: 8,
    font: normal,
    color: rgb(0.45, 0.47, 0.5),
  });
  return doc.save();
}

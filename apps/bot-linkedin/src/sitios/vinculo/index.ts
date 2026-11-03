import { parse, type HTMLElement } from "node-html-parser";
import type { Bloqueo, DetallePostulante, PerfilSitio, PostulanteListado, VacanteSitio } from "../tipos";
import { RUTAS, SELECTORES } from "./selectores";

// Perfil del sitio «vinculo» (red profesional **simulada** del proyecto). Funciones puras HTML → datos, probadas con
// páginas guardadas del panel del reclutador (tests/extraccion.test.ts).

const absoluta = (base: string, href: string) => new URL(href, base).toString();
const texto = (el: HTMLElement | null) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");

function campo(raiz: HTMLElement, nombre: string): string {
  return texto(raiz.querySelector(SELECTORES.campo(nombre)));
}

export class ErrorExtraccion extends Error {
  constructor(message: string) {
    super(`No se encontró el elemento: ${message}`);
    this.name = "ErrorExtraccion";
  }
}

function detectarBloqueo(html: string, url: string): Bloqueo | null {
  const ruta = new URL(url).pathname;
  const raiz = parse(html);
  if (ruta.startsWith(RUTAS.ingreso) || raiz.querySelector(SELECTORES.formularioIngreso)) {
    return { tipo: "sesion_cerrada", detalle: "Vínculo muestra la pantalla de ingreso: la sesión del bot se cerró o nunca se inició. Ejecuta «npm run bot:login -w apps/bot-linkedin» (si hay otra ventana del bot abierta, ciérrala primero) y vuelve a correr el bot." };
  }
  // La página de error de Vínculo (por ejemplo, PostgreSQL apagado): no es una sesión vencida.
  if (/<h1[^>]*>\s*Algo salió mal\s*<\/h1>/.test(html)) {
    return { tipo: "pagina_inesperada", detalle: "Vínculo muestra «Algo salió mal» (error del sitio). Mira la ventana de «npm run dev»; si es la base de datos, enciéndela con «npm run pg:start» y vuelve a correr el bot." };
  }
  // Una página del panel sin su menú no es la que el bot conoce (otra pantalla, error o carga a medias): no adivinar.
  if (ruta.startsWith(RUTAS.inicio) && !raiz.querySelector(SELECTORES.menuPanel)) {
    return { tipo: "pagina_inesperada", detalle: "Vínculo no muestra el panel del reclutador completo (¿la sesión venció? Ejecuta bot:login y vuelve a intentar)." };
  }
  return null;
}

function extraerVacantes(html: string, base: string): VacanteSitio[] {
  return parse(html)
    .querySelectorAll(SELECTORES.filaVacante)
    .map((fila) => {
      const enlace = fila.querySelector(SELECTORES.enlaceVacante);
      const idExterno = fila.getAttribute("data-external-job-id") ?? "";
      if (!enlace || !idExterno) throw new ErrorExtraccion("enlace o código de la vacante en el panel");
      return { idExterno, titulo: texto(enlace), url: absoluta(base, enlace.getAttribute("href")!) };
    });
}

function extraerPostulantes(html: string, base: string): PostulanteListado[] {
  return parse(html)
    .querySelectorAll(SELECTORES.filaPostulante)
    .map((fila) => {
      const enlace = fila.querySelector(SELECTORES.enlaceFicha);
      const idExterno = fila.getAttribute("data-postulacion") ?? "";
      if (!enlace || !idExterno) throw new ErrorExtraccion("enlace «Ver ficha» de un postulante");
      return { idExterno, urlDetalle: absoluta(base, enlace.getAttribute("href")!) };
    });
}

function extraerDetalle(html: string, base: string): DetallePostulante {
  const raiz = parse(html);
  const ficha = raiz.querySelector(SELECTORES.ficha);
  if (!ficha) throw new ErrorExtraccion("ficha del postulante");
  const cv = ficha.querySelector(SELECTORES.campo("cv"));
  const enviada = ficha.querySelector(SELECTORES.campo("enviada"));
  const perfil = ficha.querySelector(SELECTORES.campo("perfil"));
  const nombres = campo(ficha, "nombres");
  if (!nombres) throw new ErrorExtraccion("nombre del postulante");
  return {
    idExterno: ficha.getAttribute("data-postulacion") ?? "",
    vacanteExterna: ficha.getAttribute("data-vacante") ?? campo(ficha, "vacante"),
    nombres,
    apellidos: campo(ficha, "apellidos"),
    correo: campo(ficha, "correo"),
    telefono: campo(ficha, "telefono"),
    ciudad: campo(ficha, "ciudad"),
    titular: campo(ficha, "titular"),
    perfilUrl: perfil?.getAttribute("href") ? absoluta(base, perfil.getAttribute("href")!) : "",
    recibidaEn: enviada?.getAttribute("datetime") ?? "",
    urlCv: cv?.getAttribute("href") ? absoluta(base, cv.getAttribute("href")!) : "",
  };
}

export const perfilVinculo: PerfilSitio = {
  nombre: "vinculo",
  listo: true,
  urlInicio: (base) => absoluta(base, RUTAS.inicio),
  urlLogin: (base) => absoluta(base, `${RUTAS.ingreso}?siguiente=${encodeURIComponent(RUTAS.inicio)}`),
  // Vínculo es nuestra simulación: pausas cortas para que la demo sea ágil (D-66).
  pausasPorDefecto: { min: 800, max: 1500 },
  horarioPorDefecto: "00-24",
  selectores: Object.fromEntries(Object.entries(SELECTORES).filter(([, v]) => typeof v === "string")) as Record<string, string>,
  detectarBloqueo,
  extraerVacantes,
  extraerPostulantes,
  extraerDetalle,
};
